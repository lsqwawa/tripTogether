import { Router, Request, Response } from "express";
import { AppDataSource } from "../database";
import { Expense } from "../entities/Expense";
import { TripMember } from "../entities/TripMember";
import { requireTripMember, requireTripEditor } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router({ mergeParams: true });

// 该路由组下所有操作都要求当前用户是计划成员；写操作在各端点追加 editor 校验
router.use(requireTripMember);

/** 取本行程所有成员 userId，用于校验 payerId / participantIds 是否越权 */
async function getTripMemberUserIds(tripId: string): Promise<Set<string>> {
  const list = await AppDataSource.getRepository(TripMember).find({
    where: { tripId },
  });
  return new Set(list.map((m) => m.userId));
}

/** 解析 participantIds，非法 JSON 一律视为空数组；仅保留真实成员，返回有效参与者 */
function parseParticipants(
  raw: unknown,
  memberSet: Set<string>
): { ok: boolean; participants: string[] } {
  let arr: unknown;
  try {
    arr = JSON.parse(typeof raw === "string" ? raw : "[]");
  } catch {
    return { ok: false, participants: [] };
  }
  if (!Array.isArray(arr)) return { ok: false, participants: [] };
  return { ok: true, participants: arr.filter((x) => memberSet.has(String(x))) };
}

// ==================== 花费记录 ====================

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const items = await AppDataSource.getRepository(Expense).find({
      where: { tripId: req.params.tripId },
      order: { expenseDate: "DESC", createdAt: "DESC" },
    });
    res.json(items);
  })
);

router.post(
  "/",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const { title, category, amount, payerId, participantIds, expenseDate, notes } =
      req.body;

    if (!title || amount == null || !payerId) {
      return res.status(400).json({ error: "请填写标题、金额和付款人" });
    }
    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ error: "至少选择一位参与分摊的成员" });
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount)) {
      return res.status(400).json({ error: "金额必须为数字" });
    }

    // 防越权：付款人与参与人必须都是本行程成员（避免写入任意 UUID）
    const memberSet = await getTripMemberUserIds(req.params.tripId);
    if (!memberSet.has(payerId)) {
      return res.status(400).json({ error: "付款人不是本行程成员" });
    }
    if (!participantIds.every((id: string) => memberSet.has(id))) {
      return res.status(400).json({ error: "参与分摊成员包含非本行程成员" });
    }

    const repo = AppDataSource.getRepository(Expense);
    const item = repo.create({
      tripId: req.params.tripId,
      title,
      category: category || "other",
      amount: numAmount,
      payerId,
      participantIds: JSON.stringify(participantIds),
      expenseDate: expenseDate || null,
      notes: notes || null,
    });
    await repo.save(item);
    res.status(201).json(item);
  })
);

router.patch(
  "/:id",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(Expense);
    const item = await repo.findOne({
      where: { id: req.params.id, tripId: req.params.tripId },
    });
    if (!item) return res.status(404).json({ error: "花费记录不存在" });

    const { title, category, amount, payerId, participantIds, expenseDate, notes } =
      req.body;
    if (title !== undefined) item.title = title;
    if (category !== undefined) item.category = category;
    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (!Number.isFinite(numAmount)) {
        return res.status(400).json({ error: "金额必须为数字" });
      }
      item.amount = numAmount;
    }
    if (payerId !== undefined) {
      const memberSet = await getTripMemberUserIds(req.params.tripId);
      if (!memberSet.has(payerId)) {
        return res.status(400).json({ error: "付款人不是本行程成员" });
      }
      item.payerId = payerId;
    }
    if (participantIds !== undefined) {
      if (!Array.isArray(participantIds) || participantIds.length === 0) {
        return res.status(400).json({ error: "至少选择一位参与分摊的成员" });
      }
      const memberSet = await getTripMemberUserIds(req.params.tripId);
      if (!participantIds.every((id: string) => memberSet.has(id))) {
        return res.status(400).json({ error: "参与分摊成员包含非本行程成员" });
      }
      item.participantIds = JSON.stringify(participantIds);
    }
    if (expenseDate !== undefined) item.expenseDate = expenseDate;
    if (notes !== undefined) item.notes = notes;

    await repo.save(item);
    res.json(item);
  })
);

router.delete(
  "/:id",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(Expense);
    const item = await repo.findOne({
      where: { id: req.params.id, tripId: req.params.tripId },
    });
    if (!item) return res.status(404).json({ error: "花费记录不存在" });
    await repo.remove(item);
    res.status(204).send();
  })
);

router.get(
  "/stats",
  asyncHandler(async (req: Request, res: Response) => {
    const expenseRepo = AppDataSource.getRepository(Expense);
    const memberRepo = AppDataSource.getRepository(TripMember);

    const [expenses, members] = await Promise.all([
      expenseRepo.find({ where: { tripId: req.params.tripId } }),
      memberRepo.find({
        where: { tripId: req.params.tripId },
        relations: ["user"],
      }),
    ]);

    const memberSet = new Set(members.map((m) => m.userId));
    const memberCount = members.length || 1;

    const stats: Record<
      string,
      { userId: string; nickname: string; paid: number; owed: number; net: number }
    > = {};

    for (const m of members) {
      const uid = m.userId;
      if (!stats[uid]) {
        stats[uid] = {
          userId: uid,
          nickname: m.user?.nickname || "未知",
          paid: 0,
          owed: 0,
          net: 0,
        };
      }
    }

    // 只有「参与人非空且均为本行程成员」的花费才计入总额与分摊，
    // 否则整笔剔除（不进 total，也不造假数据），保证分子分母一致。
    let totalAmount = 0;
    for (const e of expenses) {
      const { ok, participants } = parseParticipants(e.participantIds, memberSet);
      if (!ok || participants.length === 0) continue;
      if (!memberSet.has(e.payerId)) continue;

      stats[e.payerId].paid += e.amount;
      const share = e.amount / participants.length;
      for (const pid of participants) {
        if (stats[pid]) stats[pid].owed += share;
      }
      totalAmount += e.amount;
    }

    for (const uid in stats) {
      stats[uid].net = stats[uid].paid - stats[uid].owed;
    }

    // 人均按"实际参与分摊的成员数"计算，与逐笔分摊口径一致；
    // 无花费或无参与记录时回退为全体成员数
    const participantCount =
      Object.values(stats).filter((s) => s.owed > 0 || s.paid > 0).length ||
      memberCount;
    const perCapita = totalAmount / participantCount;

    res.json({
      total: totalAmount,
      perCapita,
      memberCount,
      participantCount,
      items: Object.values(stats),
    });
  })
);

export default router;
