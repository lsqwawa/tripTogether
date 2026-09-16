import { describe, it, expect } from "vitest";
import { textToIcon, nearestCityCode } from "../routes/weatherRoutes";

describe("textToIcon（中国天气网文案 → emoji，恶劣优先）", () => {
  it("基础天气", () => {
    expect(textToIcon("晴")).toBe("☀️");
    expect(textToIcon("多云")).toBe("⛅");
    expect(textToIcon("阴")).toBe("☁️");
  });

  it("「X转Y」取更恶劣一侧", () => {
    expect(textToIcon("晴转多云")).toBe("⛅");
    expect(textToIcon("阴转雨")).toBe("🌧️");
    expect(textToIcon("多云转雷阵雨")).toBe("⛈️");
  });

  it("降水按类型与强度", () => {
    expect(textToIcon("阵雨")).toBe("🌦️");
    expect(textToIcon("小雨")).toBe("🌧️");
    expect(textToIcon("暴雨")).toBe("🌧️");
    expect(textToIcon("雷阵雨")).toBe("⛈️");
    expect(textToIcon("雨夹雪")).toBe("🌨️");
    expect(textToIcon("中雪")).toBe("🌨️");
    expect(textToIcon("暴雪")).toBe("❄️");
  });

  it("低能见度与沙尘", () => {
    expect(textToIcon("霾")).toBe("😷");
    expect(textToIcon("雾")).toBe("🌫️");
    expect(textToIcon("扬沙")).toBe("🌪️");
    expect(textToIcon("浮尘")).toBe("🌪️");
  });

  it("空文案（40 天档仅气温）回退默认图标", () => {
    expect(textToIcon("")).toBe("🌡️");
  });
});

describe("nearestCityCode（经纬度 → 中国天气网城市码，离线就近匹配）", () => {
  it("主要城市坐标命中对应城市码", () => {
    expect(nearestCityCode(30.287459, 120.153576)).toBe("101210101"); // 杭州
    expect(nearestCityCode(39.904989, 116.405285)).toBe("101010100"); // 北京
    expect(nearestCityCode(31.2317, 121.4726)).toBe("101020100"); // 上海
    expect(nearestCityCode(43.7928, 87.6177)).toBe("101130101"); // 乌鲁木齐
  });

  it("城市周边坐标就近归入该城市", () => {
    // 西湖附近（区县级码表下就近命中杭州·西湖区 101210113，而非地级市 101210101）
    expect(nearestCityCode(30.2425, 120.1486)).toBe("101210113");
    // 三亚（18.25, 109.51）
    expect(nearestCityCode(18.2528, 109.5119)).not.toBeNull();
  });

  it("境外坐标返回 null（边界框外）", () => {
    expect(nearestCityCode(35.6812, 139.7671)).toBeNull(); // 东京：经度超框
    expect(nearestCityCode(37.5665, 126.978)).toBeNull(); // 首尔
    expect(nearestCityCode(55.7558, 37.6173)).toBeNull(); // 莫斯科
  });

  it("框内但距最近城市 >300km 返回 null（边境/海上/邻国）", () => {
    expect(nearestCityCode(13.7563, 100.5018)).toBeNull(); // 曼谷
    expect(nearestCityCode(15.0, 117.0)).toBeNull(); // 南海洋面（距三沙永兴岛约 520km）
  });
});
