import { Router, Request, Response } from "express";
import { AppDataSource } from "../database";
import { User } from "../entities/User";
import { TripMember } from "../entities/TripMember";
import crypto from "crypto";
import { signToken } from "../config/auth";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { toSafeUser } from "../utils/safeUser";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// 注册（昵称 + 密码）→ 签发 JWT
router.post(
  "/register",
  asyncHandler(async (req: Request, res: Response) => {
    const { nickname, password } = req.body;
    if (!nickname || !nickname.trim()) {
      return res.status(400).json({ error: "请输入昵称" });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ error: "密码至少4位" });
    }

    const trimmed = nickname.trim().slice(0, 20);
    const userRepo = AppDataSource.getRepository(User);

    const existing = await userRepo.findOne({ where: { nickname: trimmed } });
    if (existing) {
      return res.status(409).json({ error: "该昵称已被注册" });
    }

    const user = userRepo.create({
      nickname: trimmed,
      password: hashPassword(password),
    });
    await userRepo.save(user);

    const token = signToken({ id: user.id, nickname: user.nickname });
    res.status(201).json({ user: toSafeUser(user), token });
  })
);

// 登录（昵称 + 密码）→ 签发 JWT
router.post(
  "/login",
  asyncHandler(async (req: Request, res: Response) => {
    const { nickname, password } = req.body;

    if (!nickname || !nickname.trim()) {
      return res.status(400).json({ error: "请输入昵称" });
    }

    const trimmed = nickname.trim().slice(0, 20);
    const userRepo = AppDataSource.getRepository(User);

    const user = await userRepo.findOne({ where: { nickname: trimmed } });
    if (!user) {
      return res.status(404).json({ error: "用户不存在，请先注册" });
    }

    // 若账户设有密码则校验；无密码的存量账户（历史游客）允许直接登录
    if (user.password) {
      if (!password) {
        return res.status(400).json({ error: "请输入密码" });
      }
      if (user.password !== hashPassword(password)) {
        return res.status(401).json({ error: "密码错误" });
      }
    }

    const token = signToken({ id: user.id, nickname: user.nickname });
    res.json({ user: toSafeUser(user), token });
  })
);

// 以下接口需要登录
router.use(authenticate);

// 获取当前用户信息
router.get(
  "/me",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: req.user!.id },
    });
    if (!user) return res.status(404).json({ error: "用户不存在" });
    res.json(toSafeUser(user));
  })
);

// 更新当前用户昵称
router.patch(
  "/me",
  asyncHandler(async (req: Request, res: Response) => {
    const { nickname } = req.body;
    if (!nickname || !nickname.trim()) {
      return res.status(400).json({ error: "昵称不能为空" });
    }
    const trimmed = nickname.trim().slice(0, 20);
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: "用户不存在" });

    const dup = await userRepo.findOne({ where: { nickname: trimmed } });
    if (dup && dup.id !== req.user!.id) {
      return res.status(409).json({ error: "该昵称已被使用" });
    }

    user.nickname = trimmed;
    await userRepo.save(user);
    res.json(toSafeUser(user));
  })
);

// 获取我参与的所有旅行
router.get(
  "/me/trips",
  asyncHandler(async (req: Request, res: Response) => {
    const memberships = await AppDataSource.getRepository(TripMember).find({
      where: { userId: req.user!.id },
      relations: ["trip", "trip.members", "trip.members.user"],
    });
    const trips = memberships.map((m) => m.trip);
    res.json(trips);
  })
);

export default router;
