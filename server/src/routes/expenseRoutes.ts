import { Router, Request, Response } from "express";
import { AppDataSource } from "../database";
import { Expense } from "../entities/Expense";
import { TripMember } from "../entities/TripMember";
import { requireTripMember } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router({ mergeParams: true });

// 该路由组下所有操作都要求当前用户是计划成员
router.use(requireTripMember);

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
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(Expense);
    const item = await repo.findOne({ where: { id: req.params.id } });
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
    if (payerId !== undefined) item.payerId = payerId;
    if (participantIds !== undefined) {
      if (!Array.isArray(participantIds) || participantIds.length === 0) {
        return res.status(400).json({ error: "至少选择一位参与分摊的成员" });
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
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(Expense);
    const result = await repo.delete(req.params.id);
    if (result.affected === 0) {
      return res.status(404).json({ error: "花费记录不存在" });
    }
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

    const totalAmount = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const participantCount = members.length || 1;
    const perCapita = totalAmount / participantCount;

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

    for (const e of expenses) {
      let participants: string[] = [];
      try {
        participants = JSON.parse(e.participantIds || "[]");
      } catch {
        participants = [];
      }
      if (participants.length === 0) continue;

      if (stats[e.payerId]) stats[e.payerId].paid += e.amount;

      const share = e.amount / participants.length;
      for (const pid of participants) {
        if (stats[pid]) stats[pid].owed += share;
      }
    }

    for (const uid in stats) {
      stats[uid].net = stats[uid].paid - stats[uid].owed;
    }

    res.json({
      total: totalAmount,
      perCapita,
      memberCount: participantCount,
      items: Object.values(stats),
    });
  })
);

export default router;
