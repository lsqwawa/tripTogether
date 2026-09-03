import type { AxiosError } from "axios";

// 后端统一以 { error: string } 返回业务错误
type ApiError = AxiosError<{ error?: string }>;

/** 提取接口错误文案；取不到时用 fallback。校验错误须由调用方先用 isValidationError 排除 */
export function getErrorMessage(e: unknown, fallback = "操作失败"): string {
  const err = e as ApiError | undefined;
  return err?.response?.data?.error || fallback;
}

/** antd 表单校验失败会抛出带 errorFields 的对象，此时不应弹全局错误提示 */
export function isValidationError(e: unknown): boolean {
  return Array.isArray((e as { errorFields?: unknown[] } | undefined)?.errorFields);
}

/** 请求已到达后端且返回 4xx：这类错误通常已在后端/UI 侧拦截，无需重复提示 */
export function isHandledStatus(e: unknown, status: number): boolean {
  return (e as ApiError | undefined)?.response?.status === status;
}
