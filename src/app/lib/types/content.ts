/**
 * 内容管理系统类型定义
 */

export interface Announcement {
  id: string;
  title: string;
  type: 'info' | 'warning' | 'maintenance';
  publishDate: string;
  enabled: boolean;
  dismissible: boolean;
  priority: 'high' | 'medium' | 'low';
  content: string; // Markdown content
}

export interface ChartInfo {
  difficulty: 'EZ' | 'HD' | 'IN' | 'AT';
  level: string;
  constant: number;
}

export interface Song {
  name: string;
  artist: string;
  charts: ChartInfo[];
  note?: string;
}

export interface SongUpdate {
  updateId: string;
  updateDate: string;
  version: string;
  enabled: boolean;
  content: string; // Markdown content
  songs?: Song[]; // 从Markdown解析出来的结构化数据
}
