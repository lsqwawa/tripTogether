import type { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../database";
import { TripMember } from "../entities/TripMember";
import { verifyToken } from "../config/auth";
import { asyncHandler } from "./asyncHandler";

/**
 * 校验 Authorization: Bearer <token>。失败返回 401。
 * 成功后在 req.user 上挂载当前用户身份。
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "未登录或登录已过期" });
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, nickname: payload.nickname };
    next();
  } catch {
    return res.status(401).json({ error: "未登录或登录已过期" });
  }
}

/**
 * 校验当前登录用户是否为该 trip 的成员（读/写均需要）。
 * 在挂载了 authenticate 之后使用，依赖 req.params.tripId 与 req.user.id。
 */
export const requireTripMember = asyncHandler(async (req, res, next) => {
  const userId = req.user!.id;
  const tripId = req.params.tripId;

  const member = await AppDataSource.getRepository(TripMember).findOne({
    where: { tripId, userId },
  });
  if (!member) {
    return res.status(403).json({ error: "你不是该计划的成员，无权访问" });
  }
  req.tripMember = member;
  next();
});

/**
 * 校验当前成员具有编辑权限（owner / editor），viewer 仅可读。
 * 必须挂在 requireTripMember 之后，依赖其注入的 req.tripMember。
 */
export const requireTripEditor = asyncHandler(async (req, res, next) => {
  const member = req.tripMember;
  if (!member) {
    return res.status(403).json({ error: "你不是该计划的成员，无权访问" });
  }
  // 白名单式：仅 owner / editor 可写；未来新增角色（如 guest）默认无写权限
  if (member.role !== "owner" && member.role !== "editor") {
    return res.status(403).json({ error: "仅计划创建者或编辑者可修改行程" });
  }
  next();
});

/**
 * 校验当前登录用户是否为该 trip 的 owner（创建者）。
 * 用于修改/删除计划等高危操作。
 */
export const requireTripOwner = asyncHandler(async (req, res, next) => {
  const userId = req.user!.id;
  const tripId = req.params.tripId;

  const member = await AppDataSource.getRepository(TripMember).findOne({
    where: { tripId, userId },
  });
  if (!member) {
    return res.status(403).json({ error: "你不是该计划的成员，无权访问" });
  }
  if (member.role !== "owner") {
    return res.status(403).json({ error: "仅计划创建者可以执行此操作" });
  }
  req.tripMember = member;
  next();
});
