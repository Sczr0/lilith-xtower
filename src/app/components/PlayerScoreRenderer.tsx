'use client';

import { useState, useEffect } from 'react';
import { StyledSelect } from './ui/Select';

interface ScoreEntry {
  id: string;
  song_name: string;
  score: number;
  acc: number;
  difficulty: 'EZ' | 'HD' | 'IN' | 'AT';
}

import { DIFFICULTY_BADGE } from '../lib/constants/difficultyColors';

const MAX_SCORES = 36;
const SCORE_STORAGE_KEY_NAME = 'playerScoreRender_playerName';
const SCORE_STORAGE_KEY_SCORES = 'playerScoreRender_scores';

function createScoreEntryId(): string {
  try {
    const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeSavedScores(raw: unknown): ScoreEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const v = item as Partial<ScoreEntry> & Record<string, unknown>;
      const song_name = typeof v.song_name === 'string' ? v.song_name : '';
      const score = typeof v.score === 'number' ? v.score : Number.parseInt(String(v.score ?? ''), 10);
      const acc = typeof v.acc === 'number' ? v.acc : Number.parseFloat(String(v.acc ?? ''));
      const difficulty = v.difficulty === 'EZ' || v.difficulty === 'HD' || v.difficulty === 'IN' || v.difficulty === 'AT' ? v.difficulty : 'IN';
      if (!song_name || !Number.isFinite(score) || !Number.isFinite(acc)) return null;
      const id = typeof v.id === 'string' && v.id ? v.id : createScoreEntryId();
      return { id, song_name, score, acc, difficulty } satisfies ScoreEntry;
    })
    .filter((x): x is ScoreEntry => !!x);
}

export function PlayerScoreRenderer() {
  const [playerName, setPlayerName] = useState('');
  const [scoresList, setScoresList] = useState<ScoreEntry[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);

  // 表单输入状态
  const [songName, setSongName] = useState('');
  const [songScore, setSongScore] = useState('');
  const [songAcc, setSongAcc] = useState('');
  const [songDifficulty, setSongDifficulty] = useState<'EZ' | 'HD' | 'IN' | 'AT'>('IN');

  // 从 localStorage 加载数据
  useEffect(() => {
    const savedPlayerName = localStorage.getItem(SCORE_STORAGE_KEY_NAME);
    const savedScores = localStorage.getItem(SCORE_STORAGE_KEY_SCORES);

    if (savedPlayerName) {
      setPlayerName(savedPlayerName);
    }

    if (savedScores) {
      try {
        const normalized = normalizeSavedScores(JSON.parse(savedScores));
        setScoresList(normalized);

        // 鏁版嵁杩佺Щ锛氳ˉ榻? id锛堜笉褰卞搷 UI 锛屼絾鑳介伩鍏嶅垪琛ㄩ噸鎺掑鑷寸殑鏃犳剰涔? remount锛?
        try {
          localStorage.setItem(SCORE_STORAGE_KEY_SCORES, JSON.stringify(normalized));
        } catch {}
      } catch (error) {
        console.error('Failed to parse saved scores:', error);
      }
    }
  }, []);

  // 避免 ObjectURL 泄漏：当 resultImage 更新/卸载时回收旧 URL
  useEffect(() => {
    return () => {
      if (resultImage) URL.revokeObjectURL(resultImage);
    };
  }, [resultImage]);

  // 保存数据到 localStorage
  const saveToLocalStorage = (name: string, scores: ScoreEntry[]) => {
    localStorage.setItem(SCORE_STORAGE_KEY_NAME, name);
    localStorage.setItem(SCORE_STORAGE_KEY_SCORES, JSON.stringify(scores));
  };

  // 添加成绩
  const addScore = () => {
    if (!songName.trim()) {
      alert('请输入歌曲名称');
      return;
    }

    const score = parseInt(songScore);
    const acc = parseFloat(songAcc);

    if (isNaN(score) || score < 0 || score > 1000000) {
      alert('请输入有效的分数 (0-1000000)');
      return;
    }

    if (isNaN(acc) || acc < 0 || acc > 100) {
      alert('请输入有效的ACC (0-100)');
      return;
    }

    if (scoresList.length >= MAX_SCORES) {
      alert(`最多只能添加${MAX_SCORES}个成绩`);
      return;
    }

    const newScoresList = [
      ...scoresList,
      {
        id: createScoreEntryId(),
        song_name: songName.trim(),
        score,
        acc,
        difficulty: songDifficulty,
      },
    ];

    setScoresList(newScoresList);
    saveToLocalStorage(playerName, newScoresList);

    // 清空输入框
    setSongName('');
    setSongScore('');
    setSongAcc('');
    setSongDifficulty('IN');
  };

  // 删除成绩
  const removeScore = (id: string) => {
    const newScoresList = scoresList.filter((s) => s.id !== id);
    setScoresList(newScoresList);
    saveToLocalStorage(playerName, newScoresList);
  };

  // 清空所有成绩
  const clearScores = () => {
    if (scoresList.length === 0) {
      return;
    }

    if (confirm('确定要清空所有成绩吗？')) {
      setScoresList([]);
      saveToLocalStorage(playerName, []);
    }
  };

  // 渲染成绩
  const renderScores = async () => {
    if (!playerName.trim()) {
      alert('请输入玩家姓名');
      return;
    }

    if (scoresList.length === 0) {
      alert('请至少添加一个成绩');
      return;
    }

    setIsRendering(true);
    setResultImage(null);

    try {
      const response = await fetch('/api/image/bn/user-generated', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player_name: playerName.trim(),
          scores: scoresList.map((s) => ({
            song_name: s.song_name,
            score: s.score,
            acc: s.acc,
            difficulty: s.difficulty,
          })),
        }),
      });

      if (!response.ok) {
        let message = '渲染失败';
        try {
          const data = await response.json();
          if (data?.message) {
            message = data.message;
          }
        } catch (error) {
          console.error('解析错误信息失败:', error);
        }
        throw new Error(message);
      }

      const imageBlob = await response.blob();
      const imageUrl = URL.createObjectURL(imageBlob);
      setResultImage(imageUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : '渲染失败';
      alert(`错误: ${message}`);
    } finally {
      setIsRendering(false);
    }
  };

  // 处理玩家姓名变化
  const handlePlayerNameChange = (name: string) => {
    setPlayerName(name);
    saveToLocalStorage(name, scoresList);
  };

  // 下载图片
  const downloadImage = () => {
    if (!resultImage) return;

    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `${playerName || 'player'}_scores.png`;
    link.click();
  };

  return (
    <div className="w-full space-y-6">
      {/* 玩家姓名输入 */}
      <section className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          玩家姓名
        </label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => handlePlayerNameChange(e.target.value)}
          placeholder="请输入玩家姓名"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </section>

      {/* 主要内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：添加成绩 */}
        <section className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            添加成绩
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                歌曲名称
              </label>
              <input
                type="text"
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
                placeholder="请输入歌曲名称"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                分数
              </label>
              <input
                type="number"
                value={songScore}
                onChange={(e) => setSongScore(e.target.value)}
                placeholder="0-1000000"
                min="0"
                max="1000000"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ACC (%)
              </label>
              <input
                type="number"
                value={songAcc}
                onChange={(e) => setSongAcc(e.target.value)}
                placeholder="0-100"
                min="0"
                max="100"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                难度
              </label>
              <StyledSelect
                options={[
                  { label: 'EZ', value: 'EZ' },
                  { label: 'HD', value: 'HD' },
                  { label: 'IN', value: 'IN' },
                  { label: 'AT', value: 'AT' },
                ]}
                value={songDifficulty}
                onValueChange={(v) => setSongDifficulty(v as 'EZ' | 'HD' | 'IN' | 'AT')}
                placeholder="选择难度"
              />
            </div>

            <button
              onClick={addScore}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              添加成绩
            </button>
          </div>
        </section>

        {/* 右侧：成绩列表 */}
        <section className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">成绩列表</h3>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {scoresList.length}/{MAX_SCORES}
            </span>
          </div>

          {/* 成绩列表 */}
          <div className="flex-grow overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 mb-4 min-h-[300px] max-h-[400px]">
            {scoresList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  fill="currentColor"
                  className="mb-4 opacity-50"
                  viewBox="0 0 16 16"
                >
                  <path d="M12 13c0 1.105-1.12 2-2.5 2S7 14.105 7 13s1.12-2 2.5-2 2.5.895 2.5 2" />
                  <path fillRule="evenodd" d="M12 3v10h-1V3z" />
                  <path d="M11 2.82a1 1 0 0 1 .804-.98l3-.6A1 1 0 0 1 16 2.22V4l-5 1z" />
                  <path
                    fillRule="evenodd"
                    d="M0 11.5a.5.5 0 0 1 .5-.5H4a.5.5 0 0 1 0 1H.5a.5.5 0 0 1-.5-.5m0-4A.5.5 0 0 1 .5 7H8a.5.5 0 0 1 0 1H.5a.5.5 0 0 1-.5-.5m0-4A.5.5 0 0 1 .5 3H8a.5.5 0 0 1 0 1H.5a.5.5 0 0 1-.5-.5"
                  />
                </svg>
                <span>暂无成绩</span>
              </div>
            ) : (
              <div className="space-y-2">
                {scoresList.map((score) => (
                  <div
                    key={score.id}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex justify-between items-center"
                  >
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {score.song_name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${DIFFICULTY_BADGE[score.difficulty]}`}
                        >
                          {score.difficulty}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        分数: {score.score} | ACC: {score.acc}%
                      </div>
                    </div>
                    <button
                      onClick={() => removeScore(score.id)}
                      className="ml-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded transition-colors"
                      title="删除"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                      >
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
                        <path
                          fillRule="evenodd"
                          d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3V2h11v1z"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button
              onClick={clearScores}
              disabled={scoresList.length === 0}
              className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              清空成绩
            </button>
            <button
              onClick={renderScores}
              disabled={isRendering || scoresList.length === 0 || !playerName.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {isRendering ? '渲染中...' : '渲染成绩'}
            </button>
          </div>
        </section>
      </div>

      {/* 渲染结果 */}
      {resultImage && (
        <section className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">渲染结果</h3>
            <button
              onClick={downloadImage}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              下载图片
            </button>
          </div>
          <div className="flex justify-center">
            <img src={resultImage} alt="渲染结果" className="max-w-full rounded-lg shadow-lg" />
          </div>
        </section>
      )}
    </div>
  );
}
