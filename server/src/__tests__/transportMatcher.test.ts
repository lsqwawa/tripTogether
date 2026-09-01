import { describe, it, expect } from "vitest";
import {
  haversineM,
  buildMatchPairs,
  buildLegSummary,
  matchTransportPairs,
  suggestIntercityType,
  type SequenceItem,
} from "../services/transportMatcher";

function item(
  id: string,
  lat: number,
  lng: number,
  dayIndex = 0
): SequenceItem {
  return { id, dayIndex, sortOrder: 0, title: id, lat, lng };
}

describe("haversineM", () => {
  it("同一点距离为 0", () => {
    expect(haversineM({ lat: 39.9, lng: 116.4 }, { lat: 39.9, lng: 116.4 })).toBe(0);
  });

  it("北京→上海约 1000km 量级", () => {
    const d = haversineM({ lat: 39.9042, lng: 116.4074 }, { lat: 31.2304, lng: 121.4737 });
    expect(d).toBeGreaterThan(1_000_000); // >1000km
    expect(d).toBeLessThan(1_200_000);
  });
});

describe("buildMatchPairs", () => {
  it("相邻对数量 = N-1，不再携带 crossDay 字段", () => {
    const seq = [item("a", 1, 1), item("b", 2, 2), item("c", 3, 3)];
    const pairs = buildMatchPairs(seq);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toHaveProperty("a");
    expect(pairs[0]).toHaveProperty("b");
    expect(pairs[0]).not.toHaveProperty("crossDay");
  });
});

describe("buildLegSummary", () => {
  it("步行文案含分钟与距离", () => {
    expect(buildLegSummary("walking", 500, 7)).toContain("步行");
    expect(buildLegSummary("driving", 3200, 12)).toContain("驾车");
  });
});

describe("suggestIntercityType", () => {
  it("短程推荐火车，长程推荐飞机", () => {
    expect(suggestIntercityType(200_000)).toBe("train");
    expect(suggestIntercityType(800_000)).toBe("flight");
  });
});

describe("matchTransportPairs（无 Key 全降级路径，对应 M-3 入参来源）", () => {
  it("近距相邻项生成 1 条接驳，via=fallback", async () => {
    const out = await matchTransportPairs(
      buildMatchPairs([item("a", 39.9042, 116.4074), item("b", 39.91, 116.41)]),
      undefined
    );
    expect(out.legs).toHaveLength(1);
    expect(out.legs[0].via).toBe("fallback");
    expect(out.legs[0].legDistanceM).toBeGreaterThan(0);
    expect(out.intercity).toHaveLength(0);
    expect(out.skippedNoCoord).toBe(0);
  });

  it(">100km 生成城际草稿（flight），不生成市内接驳", async () => {
    const out = await matchTransportPairs(
      buildMatchPairs([item("a", 39.9042, 116.4074), item("b", 31.2304, 121.4737)]),
      undefined
    );
    expect(out.intercity).toHaveLength(1);
    expect(out.intercity[0].transportType).toBe("flight");
    expect(out.legs).toHaveLength(0);
  });

  it("缺坐标的相邻项计入 skippedNoCoord，不报错", async () => {
    const out = await matchTransportPairs(
      buildMatchPairs([item("a", 39.9, 116.4), { ...item("b", 0, 0), lat: null, lng: null }]),
      undefined
    );
    expect(out.skippedNoCoord).toBe(1);
    expect(out.legs).toHaveLength(0);
    expect(out.intercity).toHaveLength(0);
  });
});
