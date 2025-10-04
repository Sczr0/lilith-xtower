'use client';

import { useMaintenanceStatus } from '../hooks/useMaintenanceStatus';
import { MaintenanceBanner } from './MaintenanceBanner';
import { MaintenanceOverlay } from './MaintenanceOverlay';

interface MaintenanceProviderProps {
  children: React.ReactNode;
}

/**
 * 维护模式提供者
 * 自动检测维护状态并显示相应的 UI
 */
export function MaintenanceProvider({ children }: MaintenanceProviderProps) {
  const { isInMaintenance, shouldShowBanner, config } = useMaintenanceStatus();

  return (
    <>
      {/* 维护预告横幅 */}
      {shouldShowBanner && !isInMaintenance && (
        <MaintenanceBanner message={config.bannerMessage} />
      )}

      {/* 维护全屏覆盖 */}
      {isInMaintenance ? (
        <MaintenanceOverlay
          title={config.title}
          message={config.message}
          startTime={config.startTime}
          endTime={config.endTime}
        />
      ) : (
        <>
          {/* 如果显示横幅，添加顶部间距 */}
          {shouldShowBanner && <div className="h-[52px]" />}
          {children}
        </>
      )}
    </>
  );
}
