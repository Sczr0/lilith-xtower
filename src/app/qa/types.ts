// QA 页面使用的数据结构（仅包含渲染所需字段）。
export interface QAItem {
  id: string;
  question: string;
  answer: string;
  category: 'login' | 'usage' | 'technical' | 'security';
}

