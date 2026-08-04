/**
 * @deprecated 该中间件已废弃（2026-08-04）。
 *
 * 旧实现直接信任客户端传来的 `x-user-id` 请求头作为用户身份，
 * 可被任意伪造，属于严重安全漏洞。已被基于 JWT 的真实鉴权取代：
 *   - 见 src/middleware/auth.ts（authenticate / requireTripMember / requireTripOwner）
 *   - 接口登录态由 Authorization: Bearer <token> 携带
 *
 * 本文件不再被任何路由引用，请勿再 import。若误引用将在编译期报错。
 */
