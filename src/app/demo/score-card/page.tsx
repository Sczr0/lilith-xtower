import React from 'react';
import { ScoreCard } from '../../components/ScoreCard';
import { SiteHeader } from '../../components/SiteHeader';
import { SCORE_CARD_SAMPLES } from './samples';

export default function Page() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-50">
      <SiteHeader />
      <div className="w-full max-w-3xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">ScoreCard 预览</h1>
        <div className="grid grid-cols-1 gap-4">
          {SCORE_CARD_SAMPLES.map((rec, idx) => {
            // 说明：样例数据使用稳定 key，避免形成“index 作为 key”的不良示范
            const key = `${rec.song_name}-${rec.difficulty}-${rec.difficulty_value}`;
            return <ScoreCard key={key} record={rec} rank={idx + 1} nameMaxLines={2} />;
          })}
        </div>
      </div>
    </div>
  );
}
