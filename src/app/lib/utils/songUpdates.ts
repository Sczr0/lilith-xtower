/**
 * 新曲速递（song-updates）相关工具函数。
 *
 * 目标：
 * - 从 Markdown 文本中提取“可扫读”的摘要信息（例如：新增曲目数量、更新说明中提及的调整项数量）
 * - 保持实现尽量保守：解析失败时返回 0，而不是抛异常导致页面崩溃
 */

function normalizeMarkdown(md: string): string {
  return md.replace(/\r\n?/g, '\n');
}

/**
 * 统计“新增曲目”小节下的歌曲数量。
 *
 * 内容约定（当前仓库 content/song-updates/*.md 的结构）：
 * - 使用 `## 新增曲目` 作为小节标题
 * - 每首歌曲使用 `### 歌曲名` 作为标题
 *
 * 解析策略：
 * - 找到包含“新增曲目”的标题行（任意级别 #）
 * - 提取该 section 的正文（直到下一个“同级或更高级”标题）
 * - 统计该 section 内 `###` 标题出现次数作为歌曲数量
 */
export function countNewSongs(md: string): number {
  try {
    const normalized = normalizeMarkdown(md);
    const sectionRe = /^(#{1,6})\s.*新增曲目.*$/m;
    const match = normalized.match(sectionRe);
    if (!match || match.index === undefined) return 0;

    const level = match[1].length;
    const startIdx = match.index + match[0].length;
    const after = normalized.slice(startIdx);

    // 只截断到“同级或更高级”的标题（避免在第一首歌的 ### 就提前结束）
    const nextHeadingRe = new RegExp(`^#{1,${level}}\\s`, 'm');
    const nextIdx = after.search(nextHeadingRe);
    const section = nextIdx === -1 ? after : after.slice(0, nextIdx);

    const songs = section.match(/^###\s+/gm);
    return songs ? songs.length : 0;
  } catch {
    return 0;
  }
}

/**
 * 统计“更新说明”中提及的调整项数量。
 *
 * 内容约定：
 * - 使用单行 `**更新说明**: ...`（或中文冒号 `：`）给出调整信息
 * - 多个调整项通常以中文逗号/顿号/分号分隔
 *
 * 解析策略（尽量保守）：
 * - 捕获更新说明行的正文
 * - 以常见分隔符拆分并统计非空片段数
 */
export function countUpdateNoteChanges(md: string): number {
  try {
    const normalized = normalizeMarkdown(md);
    const noteRe = /^\*\*更新说明\*\*\s*[:：]\s*(.+)$/m;
    const match = normalized.match(noteRe);
    if (!match) return 0;

    const text = match[1].trim();
    if (!text) return 0;

    const parts = text
      .split(/[，,、；;]/)
      .map((p) => p.trim())
      .filter(Boolean);

    return parts.length;
  } catch {
    return 0;
  }
}

