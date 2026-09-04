import { Router, Request, Response } from "express";
import { AppDataSource } from "../database";
import { ChecklistItem } from "../entities/ChecklistItem";
import { requireTripMember, requireTripEditor } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router({ mergeParams: true });

// 读接口成员可见；写接口在各端点追加 editor 校验
router.use(requireTripMember);

const VALID_CATEGORIES = [
  "documents",
  "clothing",
  "electronics",
  "toiletries",
  "medicine",
  "other",
];

// 常用行李模板（一键添加，同名去重）
const TEMPLATE_ITEMS: Array<{ name: string; category: string }> = [
  { name: "身份证/护照", category: "documents" },
  { name: "现金", category: "documents" },
  { name: "当季衣物", category: "clothing" },
  { name: "鞋子", category: "clothing" },
  { name: "雨具", category: "clothing" },
  { name: "手机充电器/充电宝", category: "electronics" },
  { name: "相机", category: "electronics" },
  { name: "耳机", category: "electronics" },
  { name: "洗漱用品", category: "toiletries" },
  { name: "防晒霜", category: "toiletries" },
  { name: "常用药品", category: "medicine" },
  { name: "创可贴", category: "medicine" },
];

// 查询清单（含进度）
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const items = await AppDataSource.getRepository(ChecklistItem).find({
      where: { tripId: req.params.tripId },
      order: { category: "ASC", sortOrder: "ASC", createdAt: "ASC" },
    });
    res.json(items);
  })
);

// 添加单项
router.post(
  "/",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, category } = req.body;
    const trimmed = (name || "").trim().slice(0, 60);
    if (!trimmed) {
      return res.status(400).json({ error: "请输入物品名称" });
    }
    const repo = AppDataSource.getRepository(ChecklistItem);

    const dup = await repo.findOne({
      where: { tripId: req.params.tripId, name: trimmed },
    });
    if (dup) {
      return res.status(409).json({ error: "该物品已在清单中" });
    }

    const count = await repo.count({ where: { tripId: req.params.tripId } });
    const item = repo.create({
      tripId: req.params.tripId,
      name: trimmed,
      category: VALID_CATEGORIES.includes(category) ? category : "other",
      sortOrder: count + 1,
    });
    await repo.save(item);
    res.status(201).json(item);
  })
);

// 一键添加常用模板（按名称去重，返回新增数量）
router.post(
  "/template",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(ChecklistItem);
    const tripId = req.params.tripId;

    const existing = await repo.find({ where: { tripId } });
    const names = new Set(existing.map((e) => e.name));
    let added = 0;

    await AppDataSource.transaction(async (manager) => {
      const r = manager.getRepository(ChecklistItem);
      let order = existing.length;
      for (const t of TEMPLATE_ITEMS) {
        if (names.has(t.name)) continue;
        names.add(t.name);
        order++;
        await r.save(
          r.create({
            tripId,
            name: t.name,
            category: t.category,
            sortOrder: order,
          })
        );
        added++;
      }
    });

    res.status(201).json({ added });
  })
);

// 勾选/改名/改分类
router.patch(
  "/:id",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(ChecklistItem);
    const item = await repo.findOne({
      where: { id: req.params.id, tripId: req.params.tripId },
    });
    if (!item) return res.status(404).json({ error: "清单项不存在" });

    const { checked, name, category } = req.body;
    if (checked !== undefined) item.checked = !!checked;
    if (name !== undefined) {
      const trimmed = String(name).trim().slice(0, 60);
      if (!trimmed) return res.status(400).json({ error: "名称不能为空" });
      item.name = trimmed;
    }
    if (category !== undefined && VALID_CATEGORIES.includes(category)) {
      item.category = category;
    }
    await repo.save(item);
    res.json(item);
  })
);

// 删除
router.delete(
  "/:id",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(ChecklistItem);
    const item = await repo.findOne({
      where: { id: req.params.id, tripId: req.params.tripId },
    });
    if (!item) return res.status(404).json({ error: "清单项不存在" });
    await repo.remove(item);
    res.status(204).send();
  })
);

export default router;
