import jwt from "jsonwebtoken";

const DEFAULT_EXPIRES_IN = "7d";

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET 未配置，请在 .env 中设置");
  }
  return secret;
}

export interface AuthTokenPayload {
  sub: string;
  nickname?: string;
}

/**
 * 签发 JWT。payload 中包含用户 id（sub）与昵称。
 */
export function signToken(user: { id: string; nickname?: string }): string {
  return jwt.sign(
    { sub: user.id, nickname: user.nickname },
    getSecret(),
    {
      expiresIn: (process.env.JWT_EXPIRES_IN ||
        DEFAULT_EXPIRES_IN) as jwt.SignOptions["expiresIn"],
    }
  );
}

/**
 * 校验 JWT，返回 payload。失败（过期/伪造）抛错，由调用方转成 401。
 */
export function verifyToken(
  token: string
): AuthTokenPayload & { iat: number; exp: number } {
  const decoded = jwt.verify(token, getSecret());
  const payload = decoded as jwt.JwtPayload;
  return {
    sub: payload.sub as string,
    nickname: payload.nickname as string | undefined,
    iat: payload.iat as number,
    exp: payload.exp as number,
  };
}
