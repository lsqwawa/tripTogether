import "express";
import type { TripMember } from "../entities/TripMember";

declare global {
  namespace Express {
    interface Request {
      /** 由 authenticate 中间件注入的当前登录用户 */
      user?: { id: string; nickname?: string };
      /** 由 requireTripMember / requireTripOwner 注入的当前成员关系 */
      tripMember?: TripMember;
    }
  }
}

export {};
