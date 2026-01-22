import type { LucideIcon } from 'lucide-react';
import { Activity, LifeBuoy, Users } from 'lucide-react';

export interface SupportLinkItem {
  name: string;
  url: string;
  external: boolean;
}

export interface SupportLinkSection {
  title: string;
  links: SupportLinkItem[];
  icon: LucideIcon;
}

// 关于页的“服务支持”链接（静态内容）。
export const SUPPORT_LINK_SECTIONS: SupportLinkSection[] = [
  {
    title: '技术支持',
    links: [
      { name: '技术支持方', url: 'https://github.com/Sczr0', external: true },
      { name: '官方群聊', url: 'https://qm.qq.com/q/YQMW1eiz8m', external: true },
      { name: '反馈问题与建议', url: 'https://www.wjx.cn/vm/rDY4LVs.aspx#', external: true },
    ],
    icon: LifeBuoy,
  },
  {
    title: '关于服务',
    links: [
      { name: '数据访问统计', url: 'https://cloud.umami.is/share/NsykwU9OjIWMYsb8', external: true },
      { name: '服务可用性监控', url: 'https://status.xtower.site/status/xtower', external: true },
      { name: '爱发电', url: 'https://afdian.com/a/xtower', external: true },
    ],
    icon: Activity,
  },
  {
    title: '友链',
    links: [
      { name: 'Phi-plugin 使用指引', url: 'https://www.kdocs.cn/l/catqcMM9UR5Y', external: true },
      { name: 'RankHub —— 跨平台音游数据管理应用', url: 'https://github.com/Project-Fukakai/RankHub', external: true },
    ],
    icon: Users,
  },
];

