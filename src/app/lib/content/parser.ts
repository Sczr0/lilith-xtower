/**
 * 内容解析器 - 读取和解析Markdown文件
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Announcement, SongUpdate } from '../types/content';

const CONTENT_DIR = path.join(process.cwd(), 'src/app/content');

/**
 * 获取所有启用的公告
 * @returns 公告列表，按发布时间降序排列
 */
export function getAnnouncements(): Announcement[] {
  const dir = path.join(CONTENT_DIR, 'announcements');
  
  if (!fs.existsSync(dir)) {
    console.warn('公告目录不存在:', dir);
    return [];
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  
  return files
    .map(filename => {
      const filepath = path.join(dir, filename);
      const fileContent = fs.readFileSync(filepath, 'utf-8');
      const { data, content } = matter(fileContent);
      
      return {
        id: data.id,
        title: data.title,
        type: data.type,
        publishDate: data.publishDate,
        enabled: data.enabled ?? true,
        dismissible: data.dismissible ?? true,
        priority: data.priority ?? 'medium',
        content: content.trim()
      } as Announcement;
    })
    .filter(a => a.enabled)
    .sort((a, b) => 
      new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
    );
}

/**
 * 根据ID获取单个公告
 */
export function getAnnouncementById(id: string): Announcement | null {
  const announcements = getAnnouncements();
  return announcements.find(a => a.id === id) || null;
}

/**
 * 获取所有启用的新曲速递
 * @returns 新曲速递列表，按更新时间降序排列
 */
export function getSongUpdates(): SongUpdate[] {
  const dir = path.join(CONTENT_DIR, 'song-updates');
  
  if (!fs.existsSync(dir)) {
    console.warn('新曲速递目录不存在:', dir);
    return [];
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  
  return files
    .map(filename => {
      const filepath = path.join(dir, filename);
      const fileContent = fs.readFileSync(filepath, 'utf-8');
      const { data, content } = matter(fileContent);
      
      return {
        updateId: data.updateId,
        updateDate: data.updateDate,
        version: data.version,
        enabled: data.enabled ?? true,
        content: content.trim()
      } as SongUpdate;
    })
    .filter(u => u.enabled)
    .sort((a, b) => 
      new Date(b.updateDate).getTime() - new Date(a.updateDate).getTime()
    );
}

/**
 * 根据ID获取单个新曲速递
 */
export function getSongUpdateById(id: string): SongUpdate | null {
  const updates = getSongUpdates();
  return updates.find(u => u.updateId === id) || null;
}

/**
 * 获取最新的新曲速递
 */
export function getLatestSongUpdate(): SongUpdate | null {
  const updates = getSongUpdates();
  return updates.length > 0 ? updates[0] : null;
}

/**
 * 获取未读公告（基于用户上次查看时间）
 */
export function getUnreadAnnouncements(lastViewTime?: string): Announcement[] {
  const announcements = getAnnouncements();
  
  if (!lastViewTime) {
    return announcements;
  }
  
  const lastView = new Date(lastViewTime);
  return announcements.filter(a => 
    new Date(a.publishDate) > lastView
  );
}
