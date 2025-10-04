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
  startTime: '2025-10-04T15:55:15',

  // 维护结束时间（ISO 8601 格式）
  endTime: '2025-10-04T16:55:15',

  // 提前多少天显示维护预告横幅（例如：3 表示提前3天显示）
  preNoticeDays: 999,

  // 维护期间显示的标题
  title: '测试维护通知',

  // 维护期间显示的消息内容（支持 HTML）
  message: `
测试维护消息（此测试不会真正进入维护）
  `,

  // 维护预告横幅消息（支持 HTML）
  bannerMessage: `

    <strong>🧪 测试横幅：</strong>
    这是预告横幅的测试效果。<br/>
    在正式维护前，此橙色横幅会显示在页面顶部。<br/>
    用户可以点击右侧 <strong>✕</strong> 关闭，关闭后不再显示。
  
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
