import { Router, Request, Response } from "express";
import { AppDataSource } from "../database";
import { Trip } from "../entities/Trip";
import { sortTripSchedules } from "../utils/tripSort";
import { asyncHandler } from "../middleware/asyncHandler";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();

// 邀请码仅 8 位，可被枚举爆破：按 IP 限流（滑动窗口近似为固定窗口）
const shareRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  keyPrefix: "share:",
  message: "请求过于频繁，请稍后再试",
});

// 公开只读：通过邀请码查看行程（零门槛协作，免登录）
// 挂在 /api/trips/share，不受 authenticate 保护
//
// 脱敏原则：白名单输出，只吐出分享页真正渲染的字段。
// 明确不外泄：
//   - Expense 表（含 payerId / participantIds 等成员 UUID 与出资明细）
//   - 用户 UUID：成员只保留昵称与头像
//   - bookingInfo（订单号/座位号/确认码）与 notes（私人备注）
//   - 交通匹配的内部字段（polyline / fromItemId / toItemId / matched 等）
//   - budgetTotal（行程总预算）
// 注：inviteCode 与各项 cost 是分享页要渲染的内容（访客本就持有邀请码），予以保留。
router.get(
  "/:inviteCode",
  shareRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await AppDataSource.getRepository(Trip).findOne({
      where: { inviteCode: req.params.inviteCode },
      relations: [
        "members",
        "members.user",
        "transportations",
        "accommodations",
        "schedules",
        "schedules.items",
      ],
    });
    if (!trip) {
      return res.status(404).json({ error: "行程不存在" });
    }
    sortTripSchedules(trip);

    res.json({
      id: trip.id,
      title: trip.title,
      description: trip.description,
      startDate: trip.startDate,
      endDate: trip.endDate,
      destination: trip.destination,
      coverImage: trip.coverImage,
      status: trip.status,
      inviteCode: trip.inviteCode,
      members: (trip.members || []).map((m) => ({
        id: m.id,
        role: m.role,
        user: {
          nickname: m.user?.nickname || "未知",
          avatar: m.user?.avatar ?? null,
        },
      })),
      transportations: (trip.transportations || []).map((t) => ({
        id: t.id,
        type: t.type,
        transportType: t.transportType,
        departurePlace: t.departurePlace,
        arrivalPlace: t.arrivalPlace,
        departureTime: t.departureTime,
        arrivalTime: t.arrivalTime,
        status: t.status,
        cost: t.cost,
        depLat: t.depLat,
        depLng: t.depLng,
        arrLat: t.arrLat,
        arrLng: t.arrLng,
      })),
      accommodations: (trip.accommodations || []).map((a) => ({
        id: a.id,
        name: a.name,
        address: a.address,
        checkInDate: a.checkInDate,
        checkOutDate: a.checkOutDate,
        status: a.status,
        cost: a.cost,
        lat: a.lat,
        lng: a.lng,
      })),
      schedules: (trip.schedules || []).map((s) => ({
        id: s.id,
        dayIndex: s.dayIndex,
        date: s.date,
        items: (s.items || []).map((i) => ({
          id: i.id,
          type: i.type,
          title: i.title,
          startTime: i.startTime,
          endTime: i.endTime,
          locationName: i.locationName,
          lat: i.lat,
          lng: i.lng,
          cost: i.cost,
          transportToNext: i.transportToNext,
          status: i.status,
          imageUrl: i.imageUrl,
        })),
      })),
    });
  })
);

export default router;
