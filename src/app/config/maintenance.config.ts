/**
 * 维护模式配置
 * 
 * 使用说明：
 * 1. 修改 enabled 为 true 启用维护模式检查
 * 2. 设置 startTime 和 endTime 指定维护时间段
 * 3. 设置 preNoticeDays 决定提前多少天显示预告横幅
 * 4. 自定义 title、message 和 bannerMessage 文本
 */

export interface MaintenanceConfig {
  enabled: boolean;
  startTime: string;
  endTime: string;
  preNoticeDays: number;
  title: string;
  message: string;
  bannerMessage: string;
}

export const maintenanceConfig: MaintenanceConfig = {
  // 是否启用维护模式检查（true: 启用, false: 禁用）
  enabled: true,

  // 维护开始时间（ISO 8601 格式：YYYY-MM-DDTHH:mm:ss）
  // 示例：'2025-01-20T09:00:00' 表示 2025年1月20日 09:00
  startTime: '2025-10-10T17:00:00',

  // 维护结束时间（ISO 8601 格式）
  endTime: '2025-10-10T19:00:00',

  // 提前多少天显示维护预告横幅（例如：3 表示提前3天显示）
  preNoticeDays: 7,

  // 维护期间显示的标题
  title: '更新维护通知',

  // 维护期间显示的消息内容（支持 HTML）
  message: `
受Phigros更新影响，本服务将于<strong>2025年10月10日 17:00（UTC+8）</strong>开始例行维护。<br>预计恢复时间：<strong>2025年10月10日 19:00（UTC+8）</strong>，<br>若遇Phigros延迟更新情况，维护恢复时间将顺延。
  `,

  // 维护预告横幅消息（支持 HTML）
  bannerMessage: `
受Phigros更新影响，本服务将于<strong>2025年10月10日 17:00（UTC+8）</strong>开始例行维护。<br>预计恢复时间：<strong>2025年10月10日 19:00（UTC+8）</strong>，<br>若遇Phigros延迟更新情况，维护恢复时间将顺延。
  `,
};

/**
 * 检查当前是否在维护期间
 */
export function isInMaintenance(): boolean {
  if (!maintenanceConfig.enabled) {
    return false;
  }

  const now = new Date();
  const start = new Date(maintenanceConfig.startTime);
  const end = new Date(maintenanceConfig.endTime);

  return now >= start && now < end;
}

/**
 * 检查是否应该显示维护预告横幅
 */
export function shouldShowMaintenanceBanner(): boolean {
  if (!maintenanceConfig.enabled) {
    return false;
  }

  const now = new Date();
  const start = new Date(maintenanceConfig.startTime);
  const preNoticeTime = new Date(start);
  preNoticeTime.setDate(preNoticeTime.getDate() - maintenanceConfig.preNoticeDays);

  return now >= preNoticeTime && now < start;
}
