import { Router, Request, Response } from "express";
import { AppDataSource } from "../database";
import { Trip } from "../entities/Trip";
import { TripMember } from "../entities/TripMember";
import { DailySchedule } from "../entities/DailySchedule";
import { customAlphabet } from "nanoid";
import { authenticate, requireTripMember, requireTripOwner } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { sortTripSchedules } from "../utils/tripSort";

const router = Router();
const generateInviteCode = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  8
);

// 该路由组下所有接口都需要登录
router.use(authenticate);

// 获取当前用户的所有旅行计划
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const memberRepo = AppDataSource.getRepository(TripMember);
    const memberships = await memberRepo.find({
      where: { userId: req.user!.id },
      relations: ["trip", "trip.members", "trip.members.user"],
    });
    res.json(memberships.map((m) => m.trip));
  })
);

// 获取单个旅行计划详情（成员可见）
router.get(
  "/:tripId",
  requireTripMember,
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await AppDataSource.getRepository(Trip).findOne({
      where: { id: req.params.tripId },
      relations: [
        "members",
        "members.user",
        "transportations",
        "accommodations",
        "schedules",
        "schedules.items",
        "expenses",
      ],
    });
    if (!trip) {
      return res.status(404).json({ error: "旅行计划不存在" });
    }
    sortTripSchedules(trip);
    res.json(trip);
  })
);

// 创建旅行计划（登录用户即 owner）
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { title, description, startDate, endDate, destination, coverImage } =
      req.body;

    if (!title || !startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "请填写标题、开始日期和结束日期" });
    }

    const tripRepo = AppDataSource.getRepository(Trip);

    // 事务包裹：trip + owner 成员 + N 天日程，中途失败整体回滚，避免脏数据
    const tripId = await AppDataSource.transaction(async (manager) => {
      const trip = manager.create(Trip, {
        title,
        description,
        startDate,
        endDate,
        destination,
        coverImage,
        inviteCode: generateInviteCode(),
        status: "planning",
      });
      await manager.save(trip);

      const member = manager.create(TripMember, {
        tripId: trip.id,
        userId,
        role: "owner",
      });
      await manager.save(member);

      const start = new Date(startDate);
      const end = new Date(endDate);
      const dayCount =
        Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
        1;

      for (let i = 0; i < dayCount; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        const schedule = manager.create(DailySchedule, {
          tripId: trip.id,
          dayIndex: i + 1,
          date: date.toISOString().split("T")[0],
          title: `第${i + 1}天`,
        });
        await manager.save(schedule);
      }

      return trip.id;
    });

    const fullTrip = await tripRepo.findOne({
      where: { id: tripId },
      relations: ["members", "members.user", "schedules", "schedules.items"],
    });
    res.status(201).json(fullTrip);
  })
);

// 通过邀请码加入计划（登录用户）
router.post(
  "/join",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ error: "请输入邀请码" });
    }

    const tripRepo = AppDataSource.getRepository(Trip);
    const memberRepo = AppDataSource.getRepository(TripMember);

    const trip = await tripRepo.findOne({ where: { inviteCode } });
    if (!trip) {
      return res.status(404).json({ error: "邀请码无效" });
    }

    const existing = await memberRepo.findOne({
      where: { tripId: trip.id, userId },
    });
    if (existing) {
      return res.json({ trip, alreadyMember: true });
    }

    const member = memberRepo.create({
      tripId: trip.id,
      userId,
      role: "editor",
    });
    await memberRepo.save(member);

    res.status(201).json({ trip, alreadyMember: false });
  })
);

// 更新旅行计划基本信息（仅 owner）
router.patch(
  "/:tripId",
  requireTripOwner,
  asyncHandler(async (req: Request, res: Response) => {
    const tripRepo = AppDataSource.getRepository(Trip);
    const trip = await tripRepo.findOne({
      where: { id: req.params.tripId },
    });
    if (!trip) {
      return res.status(404).json({ error: "旅行计划不存在" });
    }

    const {
      title,
      description,
      startDate,
      endDate,
      destination,
      coverImage,
      status,
      budgetTotal,
    } = req.body;

    Object.assign(trip, {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(startDate !== undefined && { startDate }),
      ...(endDate !== undefined && { endDate }),
      ...(destination !== undefined && { destination }),
      ...(coverImage !== undefined && { coverImage }),
      ...(status !== undefined && { status }),
      ...(budgetTotal !== undefined && { budgetTotal }),
    });

    await tripRepo.save(trip);
    res.json(trip);
  })
);

// 删除旅行计划（仅 owner，级联删除成员/日程/交通/住宿/费用）
router.delete(
  "/:tripId",
  requireTripOwner,
  asyncHandler(async (req: Request, res: Response) => {
    const tripRepo = AppDataSource.getRepository(Trip);
    const result = await tripRepo.delete(req.params.tripId);
    if (result.affected === 0) {
      return res.status(404).json({ error: "旅行计划不存在" });
    }
    res.status(204).send();
  })
);

// 获取计划成员列表（成员可见）
router.get(
  "/:tripId/members",
  requireTripMember,
  asyncHandler(async (req: Request, res: Response) => {
    const members = await AppDataSource.getRepository(TripMember).find({
      where: { tripId: req.params.tripId },
      relations: ["user"],
    });
    res.json(members);
  })
);

// 修改成员角色（仅 owner；可在 editor / viewer 间切换）
router.patch(
  "/:tripId/members/:memberId",
  requireTripOwner,
  asyncHandler(async (req: Request, res: Response) => {
    const { role } = req.body;
    if (!["editor", "viewer"].includes(role)) {
      return res
        .status(400)
        .json({ error: "角色仅支持 editor / viewer（创建者身份不可转让）" });
    }

    const memberRepo = AppDataSource.getRepository(TripMember);
    const target = await memberRepo.findOne({
      where: { id: req.params.memberId, tripId: req.params.tripId },
    });
    if (!target) {
      return res.status(404).json({ error: "成员不存在" });
    }
    if (target.role === "owner") {
      return res.status(403).json({ error: "不能修改创建者的角色" });
    }
    if (target.userId === req.user!.id) {
      return res.status(403).json({ error: "不能修改自己的角色" });
    }

    target.role = role;
    await memberRepo.save(target);
    const updated = await memberRepo.findOne({
      where: { id: target.id },
      relations: ["user"],
    });
    res.json(updated);
  })
);

// 移除成员（仅 owner；不可移除创建者，也不可移除自己）
router.delete(
  "/:tripId/members/:memberId",
  requireTripOwner,
  asyncHandler(async (req: Request, res: Response) => {
    const memberRepo = AppDataSource.getRepository(TripMember);
    const target = await memberRepo.findOne({
      where: { id: req.params.memberId, tripId: req.params.tripId },
    });
    if (!target) {
      return res.status(404).json({ error: "成员不存在" });
    }
    if (target.role === "owner") {
      return res.status(403).json({ error: "不能移除创建者" });
    }
    if (target.userId === req.user!.id) {
      return res.status(403).json({ error: "不能移除自己，请转让或解散计划" });
    }

    await memberRepo.remove(target);
    res.status(204).send();
  })
);

export default router;
