import { Router, Request, Response } from "express";
import { AppDataSource } from "../database";
import { Transportation } from "../entities/Transportation";
import { Accommodation } from "../entities/Accommodation";
import { DailySchedule } from "../entities/DailySchedule";
import { ScheduleItem } from "../entities/ScheduleItem";
import { requireTripMember } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router({ mergeParams: true });

// 该路由组下所有操作都要求当前用户是计划成员
router.use(requireTripMember);

// ==================== 交通 ====================

router.get(
  "/transportations",
  asyncHandler(async (req: Request, res: Response) => {
    const items = await AppDataSource.getRepository(Transportation).find({
      where: { tripId: req.params.tripId },
      order: { type: "ASC", departureTime: "ASC" },
    });
    res.json(items);
  })
);

router.post(
  "/transportations",
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(Transportation);
    const item = repo.create({ ...req.body, tripId: req.params.tripId });
    await repo.save(item);
    res.status(201).json(item);
  })
);

router.patch(
  "/transportations/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(Transportation);
    const item = await repo.findOne({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: "交通记录不存在" });
    Object.assign(item, req.body);
    await repo.save(item);
    res.json(item);
  })
);

router.delete(
  "/transportations/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await AppDataSource.getRepository(Transportation).delete(req.params.id);
    res.status(204).send();
  })
);

// ==================== 住宿 ====================

router.get(
  "/accommodations",
  asyncHandler(async (req: Request, res: Response) => {
    const items = await AppDataSource.getRepository(Accommodation).find({
      where: { tripId: req.params.tripId },
      order: { checkInDate: "ASC" },
    });
    res.json(items);
  })
);

router.post(
  "/accommodations",
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(Accommodation);
    const item = repo.create({ ...req.body, tripId: req.params.tripId });
    await repo.save(item);
    res.status(201).json(item);
  })
);

router.patch(
  "/accommodations/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(Accommodation);
    const item = await repo.findOne({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: "住宿记录不存在" });
    Object.assign(item, req.body);
    await repo.save(item);
    res.json(item);
  })
);

router.delete(
  "/accommodations/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await AppDataSource.getRepository(Accommodation).delete(req.params.id);
    res.status(204).send();
  })
);

// ==================== 每日日程 ====================

router.get(
  "/schedules",
  asyncHandler(async (req: Request, res: Response) => {
    const schedules = await AppDataSource.getRepository(DailySchedule).find({
      where: { tripId: req.params.tripId },
      relations: ["items"],
      order: { dayIndex: "ASC" },
    });
    schedules.forEach((s) => s.items?.sort((a, b) => a.sortOrder - b.sortOrder));
    res.json(schedules);
  })
);

router.patch(
  "/schedules/:scheduleId",
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(DailySchedule);
    const schedule = await repo.findOne({
      where: { id: req.params.scheduleId },
    });
    if (!schedule) return res.status(404).json({ error: "日程不存在" });
    Object.assign(schedule, req.body);
    await repo.save(schedule);
    res.json(schedule);
  })
);

// ==================== 日程项（具体活动） ====================

router.post(
  "/schedules/:scheduleId/items",
  asyncHandler(async (req: Request, res: Response) => {
    const scheduleRepo = AppDataSource.getRepository(DailySchedule);
    const itemRepo = AppDataSource.getRepository(ScheduleItem);

    const schedule = await scheduleRepo.findOne({
      where: { id: req.params.scheduleId },
    });
    if (!schedule) return res.status(404).json({ error: "日程不存在" });

    const count = await itemRepo.count({
      where: { scheduleId: req.params.scheduleId },
    });
    const item = itemRepo.create({
      ...req.body,
      scheduleId: req.params.scheduleId,
      tripId: req.params.tripId,
      sortOrder: count + 1,
    });
    await itemRepo.save(item);
    res.status(201).json(item);
  })
);

router.patch(
  "/schedules/:scheduleId/items/:itemId",
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(ScheduleItem);
    const item = await repo.findOne({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: "日程项不存在" });

    const { version: clientVersion, force, ...rest } = req.body as any;

    // 乐观锁：多人同时编辑时检测冲突（force=true 表示用户确认覆盖）
    if (
      !force &&
      typeof clientVersion === "number" &&
      clientVersion !== item.version
    ) {
      return res.status(409).json({
        error:
          "该行程项已被其他成员修改，请查看最新版本后再决定如何编辑。",
        latest: item,
      });
    }

    Object.assign(item, rest);
    item.version = (item.version ?? 0) + 1;
    await repo.save(item);
    res.json(item);
  })
);

router.delete(
  "/schedules/:scheduleId/items/:itemId",
  asyncHandler(async (req: Request, res: Response) => {
    await AppDataSource.getRepository(ScheduleItem).delete(req.params.itemId);
    res.status(204).send();
  })
);

router.post(
  "/schedules/:scheduleId/items/reorder",
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(ScheduleItem);
    const { itemIds } = req.body as { itemIds: string[] };
    if (!Array.isArray(itemIds)) {
      return res.status(400).json({ error: "itemIds 必须为数组" });
    }
    for (let i = 0; i < itemIds.length; i++) {
      await repo.update(itemIds[i], { sortOrder: i + 1 });
    }
    res.json({ success: true });
  })
);

export default router;
