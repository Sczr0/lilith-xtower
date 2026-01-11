import type { PromoBannerConfig } from "../utils/promoBanner";

/**
 * 宣传横幅配置说明
 * - include/exclude 支持通配符 "*" 表示匹配所有，以"/path" 开头或以"/path/*" 结尾的所有路径
 * - startAt/endAt 必须是 ISO 标准时间格式，指定横幅显示的开始/结束时间区间
 */
export const promoBannerConfig: PromoBannerConfig = {
  enabled: true,
  // 用户点击横幅/关闭按钮后，后台将记录横幅的唯一 ID，并会通过 dissmmiss 字段记录在本地存储中
  campaignId: "2025-survey-rollout",
  // 指定横幅轮播显示的路径白名单，留空表示在所有页面都显示
  include: ["*"],
  // 指定横幅轮播不显示的路径黑名单，所有路径默认都会显示，除了以下路径
  exclude: ["/login", "/debug-auth", "/api", "/api/*"],
  // 自动切换到下一张幻灯片的时间间隔（毫秒）
  autoAdvanceMs: 5200,
  // 如果用户没有点击交互，横幅自动隐藏的时间间隔（毫秒）
  autoCollapseMs: 12000,
  slides: [
    {
      id: "year-end-survey",
      title: "2025 年度问卷调查",
      description: "约 5-10 分钟填写，帮助我们改进功能优先级与体验细节",
      href: "https://v.wjx.cn/vm/twyt7dF.aspx#",
      cta: "参与问卷调查",
      gradient: "from-blue-600 via-indigo-600 to-cyan-500",
      textColor: "text-white",
      newTab: true,
      showOn: ["/", "/dashboard/*", "/qa"],
      hideOn: ["/sponsors"],
      startAt: "2025-11-20T00:00:00+08:00",
      endAt: "2025-12-31T23:59:59+08:00",
    },
  ],
};
