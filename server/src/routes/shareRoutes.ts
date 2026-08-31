import { Router, Request, Response, NextFunction } from "express";
import { AppDataSource } from "../database";
import { Trip } from "../entities/Trip";
import { sortTripSchedules } from "../utils/tripSort";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

// 邀请码仅 8 位，可被枚举爆破：按 IP 限流（滑动窗口近似为固定窗口）
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 60;
const hits = new Map<string, { count: number; resetAt: number }>();

function shareRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || "unknown";
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now > rec.resetAt) {
    if (hits.size > 10000) hits.clear();
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }
  rec.count++;
  if (rec.count > MAX_HITS) {
    return res.status(429).json({ error: "请求过于频繁，请稍后再试" });
  }
  next();
}

// 公开只读：通过邀请码查看行程（零门槛协作，免登录）
// 挂在 /api/trips/share，不受 authenticate 保护
// 脱敏原则：不返回花费（含成员出资明细）、不返回任何用户 UUID，成员仅保留昵称与头像
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
      ...trip,
      members: (trip.members || []).map((m) => ({
        id: m.id,
        role: m.role,
        user: {
          nickname: m.user?.nickname || "未知",
          avatar: m.user?.avatar ?? null,
        },
      })),
    });
  })
);

export default router;
