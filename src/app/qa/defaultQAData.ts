import type { QAItem } from './types';

// 默认的 QA 数据（作为回退）。当内容文件读取失败或为空时使用。
export const DEFAULT_QA_DATA: QAItem[] = [
  {
    id: 'q1',
    question: '如何获取 SessionToken？',
    answer:
      'Phigros 游戏内没有直接获取 SessionToken 的方式。为了降低凭证泄露风险，本网站默认不会在前端展示原始 SessionToken/API Token。你可以通过扫码登录或联合查分 API 登录后，在 /auth 查看当前登录状态（仅显示脱敏摘要）。若确有排查需求，请仅在自己可控环境下开启调试入口（生产默认关闭），并避免分享截图。',
    category: 'login',
  },
  {
    id: 'q2',
    question: '支持哪些登录方式？',
    answer:
      '我们支持多种登录方式：\n1. 扫码登录：使用 TapTap App 扫码登录\n2. 手动登录：输入 SessionToken\n3. 联合查分 API：使用 API 凭证登录\n4. 联合查分平台：使用平台账号登录',
    category: 'login',
  },
  {
    id: 'q3',
    question: '登录凭证会保存多久？',
    answer: '登录态通过 HttpOnly Cookie 会话保存（浏览器脚本无法直接读取），除非您主动退出登录或清除站点 Cookie/数据，否则会保持登录状态。',
    category: 'security',
  },
  {
    id: 'q4',
    question: '如何生成 Best N 成绩图片？',
    answer: '登录后，在侧边栏选择\"BN 图片生成\"，选择您想要的主题（深色/白色）和歌曲数量，点击生成即可。生成的图片可以直接下载或分享。',
    category: 'usage',
  },
  {
    id: 'q5',
    question: '什么是 RKS？',
    answer: 'RKS (Ranking Score) 是 Phigros 中衡量玩家水平的指标。它基于玩家最佳 N 首歌曲的成绩计算得出。您可以在\"RKS 成绩列表\"中查看详细的 RKS 计算信息。',
    category: 'usage',
  },
  {
    id: 'q6',
    question: '我的数据安全吗？',
    answer:
      '我们不会在浏览器 localStorage 中保存 SessionToken/API Token 等原始凭证；登录态使用服务端加密的 HttpOnly 会话 Cookie。页面可能会使用浏览器端的短期缓存提升体验（例如列表缓存），您可以随时通过退出登录或清理站点数据来移除本地缓存。',
    category: 'security',
  },
  {
    id: 'q7',
    question: '为什么我的成绩数据没有更新？',
    answer: '成绩数据来自 Phigros 官方服务器。如果您刚完成游戏，可能需要等待一段时间才会同步到服务器。您可以尝试退出登录后重新登录来刷新数据。',
    category: 'technical',
  },
  {
    id: 'q8',
    question: '支持哪些浏览器？',
    answer: '我们建议使用最新版本的 Chrome、Firefox、Safari 或 Edge 浏览器以获得最佳体验。部分功能可能不支持较旧的浏览器版本。',
    category: 'technical',
  },
  {
    id: 'q9',
    question: '如何查看调试信息？',
    answer:
      '登录后，在登录页面会显示当前登录状态，点击“查看详情”可查看会话摘要信息；也可以访问 /auth 查看当前会话状态。/debug-auth 为受控调试入口，生产环境默认不可用。',
    category: 'technical',
  },
  {
    id: 'q10',
    question: '可以同时使用多个账号吗？',
    answer: '目前不支持同时登录多个账号。如果您需要切换账号，请先退出当前账号，然后使用新的凭证登录。',
    category: 'usage',
  },
];

