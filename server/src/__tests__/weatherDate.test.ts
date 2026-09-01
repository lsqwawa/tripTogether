import { describe, it, expect } from "vitest";
import { isValidDate, toISODate, enumerateDates } from "../routes/weatherRoutes";

describe("toISODate（本地日历日，避免 UTC -1 天）", () => {
  it("东八区本地日期不被 toISOString 的 UTC 偏移吞掉一天", () => {
    // 构造本地 2026-01-01 00:30（UTC 可能为前一天），应仍输出本地日
    const d = new Date(2026, 0, 1, 0, 30, 0);
    expect(toISODate(d)).toBe("2026-01-01");
  });

  it("月末/年末正确进位", () => {
    expect(toISODate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("isValidDate（H-4 修复：非法日期返回 400 而非 500）", () => {
  it("合法日期通过", () => {
    expect(isValidDate("2026-08-31")).toBe(true);
    expect(isValidDate("2024-02-29")).toBe(true); // 闰年
  });

  it("非法日期被拒绝（往返相等校验挡掉宽松解析）", () => {
    expect(isValidDate("2026-02-31")).toBe(false); // 不存在的日期
    expect(isValidDate("2026-13-01")).toBe(false); // 非法月份
    expect(isValidDate("abc")).toBe(false); // 非日期
    expect(isValidDate("")).toBe(false);
    expect(isValidDate("2026-8-1")).toBe(false); // 未补零
    expect(isValidDate("2026/08/31")).toBe(false); // 错误分隔符
  });
});

describe("enumerateDates", () => {
  it("闭区间、包含首尾", () => {
    expect(enumerateDates("2026-08-01", "2026-08-03")).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ]);
  });

  it("单日返回长度为 1", () => {
    expect(enumerateDates("2026-08-01", "2026-08-01")).toEqual(["2026-08-01"]);
  });
});
