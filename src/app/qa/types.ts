// QA 页面使用的数据结构（仅包含渲染所需字段）。
export interface QAItem {
  id: string;
  question: string;
  /**
   * 答案正文：允许多行纯文本或 Markdown（用于页面展示）。
   * 说明：FAQPage JSON-LD 会对该字段做“纯文本化/压缩空白”，避免富摘要解析不稳定。
   */
  answer: string;
  category: 'login' | 'usage' | 'technical' | 'security';
}
