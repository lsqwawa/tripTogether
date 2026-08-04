import { Router, Request, Response } from "express";
import { AppDataSource } from "../database";
import { Trip } from "../entities/Trip";
import { sortTripSchedules } from "../utils/tripSort";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

// 公开只读：通过邀请码查看行程（零门槛协作，免登录）
// 挂在 /api/trips/share，不受 authenticate 保护
router.get(
  "/:inviteCode",
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
        "expenses",
      ],
    });
    if (!trip) {
      return res.status(404).json({ error: "行程不存在" });
    }
    sortTripSchedules(trip);
    res.json(trip);
  })
);

export default router;
