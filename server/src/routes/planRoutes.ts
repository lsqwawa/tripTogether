import { Router, Request, Response } from "express";
import { In } from "typeorm";
import { AppDataSource } from "../database";
import { Transportation } from "../entities/Transportation";
import { Accommodation } from "../entities/Accommodation";
import { DailySchedule } from "../entities/DailySchedule";
import { ScheduleItem } from "../entities/ScheduleItem";
import { requireTripMember, requireTripEditor } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router({ mergeParams: true });

// 该路由组下所有操作都要求当前用户是计划成员；写操作在各端点追加 editor 校验
router.use(requireTripMember);

// 只保留白名单内的字段，防止客户端覆盖 tripId / id 等敏感字段
function pick(
  body: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

const TRANSPORTATION_FIELDS = [
  "type",
  "transportType",
  "departurePlace",
  "arrivalPlace",
  "departureTime",
  "arrivalTime",
  "status",
  "bookingInfo",
  "notes",
  "cost",
  "depLat",
  "depLng",
  "arrLat",
  "arrLng",
] as const;

const ACCOMMODATION_FIELDS = [
  "name",
  "address",
  "checkInDate",
  "checkOutDate",
  "status",
  "bookingInfo",
  "notes",
  "cost",
  "lat",
  "lng",
] as const;

const SCHEDULE_FIELDS = ["title", "date"] as const;

const ITEM_FIELDS = [
  "type",
  "title",
  "description",
  "locationName",
  "address",
  "lat",
  "lng",
  "startTime",
  "endTime",
  "cost",
  "notes",
  "imageUrl",
  "transportToNext",
  "status",
] as const;

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
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(Transportation);
    const item = repo.create({
      ...pick(req.body, TRANSPORTATION_FIELDS),
      tripId: req.params.tripId,
    });
    await repo.save(item);
    res.status(201).json(item);
  })
);

router.patch(
  "/transportations/:id",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(Transportation);
    const item = await repo.findOne({
      where: { id: req.params.id, tripId: req.params.tripId },
    });
    if (!item) return res.status(404).json({ error: "交通记录不存在" });
    Object.assign(item, pick(req.body, TRANSPORTATION_FIELDS));
    await repo.save(item);
    res.json(item);
  })
);

router.delete(
  "/transportations/:id",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(Transportation);
    const item = await repo.findOne({
      where: { id: req.params.id, tripId: req.params.tripId },
    });
    if (!item) return res.status(404).json({ error: "交通记录不存在" });
    await repo.remove(item);
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
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(Accommodation);
    const item = repo.create({
      ...pick(req.body, ACCOMMODATION_FIELDS),
      tripId: req.params.tripId,
    });
    await repo.save(item);
    res.status(201).json(item);
  })
);

router.patch(
  "/accommodations/:id",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(Accommodation);
    const item = await repo.findOne({
      where: { id: req.params.id, tripId: req.params.tripId },
    });
    if (!item) return res.status(404).json({ error: "住宿记录不存在" });
    Object.assign(item, pick(req.body, ACCOMMODATION_FIELDS));
    await repo.save(item);
    res.json(item);
  })
);

router.delete(
  "/accommodations/:id",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(Accommodation);
    const item = await repo.findOne({
      where: { id: req.params.id, tripId: req.params.tripId },
    });
    if (!item) return res.status(404).json({ error: "住宿记录不存在" });
    await repo.remove(item);
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
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(DailySchedule);
    const schedule = await repo.findOne({
      where: { id: req.params.scheduleId, tripId: req.params.tripId },
    });
    if (!schedule) return res.status(404).json({ error: "日程不存在" });
    Object.assign(schedule, pick(req.body, SCHEDULE_FIELDS));
    await repo.save(schedule);
    res.json(schedule);
  })
);

// ==================== 日程项（具体活动） ====================

router.post(
  "/schedules/:scheduleId/items",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const scheduleRepo = AppDataSource.getRepository(DailySchedule);
    const itemRepo = AppDataSource.getRepository(ScheduleItem);

    const schedule = await scheduleRepo.findOne({
      where: { id: req.params.scheduleId, tripId: req.params.tripId },
    });
    if (!schedule) return res.status(404).json({ error: "日程不存在" });

    const count = await itemRepo.count({
      where: { scheduleId: req.params.scheduleId },
    });
    const item = itemRepo.create({
      ...pick(req.body, ITEM_FIELDS),
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
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(ScheduleItem);
    const item = await repo.findOne({
      where: {
        id: req.params.itemId,
        scheduleId: req.params.scheduleId,
        tripId: req.params.tripId,
      },
    });
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

    Object.assign(item, pick(rest, ITEM_FIELDS));
    item.version = (item.version ?? 0) + 1;
    await repo.save(item);
    res.json(item);
  })
);

router.delete(
  "/schedules/:scheduleId/items/:itemId",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(ScheduleItem);
    const item = await repo.findOne({
      where: {
        id: req.params.itemId,
        scheduleId: req.params.scheduleId,
        tripId: req.params.tripId,
      },
    });
    if (!item) return res.status(404).json({ error: "日程项不存在" });
    await repo.remove(item);
    res.status(204).send();
  })
);

router.post(
  "/schedules/:scheduleId/items/reorder",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(ScheduleItem);
    const { itemIds } = req.body as { itemIds: string[] };
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: "itemIds 必须为非空数组" });
    }

    // 归属校验：所有条目必须属于当前行程的当前日程
    const owned = await repo.count({
      where: {
        id: In(itemIds),
        scheduleId: req.params.scheduleId,
        tripId: req.params.tripId,
      },
    });
    if (owned !== itemIds.length) {
      return res.status(400).json({ error: "排序列表包含无效的日程项" });
    }

    // 事务内批量更新，避免中途失败导致排序半更新
    await AppDataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(ScheduleItem);
      for (let i = 0; i < itemIds.length; i++) {
        await itemRepo.update(itemIds[i], { sortOrder: i + 1 });
      }
    });
    res.json({ success: true });
  })
);

export default router;
