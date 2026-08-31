import { Router, Request, Response } from "express";
import { IsNull, Not } from "typeorm";
import { AppDataSource } from "../database";
import { DailySchedule } from "../entities/DailySchedule";
import { ScheduleItem } from "../entities/ScheduleItem";
import { Transportation } from "../entities/Transportation";
import { requireTripMember, requireTripEditor } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  buildMatchPairs,
  matchTransportPairs,
  type SequenceItem,
} from "../services/transportMatcher";

const router = Router({ mergeParams: true });

// 读接口成员可见；写接口在各端点追加 editor 校验
router.use(requireTripMember);

// 人工修正接驳时可覆盖的字段（覆盖后 legAutoMatched 置 false，重跑不覆盖）
const LEG_PATCH_FIELDS = [
  "legMode",
  "legSummary",
  "legDistanceM",
  "legDurationMin",
] as const;

// 城际草稿确认时可一并修改的字段
const CONFIRM_FIELDS = [
  "status",
  "transportType",
  "bookingInfo",
  "notes",
  "cost",
  "departureTime",
  "arrivalTime",
] as const;

/** 按 dayIndex + sortOrder 拉平日程项，并记录每项所属天序号 */
async function loadSortedItems(
  tripId: string
): Promise<{ items: ScheduleItem[]; dayIndexById: Map<string, number> }> {
  const schedules = await AppDataSource.getRepository(DailySchedule).find({
    where: { tripId },
    relations: ["items"],
    order: { dayIndex: "ASC" },
  });
  const items: ScheduleItem[] = [];
  const dayIndexById = new Map<string, number>();
  for (const s of schedules) {
    const sorted = [...(s.items || [])].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const it of sorted) {
      items.push(it);
      dayIndexById.set(it.id, s.dayIndex);
    }
  }
  return { items, dayIndexById };
}

// 一键全量匹配：市内接驳写入日程项，城际段生成待确认草稿
router.post(
  "/match-transport",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const tripId = req.params.tripId;
    const { items, dayIndexById } = await loadSortedItems(tripId);
    if (items.length < 2) {
      return res.json({
        legsApplied: 0,
        legsTotal: 0,
        skippedNoCoord: 0,
        intercityDrafts: [],
        message: "日程项少于两个，无需匹配",
      });
    }

    const sequence: SequenceItem[] = items.map((it) => ({
      id: it.id,
      dayIndex: dayIndexById.get(it.id) ?? 0,
      sortOrder: it.sortOrder,
      title: it.title,
      locationName: it.locationName,
      lat: it.lat,
      lng: it.lng,
    }));
    const out = await matchTransportPairs(
      buildMatchPairs(sequence),
      process.env.TENCENT_MAP_KEY
    );

    const entityById = new Map(items.map((e) => [e.id, e]));
    let legsApplied = 0;
    const drafts: Transportation[] = [];

    // 事务包裹：接驳落库 + 草稿生成，中途失败整体回滚
    await AppDataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(ScheduleItem);
      for (const leg of out.legs) {
        const ent = entityById.get(leg.fromItemId);
        if (!ent) continue;
        // 人工修正过的段（legAutoMatched=false 且已有值）不被自动覆盖
        if (ent.legMode && ent.legAutoMatched === false) continue;
        ent.legMode = leg.legMode;
        ent.legDistanceM = leg.legDistanceM;
        ent.legDurationMin = leg.legDurationMin;
        ent.legPolyline = leg.legPolyline;
        ent.legSummary = leg.legSummary;
        ent.legAutoMatched = true;
        await itemRepo.save(ent);
        legsApplied++;
      }

      const transportRepo = manager.getRepository(Transportation);
      const existing = await transportRepo.find({ where: { tripId } });
      const pairKeys = new Set(
        existing
          .filter((t) => t.fromItemId && t.toItemId)
          .map((t) => `${t.fromItemId}:${t.toItemId}`)
      );
      for (const s of out.intercity) {
        const key = `${s.fromItemId}:${s.toItemId}`;
        if (pairKeys.has(key)) continue;
        pairKeys.add(key);
        const draft = transportRepo.create({
          tripId,
          type: "intercity",
          transportType: s.transportType,
          departurePlace: s.departurePlace,
          arrivalPlace: s.arrivalPlace,
          status: "pending",
          matched: true,
          depLat: s.depLat,
          depLng: s.depLng,
          arrLat: s.arrLat,
          arrLng: s.arrLng,
          distanceM: s.distanceM,
          durationMin: s.durationMin,
          fromItemId: s.fromItemId,
          toItemId: s.toItemId,
        });
        await transportRepo.save(draft);
        drafts.push(draft);
      }
    });

    res.json({
      legsApplied,
      legsTotal: out.legs.length,
      skippedNoCoord: out.skippedNoCoord,
      intercityDrafts: drafts,
      via: out.legs[0]?.via ?? null,
    });
  })
);

// 查询匹配结果：市内接驳腿 + 待确认城际草稿
router.get(
  "/transport-legs",
  asyncHandler(async (req: Request, res: Response) => {
    const tripId = req.params.tripId;
    const [items, drafts] = await Promise.all([
      AppDataSource.getRepository(ScheduleItem).find({
        where: { tripId, legMode: Not(IsNull()) },
      }),
      AppDataSource.getRepository(Transportation).find({
        where: { tripId, matched: true },
        order: { departureTime: "ASC" },
      }),
    ]);
    res.json({ legs: items, drafts });
  })
);

// 人工修正某段接驳（覆盖后不再被自动匹配覆盖）
router.patch(
  "/schedule-items/:itemId/transport",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(ScheduleItem);
    const item = await repo.findOne({
      where: { id: req.params.itemId, tripId: req.params.tripId },
    });
    if (!item) return res.status(404).json({ error: "日程项不存在" });

    const body = req.body as Record<string, unknown>;
    let changed = false;
    for (const k of LEG_PATCH_FIELDS) {
      if (body[k] !== undefined) {
        (item as any)[k] = body[k];
        changed = true;
      }
    }
    if (!changed) {
      return res.status(400).json({ error: "没有需要修改的接驳字段" });
    }
    item.legAutoMatched = false;
    await repo.save(item);
    res.json(item);
  })
);

// 确认城际草稿：置 matched=false，可同时修正方式/时间等
router.patch(
  "/transportations/:id/confirm",
  requireTripEditor,
  asyncHandler(async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(Transportation);
    const item = await repo.findOne({
      where: { id: req.params.id, tripId: req.params.tripId },
    });
    if (!item) return res.status(404).json({ error: "交通记录不存在" });

    const body = req.body as Record<string, unknown>;
    for (const k of CONFIRM_FIELDS) {
      if (body[k] !== undefined) {
        (item as any)[k] = body[k];
      }
    }
    item.matched = false;
    await repo.save(item);
    res.json(item);
  })
);

export default router;
