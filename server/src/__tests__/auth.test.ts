import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "../config/auth";
import { toSafeUser } from "../utils/safeUser";

// 这些纯函数是鉴权基础设施的核心，用单测锁住行为，避免回归。
describe("auth 工具", () => {
  it("signToken 签发 + verifyToken 校验可往返", () => {
    const token = signToken({ id: "u1", nickname: "neo" });
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT 三段式

    const payload = verifyToken(token);
    expect(payload.sub).toBe("u1");
    expect(payload.nickname).toBe("neo");
    expect(typeof payload.exp).toBe("number");
  });

  it("verifyToken 对伪造 token 抛错（将转为 401）", () => {
    expect(() => verifyToken("not.a.valid.token")).toThrow();
  });

  it("缺 JWT_SECRET 时 signToken 抛错", () => {
    const prev = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => signToken({ id: "x" })).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = prev;
  });
});

describe("toSafeUser 脱敏", () => {
  it("剔除 password 等敏感字段", () => {
    const user = {
      id: "u1",
      nickname: "neo",
      password: "should-not-leak",
      avatar: null,
      createdAt: new Date(),
    } as any;
    const safe = toSafeUser(user);
    expect(safe).not.toHaveProperty("password");
    expect(safe.id).toBe("u1");
    expect(safe.nickname).toBe("neo");
    expect(safe.avatar).toBeNull();
  });
});
