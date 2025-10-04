import React from 'react';
import { ScoreCard } from '../../components/ScoreCard';
import { RksRecord } from '../../lib/types/score';

const samples: RksRecord[] = [
  { song_name: 'Lemegeton ⌖ (Long Long Long Mix) - The Extremely Extended Version With Extra Characters 这是一个非常非常长的曲名示例', difficulty: 'IN', difficulty_value: 12.7, acc: 98.56, rks: 13.2456 },
  { song_name: 'Cthugha', difficulty: 'HD', difficulty_value: 11.4, acc: 99.12, rks: 12.8743 },
  { song_name: 'Stasis', difficulty: 'AT', difficulty_value: 13.2, acc: 96.31, rks: 13.0123 },
];

export default function Page() {
  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">ScoreCard 预览</h1>
      <div className="grid grid-cols-1 gap-4">
        {samples.map((rec, idx) => (
          <ScoreCard key={idx} record={rec} rank={idx + 1} nameMaxLines={2} />
        ))}
      </div>
    </div>
  );
}
