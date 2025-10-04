'use client';

import { useMaintenanceStatus } from '../hooks/useMaintenanceStatus';
import { MaintenanceOverlay } from './MaintenanceOverlay';

interface MaintenanceProviderProps {
  children: React.ReactNode;
}

/**
 * 维护模式提供者
 * 自动检测维护状态并显示相应的 UI
 */
export function MaintenanceProvider({ children }: MaintenanceProviderProps) {
  const { isInMaintenance, config } = useMaintenanceStatus();

  if (isInMaintenance) {
    return (
      <MaintenanceOverlay
        title={config.title}
        message={config.message}
        startTime={config.startTime}
        endTime={config.endTime}
      />
    );
  }

  return <>{children}</>;
}
