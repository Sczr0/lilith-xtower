export type Difficulty = 'EZ' | 'HD' | 'IN' | 'AT';

// 全局难度颜色映射（贴近游戏：EZ=黄绿(lime), HD=天蓝(sky), IN=红(red), AT=灰(gray)）
export const DIFFICULTY_BG: Record<Difficulty, string> = {
  EZ: 'bg-lime-100 dark:bg-lime-900/30',
  HD: 'bg-sky-100 dark:bg-sky-900/30',
  IN: 'bg-red-100 dark:bg-red-900/30',
  AT: 'bg-gray-100 dark:bg-gray-900/30',
};

export const DIFFICULTY_TEXT: Record<Difficulty, string> = {
  EZ: 'text-lime-700 dark:text-lime-400',
  HD: 'text-sky-700 dark:text-sky-400',
  IN: 'text-red-700 dark:text-red-400',
  AT: 'text-gray-700 dark:text-gray-400',
};

export const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  EZ: `${DIFFICULTY_BG.EZ} ${DIFFICULTY_TEXT.EZ}`,
  HD: `${DIFFICULTY_BG.HD} ${DIFFICULTY_TEXT.HD}`,
  IN: `${DIFFICULTY_BG.IN} ${DIFFICULTY_TEXT.IN}`,
  AT: `${DIFFICULTY_BG.AT} ${DIFFICULTY_TEXT.AT}`,
};
