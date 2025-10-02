'use client';

import { useState } from 'react';

export function QueryInput() {
  const [playerId, setPlayerId] = useState('');

  const handleQuery = () => {
    // 后续将在此处处理查询逻辑
    console.log('Querying for player ID:', playerId);
  };

  return (
    <div className="flex w-full max-w-sm items-center space-x-2">
      <input
        type="text"
        placeholder="输入玩家 ID"
        value={playerId}
        onChange={(e) => setPlayerId(e.target.value)}
        className="flex-1 p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700"
      />
      <button
        onClick={handleQuery}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        查询
      </button>
    </div>
  );
}