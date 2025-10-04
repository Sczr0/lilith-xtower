'use client';

import { useState, useEffect } from 'react';
import { maintenanceConfig } from '../config/maintenance.config';

export interface MaintenanceStatus {
  isInMaintenance: boolean;
  shouldShowBanner: boolean;
  config: typeof maintenanceConfig;
}

/**
 * 维护状态 Hook
 * 自动检测当前是否在维护期或预告期
 * 每分钟自动刷新一次状态
 */
export function useMaintenanceStatus(): MaintenanceStatus {
  const [status, setStatus] = useState<MaintenanceStatus>(() => ({
    isInMaintenance: false,
    shouldShowBanner: false,
    config: maintenanceConfig,
  }));

  useEffect(() => {
    const checkMaintenanceStatus = () => {
      if (!maintenanceConfig.enabled) {
        setStatus({
          isInMaintenance: false,
          shouldShowBanner: false,
          config: maintenanceConfig,
        });
        return;
      }

      const now = new Date();
      const start = new Date(maintenanceConfig.startTime);
      const end = new Date(maintenanceConfig.endTime);
      const preNoticeTime = new Date(start);
      preNoticeTime.setDate(preNoticeTime.getDate() - maintenanceConfig.preNoticeDays);

      const isInMaintenance = now >= start && now < end;
      const shouldShowBanner = now >= preNoticeTime && now < start;

      setStatus({
        isInMaintenance,
        shouldShowBanner,
        config: maintenanceConfig,
      });
    };

    // 初始检查
    checkMaintenanceStatus();

    // 每分钟检查一次
    const interval = setInterval(checkMaintenanceStatus, 60000);

    return () => clearInterval(interval);
  }, []);

  return status;
}
