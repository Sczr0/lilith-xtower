'use client';

import { useSyncExternalStore } from 'react';
import { maintenanceConfig } from '../config/maintenance.config';

export interface MaintenanceStatus {
  isInMaintenance: boolean;
  shouldShowBanner: boolean;
  config: typeof maintenanceConfig;
}

/**
 * 维护状态 Hook
 * - 自动检测是否处于维护期/预告期
 * - 仅创建一个全局轮询定时器，避免多个组件重复 setInterval 造成后台成本
 * - 使用 useSyncExternalStore 确保并发渲染与 Hydration 安全
 */
export function useMaintenanceStatus(): MaintenanceStatus {
  return useSyncExternalStore(subscribe, readCurrentStatus, readCurrentStatus);
}

type Listener = () => void;

let listeners: Set<Listener> | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

let currentStatus: MaintenanceStatus = {
  isInMaintenance: false,
  shouldShowBanner: false,
  config: maintenanceConfig,
};

function compute(): MaintenanceStatus {
  if (!maintenanceConfig.enabled) {
    return { isInMaintenance: false, shouldShowBanner: false, config: maintenanceConfig };
  }

  const now = new Date();
  const start = new Date(maintenanceConfig.startTime);
  const end = new Date(maintenanceConfig.endTime);
  const preNoticeTime = new Date(start);
  preNoticeTime.setDate(preNoticeTime.getDate() - maintenanceConfig.preNoticeDays);

  const isInMaintenance = now >= start && now < end;
  const shouldShowBanner = now >= preNoticeTime && now < start;

  return { isInMaintenance, shouldShowBanner, config: maintenanceConfig };
}

function isSame(a: MaintenanceStatus, b: MaintenanceStatus): boolean {
  return (
    a.isInMaintenance === b.isInMaintenance &&
    a.shouldShowBanner === b.shouldShowBanner &&
    a.config === b.config
  );
}

function ensureScheduler() {
  if (intervalId) return;
  intervalId = setInterval(tick, 60000);
}

function maybeStopScheduler() {
  if (!intervalId) return;
  if (listeners && listeners.size > 0) return;
  clearInterval(intervalId);
  intervalId = null;
}

function emit() {
  if (!listeners || listeners.size === 0) return;
  for (const l of listeners) {
    try {
      l();
    } catch {
      // 忽略订阅方异常，避免影响全局轮询
    }
  }
}

function readCurrentStatus(): MaintenanceStatus {
  return currentStatus;
}

function subscribe(listener: Listener): () => void {
  if (!listeners) listeners = new Set();
  listeners.add(listener);
  ensureScheduler();

  // 订阅时检查一次最新状态
  tick();

  return () => {
    listeners?.delete(listener);
    maybeStopScheduler();
  };
}

function tick() {
  const next = compute();
  if (isSame(currentStatus, next)) return;
  currentStatus = next;
  emit();
}

