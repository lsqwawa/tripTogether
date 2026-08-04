import type { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => unknown;

/**
 * 包装 async 路由处理器，把 reject 的 Promise 转给 next(err)，
 * 从而被全局错误中间件统一捕获（Express 4 不会自动捕获 async 异常）。
 */
export const asyncHandler = (handler: AsyncRequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};
