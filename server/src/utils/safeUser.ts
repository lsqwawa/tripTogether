import type { User } from "../entities/User";

export interface SafeUser {
  id: string;
  nickname: string;
  avatar: string | null;
  createdAt: Date;
}

/**
 * 把 User 实体转换为对外安全对象，剔除 password 等敏感字段。
 */
export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    nickname: user.nickname,
    avatar: user.avatar ?? null,
    createdAt: user.createdAt,
  };
}
