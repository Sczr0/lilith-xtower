// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallPromptProvider } from "../../contexts/InstallPromptContext";
import { InstallButton } from "../InstallButton";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

beforeEach(() => {
  // 重置为非 iOS UA，避免用例间 userAgent 泄漏
  Object.defineProperty(window.navigator, "userAgent", {
    value: CHROME_UA,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
});

function makeDeferredEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const evt = new Event("beforeinstallprompt");
  (evt as unknown as { prompt: typeof prompt }).prompt = prompt;
  (evt as unknown as { userChoice: Promise<unknown> }).userChoice = Promise.resolve({
    outcome,
    platform: "web",
  });
  return { evt, prompt };
}

describe("InstallButton", () => {
  it("隐藏直到收到 beforeinstallprompt，点击触发原生安装并隐藏按钮", async () => {
    const user = userEvent.setup();
    render(
      <InstallPromptProvider>
        <InstallButton />
      </InstallPromptProvider>,
    );

    // 未触发安装事件前不显示
    expect(screen.queryByRole("button", { name: "安装到桌面" })).toBeNull();

    const { evt, prompt } = makeDeferredEvent("accepted");
    await act(async () => {
      window.dispatchEvent(evt);
    });

    const btn = await screen.findByRole("button", { name: "安装到桌面" });
    expect(btn).toBeTruthy();

    await user.click(btn);
    expect(prompt).toHaveBeenCalledTimes(1);

    // 用户接受安装后（standalone），按钮隐藏
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "安装到桌面" })).toBeNull(),
    );
  });

  it("iOS 下显示“添加到主屏幕”并展示手动添加引导", async () => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: IPHONE_UA,
      configurable: true,
    });

    const user = userEvent.setup();
    render(
      <InstallPromptProvider>
        <InstallButton />
      </InstallPromptProvider>,
    );

    const btn = await screen.findByRole("button", { name: "添加到主屏幕" });
    expect(btn).toBeTruthy();

    await user.click(btn);

    // 出现手动引导说明（分享 → 添加到主屏幕）
    expect(screen.getByText(/在 Safari 中点击底部/)).toBeTruthy();
  });

  it("icon 变体（顶栏）：收到安装事件后显示图标按钮并触发原生安装", async () => {
    const user = userEvent.setup();
    render(
      <InstallPromptProvider>
        <InstallButton variant="icon" />
      </InstallPromptProvider>,
    );

    expect(screen.queryByRole("button", { name: "安装到桌面" })).toBeNull();

    const { evt, prompt } = makeDeferredEvent("accepted");
    await act(async () => {
      window.dispatchEvent(evt);
    });

    const btn = await screen.findByRole("button", { name: "安装到桌面" });
    expect(btn).toBeTruthy();

    await user.click(btn);
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it("icon 变体（顶栏）：iOS 点击后弹出引导浮层", async () => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: IPHONE_UA,
      configurable: true,
    });

    const user = userEvent.setup();
    render(
      <InstallPromptProvider>
        <InstallButton variant="icon" />
      </InstallPromptProvider>,
    );

    const btn = await screen.findByRole("button", { name: "添加到主屏幕" });
    await user.click(btn);

    // 引导以 portal 浮层呈现，仍可被查询到
    expect(screen.getByText(/在 Safari 中点击底部/)).toBeTruthy();
  });
});
