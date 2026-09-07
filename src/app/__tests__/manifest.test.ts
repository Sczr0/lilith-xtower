import { describe, expect, it } from "vitest";
import manifest from "../manifest";

describe("manifest (PWA web app manifest)", () => {
  it("exposes the required installability fields", () => {
    const m = manifest();

    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBeTruthy();
    expect(m.background_color).toBeTruthy();
    expect(m.lang).toBe("zh-CN");
    // id 应为规范化后的站点根 URL，利于迁移时保持 PWA 身份稳定
    expect(m.id).toMatch(/^https?:\/\/.+\/$/);
  });

  it("declares 192/512 any icons and a 512 maskable icon", () => {
    const icons = manifest().icons ?? [];

    const anySizes = new Set(
      icons.filter((i) => !i.purpose || i.purpose === "any").map((i) => i.sizes),
    );
    expect(anySizes.has("192x192")).toBe(true);
    expect(anySizes.has("512x512")).toBe(true);

    expect(
      icons.some((i) => i.purpose === "maskable" && i.sizes === "512x512"),
    ).toBe(true);

    // 每张图标必须是 PNG，且指向存在的路径
    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
      expect(icon.src).toMatch(/^\/icons\//);
    }
  });
});
