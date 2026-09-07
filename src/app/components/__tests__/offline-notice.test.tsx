// @vitest-environment jsdom

import React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { OfflineNotice } from "../OfflineNotice";

describe("OfflineNotice", () => {
  let online: boolean;

  beforeEach(() => {
    online = true;
    Object.defineProperty(window.navigator, "onLine", {
      get: () => online,
      configurable: true,
    });
  });

  it("离线时展示轻量提示，恢复联网后自动消失", async () => {
    render(<OfflineNotice />);

    // 默认在线：不展示
    expect(screen.queryByRole("status")).toBeNull();

    // 触发离线事件（navigator.onLine 同步变为 false）
    online = false;
    window.dispatchEvent(new Event("offline"));
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByText(/离线状态/)).toBeTruthy();

    // 恢复在线
    online = true;
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("收到 Service Worker 的缓存回退消息时展示，收到恢复消息时隐藏", async () => {
    render(<OfflineNotice />);

    // SW：导航回退到缓存 → 展示（即便 navigator.onLine 仍为 true）
    window.dispatchEvent(
      new MessageEvent("message", { data: { type: "OFFLINE_FALLBACK", url: "/" } }),
    );
    expect(await screen.findByRole("status")).toBeTruthy();

    // SW：网络恢复 → 隐藏
    window.dispatchEvent(
      new MessageEvent("message", { data: { type: "NETWORK_OK", url: "/" } }),
    );
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });
});
