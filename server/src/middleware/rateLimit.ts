import { Request, Response, NextFunction } from "express";

type Hit = { count: number; resetAt: number };

export type RateLimitOptions = {
  /** 窗口长度（毫秒） */
  windowMs: number;
  /** 窗口内允许的最大请求数 */
  max: number;
  /** 桶数量上限，超出后整体清空，避免内存无界增长 */
  maxKeys?: number;
  /** 与其它限流共用进程内 Map 时的命名空间前缀 */
  keyPrefix?: string;
  message?: string;
};

/**
 * 进程内固定窗口限流。
 *
 * 已知限制（部署相关，非实现缺陷）：
 * - 计数只在单进程内有效，多实例部署时配额按实例数放大；
 * - 依赖 req.ip，反向代理后需配合 app.set("trust proxy") 才能拿到真实客户端 IP。
 *
 * 后续若要跨实例生效，只需把这里的 hits 换成 Redis，调用方无需改动。
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    maxKeys = 10_000,
    keyPrefix = "",
    message = "请求过于频繁，请稍后再试",
  } = options;
  const hits = new Map<string, Hit>();

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const key = keyPrefix + (req.ip || "unknown");
    const now = Date.now();
    const rec = hits.get(key);

    if (!rec || now > rec.resetAt) {
      if (hits.size > maxKeys) hits.clear();
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    rec.count++;
    if (rec.count > max) {
      return res.status(429).json({ error: message });
    }
    next();
  };
}
