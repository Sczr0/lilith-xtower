import type { MetadataRoute } from "next";
import { SITE_URL } from "./utils/site-url";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // 安装后应用名称（主屏 + 任务切换器）；与 <title>/<meta> 保持一致
    name: "Phigros Query - 不专业的 Phigros 成绩查询与 RKS 数据分析工具",
    short_name: "Phigros Query",
    description:
      "Phigros Query 是一个专为 Phigros 玩家打造的综合性成绩查询与数据分析平台。提供精准的 RKS 计算、Best N 成绩卡片生成、单曲表现分析与成绩分享功能。",
    id: `${SITE_URL}/`,
    // 打开 PWA 时的默认落地页与作用域
    start_url: "/",
    scope: "/",
    display: "standalone",
    // 与 layout 中亮色 theme-color(#2563eb) 保持一致
    theme_color: "#2563eb",
    background_color: "#ffffff",
    lang: "zh-CN",
    categories: ["games", "utilities", "entertainment"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
