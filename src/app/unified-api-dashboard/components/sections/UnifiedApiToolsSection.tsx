'use client';

import { useState } from 'react';

import { buttonStyles, cardStyles, inputStyles } from '../../../components/ui/styles';
import { UnifiedAPI } from '../../../lib/api/unified';
import type {
  UnifiedApiAdvancedAuth,
  UnifiedApiLevelKind,
  UnifiedApiPlayerIdListResponse,
  UnifiedApiRanklistResponse,
  UnifiedApiScoreListOrderBy,
  UnifiedApiScoreListUserResponse,
} from '../../../lib/types/unified-api';
import type { AsyncState } from '../../lib/unifiedApiDashboardUtils';
import { ResponseJsonDetails } from '../ResponseJsonDetails';

const LEVEL_KINDS: UnifiedApiLevelKind[] = ['EZ', 'HD', 'IN', 'AT'];
const SCORE_LIST_ORDER_BY: UnifiedApiScoreListOrderBy[] = ['acc', 'score', 'fc', 'updated_at'];
const RESULT_MAX_ROWS = 50;

type Props = {
  authedReady: boolean;
  authedPayload: UnifiedApiAdvancedAuth;
  onNeedCredentials: () => void;
  copyText: (value: string, label?: string) => Promise<void>;
};

export function UnifiedApiToolsSection({ authedReady, authedPayload, onNeedCredentials, copyText }: Props) {
  const [playerIdKeyword, setPlayerIdKeyword] = useState('');
  const [playerIdMaxLength, setPlayerIdMaxLength] = useState('20');
  const [playerIdListState, setPlayerIdListState] = useState<AsyncState<UnifiedApiPlayerIdListResponse>>({
    loading: false,
    error: null,
    data: null,
  });

  const [rankQuery, setRankQuery] = useState('1');
  const [ranklistByRankState, setRanklistByRankState] = useState<AsyncState<UnifiedApiRanklistResponse>>({
    loading: false,
    error: null,
    data: null,
  });
  const [ranklistByUserState, setRanklistByUserState] = useState<AsyncState<UnifiedApiRanklistResponse>>({
    loading: false,
    error: null,
    data: null,
  });

  const [songId, setSongId] = useState('');
  const [songRank, setSongRank] = useState<UnifiedApiLevelKind>('IN');
  const [songOrderBy, setSongOrderBy] = useState<UnifiedApiScoreListOrderBy>('acc');
  const [scoreListUserState, setScoreListUserState] = useState<AsyncState<UnifiedApiScoreListUserResponse>>({
    loading: false,
    error: null,
    data: null,
  });

  const handleSearchPlayerId = async () => {
    const keyword = playerIdKeyword.trim();
    if (!keyword) {
      setPlayerIdListState({ loading: false, error: '请填写要检索的用户名（playerId）', data: null });
      return;
    }

    const maxLengthNumber = Number(playerIdMaxLength);
    const maxLength = Number.isFinite(maxLengthNumber) && maxLengthNumber > 0 ? maxLengthNumber : undefined;

    setPlayerIdListState({ loading: true, error: null, data: null });
    try {
      const res = await UnifiedAPI.searchPlayerIdList({ playerId: keyword, maxLength });
      setPlayerIdListState({ loading: false, error: null, data: res });
    } catch (err) {
      setPlayerIdListState({ loading: false, error: err instanceof Error ? err.message : '检索失败', data: null });
    }
  };

  const handleRanklistByRank = async () => {
    const rankNumber = Number(rankQuery);
    if (!Number.isFinite(rankNumber) || rankNumber <= 0) {
      setRanklistByRankState({ loading: false, error: '名次必须是大于 0 的数字', data: null });
      return;
    }

    setRanklistByRankState({ loading: true, error: null, data: null });
    try {
      const res = await UnifiedAPI.getRanklistByRank({ request_rank: Math.floor(rankNumber) });
      setRanklistByRankState({ loading: false, error: null, data: res });
    } catch (err) {
      setRanklistByRankState({ loading: false, error: err instanceof Error ? err.message : '查询失败', data: null });
    }
  };

  const handleRanklistByUser = async () => {
    if (!authedReady) {
      setRanklistByUserState({
        loading: false,
        error: '请先登录本站并完成绑定，然后填写“联合API用户ID”和“API Token”。',
        data: null,
      });
      return;
    }

    setRanklistByUserState({ loading: true, error: null, data: null });
    try {
      const res = await UnifiedAPI.getRanklistByUser(authedPayload);
      setRanklistByUserState({ loading: false, error: null, data: res });
    } catch (err) {
      setRanklistByUserState({ loading: false, error: err instanceof Error ? err.message : '查询失败', data: null });
    }
  };

  const handleScoreListByUser = async () => {
    const songIdValue = songId.trim();
    if (!authedReady) {
      setScoreListUserState({
        loading: false,
        error: '请先登录本站并完成绑定，然后填写“联合API用户ID”和“API Token”。',
        data: null,
      });
      return;
    }
    if (!songIdValue) {
      setScoreListUserState({ loading: false, error: '请填写歌曲ID（songId）（例如：光.姜米條.0）', data: null });
      return;
    }

    setScoreListUserState({ loading: true, error: null, data: null });
    try {
      const res = await UnifiedAPI.getScoreListByUser({
        ...authedPayload,
        songId: songIdValue,
        rank: songRank,
        orderBy: songOrderBy,
      });
      setScoreListUserState({ loading: false, error: null, data: res });
    } catch (err) {
      setScoreListUserState({ loading: false, error: err instanceof Error ? err.message : '查询失败', data: null });
    }
  };

  return (
    <>
      <section className={cardStyles({ tone: 'glass', padding: 'md' })}>
        <div>
          <h2 className="text-lg font-semibold">查询工具</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            这里提供一些常用查询：搜用户名、查排行榜、查单曲排名。需要“我的数据”的功能，请先完成绑定并填好“联合API用户ID”和“API Token”。
          </p>
          {!authedReady && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">当前缺少凭证信息，部分查询将不可用。</p>
              <button type="button" className={buttonStyles({ variant: 'secondary', size: 'sm' })} onClick={onNeedCredentials}>
                去填写凭证
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className={cardStyles({ tone: 'glass' })}>
          <h3 className="text-base font-semibold">搜索用户名</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">输入用户名关键词，可返回可能的候选列表与对应的联合API ID（apiId）。</p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">用户名（关键词）</label>
              <input
                className={inputStyles({})}
                value={playerIdKeyword}
                onChange={(e) => setPlayerIdKeyword(e.target.value)}
                placeholder="例如：Lilith"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">最多返回条数（可选）</label>
              <input
                className={inputStyles({ className: 'font-mono' })}
                value={playerIdMaxLength}
                onChange={(e) => setPlayerIdMaxLength(e.target.value)}
                placeholder="20"
                inputMode="numeric"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={buttonStyles({ variant: 'primary' })}
                onClick={handleSearchPlayerId}
                disabled={playerIdListState.loading || !playerIdKeyword.trim()}
              >
                {playerIdListState.loading ? '检索中...' : '检索'}
              </button>
              <button
                className={buttonStyles({ variant: 'secondary' })}
                onClick={() => {
                  setPlayerIdListState({ loading: false, error: null, data: null });
                  setPlayerIdKeyword('');
                }}
                disabled={playerIdListState.loading}
              >
                清空
              </button>
            </div>

            {playerIdListState.error && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                {playerIdListState.error}
              </div>
            )}

            {playerIdListState.data?.data?.length ? (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 dark:text-gray-400">
                      <th className="py-2 pr-3">用户名</th>
                      <th className="py-2 pr-3">联合API ID</th>
                      <th className="py-2 pr-3">操作</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800 dark:text-gray-200">
                    {playerIdListState.data.data.slice(0, RESULT_MAX_ROWS).map((item) => (
                      <tr
                        key={`${item.apiId}:${item.playerId}`}
                        className="border-t border-gray-200/70 dark:border-neutral-800/70"
                      >
                        <td className="py-2 pr-3 break-all">{item.playerId}</td>
                        <td className="py-2 pr-3 font-mono break-all">{item.apiId}</td>
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            className={buttonStyles({ variant: 'outline', size: 'sm' })}
                            onClick={() => void copyText(item.apiId, 'apiId')}
                          >
                            复制 apiId
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {playerIdListState.data.data.length > RESULT_MAX_ROWS && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">仅展示前 {RESULT_MAX_ROWS} 条结果。</p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{playerIdListState.loading ? '加载中...' : '暂无数据'}</p>
            )}

            {playerIdListState.data && <ResponseJsonDetails data={playerIdListState.data} className="mt-4" />}
          </div>
        </section>

        <section className={cardStyles({ tone: 'glass' })}>
          <h3 className="text-base font-semibold">排行榜查询</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            可以按名次查看榜单，也可以查询“我”的榜单信息（需要先绑定并填写 Token）。
          </p>

          <div className="mt-4 space-y-6">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">按名次查询</div>
                <button
                  className={buttonStyles({ variant: 'primary', size: 'sm' })}
                  onClick={handleRanklistByRank}
                  disabled={ranklistByRankState.loading || !rankQuery.trim()}
                >
                  {ranklistByRankState.loading ? '查询中...' : '查询'}
                </button>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-2">名次（例如：1）</label>
                <input
                  className={inputStyles({ className: 'font-mono' })}
                  value={rankQuery}
                  onChange={(e) => setRankQuery(e.target.value)}
                  placeholder="1"
                  inputMode="numeric"
                />
              </div>

              {ranklistByRankState.error && (
                <div className="mt-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                  {ranklistByRankState.error}
                </div>
              )}

              {ranklistByRankState.data?.data?.users?.length ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 dark:text-gray-400">
                        <th className="py-2 pr-3">名次</th>
                        <th className="py-2 pr-3">用户名</th>
                        <th className="py-2 pr-3">RKS</th>
                        <th className="py-2 pr-3">挑战名次</th>
                        <th className="py-2 pr-3">更新时间</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-800 dark:text-gray-200">
                      {ranklistByRankState.data.data.users.slice(0, RESULT_MAX_ROWS).map((row) => (
                        <tr
                          key={`${row.index}:${row.saveInfo?.PlayerId ?? ''}`}
                          className="border-t border-gray-200/70 dark:border-neutral-800/70"
                        >
                          <td className="py-2 pr-3 font-mono">{row.index}</td>
                          <td className="py-2 pr-3 break-all">{row.saveInfo?.PlayerId || '-'}</td>
                          <td className="py-2 pr-3 font-mono">{row.saveInfo?.summary?.rankingScore ?? '-'}</td>
                          <td className="py-2 pr-3 font-mono">{row.saveInfo?.summary?.challengeModeRank ?? '-'}</td>
                          <td className="py-2 pr-3 font-mono break-all">{row.saveInfo?.modifiedAt?.iso ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{ranklistByRankState.loading ? '加载中...' : '暂无数据'}</p>
              )}

              {ranklistByRankState.data && <ResponseJsonDetails data={ranklistByRankState.data} className="mt-3" />}
            </div>

            <div className="border-t border-gray-200/60 dark:border-neutral-800/60 pt-6">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">查我的榜单信息</div>
                <button
                  className={buttonStyles({ variant: 'primary', size: 'sm' })}
                  onClick={handleRanklistByUser}
                  disabled={ranklistByUserState.loading || !authedReady}
                >
                  {ranklistByUserState.loading ? '查询中...' : '查询'}
                </button>
              </div>
              {!authedReady && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">需要登录信息：请先完成绑定，并填写“联合API用户ID”和“API Token”。</p>}

              {ranklistByUserState.error && (
                <div className="mt-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                  {ranklistByUserState.error}
                </div>
              )}

              {ranklistByUserState.data?.data?.users?.length ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 dark:text-gray-400">
                        <th className="py-2 pr-3">名次</th>
                        <th className="py-2 pr-3">用户名</th>
                        <th className="py-2 pr-3">RKS</th>
                        <th className="py-2 pr-3">挑战名次</th>
                        <th className="py-2 pr-3">更新时间</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-800 dark:text-gray-200">
                      {ranklistByUserState.data.data.users.slice(0, RESULT_MAX_ROWS).map((row) => (
                        <tr
                          key={`${row.index}:${row.saveInfo?.PlayerId ?? ''}`}
                          className="border-t border-gray-200/70 dark:border-neutral-800/70"
                        >
                          <td className="py-2 pr-3 font-mono">{row.index}</td>
                          <td className="py-2 pr-3 break-all">{row.saveInfo?.PlayerId || '-'}</td>
                          <td className="py-2 pr-3 font-mono">{row.saveInfo?.summary?.rankingScore ?? '-'}</td>
                          <td className="py-2 pr-3 font-mono">{row.saveInfo?.summary?.challengeModeRank ?? '-'}</td>
                          <td className="py-2 pr-3 font-mono break-all">{row.saveInfo?.modifiedAt?.iso ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {ranklistByUserState.data.data.users.length > RESULT_MAX_ROWS && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">仅展示前 {RESULT_MAX_ROWS} 条结果。</p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{ranklistByUserState.loading ? '加载中...' : '暂无数据'}</p>
              )}

              {ranklistByUserState.data && <ResponseJsonDetails data={ranklistByUserState.data} className="mt-3" />}
            </div>
          </div>
        </section>

        <section className={cardStyles({ tone: 'glass' })}>
          <h3 className="text-base font-semibold">单曲成绩排名</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            输入歌曲ID与难度，可查询你在该谱面的名次与附近榜单片段（需要先绑定并填写 Token）。
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">歌曲ID（songId）</label>
              <input
                className={inputStyles({ className: 'font-mono' })}
                value={songId}
                onChange={(e) => setSongId(e.target.value)}
                placeholder="例如：光.姜米條.0"
                autoComplete="off"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2">难度（rank）</label>
                <select
                  className={inputStyles({ className: 'bg-white dark:bg-neutral-950' })}
                  value={songRank}
                  onChange={(e) => setSongRank(e.target.value as UnifiedApiLevelKind)}
                >
                  {LEVEL_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">排序方式（orderBy）</label>
                <select
                  className={inputStyles({ className: 'bg-white dark:bg-neutral-950' })}
                  value={songOrderBy}
                  onChange={(e) => setSongOrderBy(e.target.value as UnifiedApiScoreListOrderBy)}
                >
                  {SCORE_LIST_ORDER_BY.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className={buttonStyles({ variant: 'primary' })}
                onClick={handleScoreListByUser}
                disabled={scoreListUserState.loading || !songId.trim() || !authedReady}
              >
                {scoreListUserState.loading ? '查询中...' : '查询'}
              </button>
              <button
                className={buttonStyles({ variant: 'secondary' })}
                onClick={() => {
                  setScoreListUserState({ loading: false, error: null, data: null });
                  setSongId('');
                }}
                disabled={scoreListUserState.loading}
              >
                清空
              </button>
            </div>

            {!authedReady && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">需要登录信息：请先完成绑定，并填写“联合API用户ID”和“API Token”。</p>}

            {scoreListUserState.error && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                {scoreListUserState.error}
              </div>
            )}

            {scoreListUserState.data?.data?.users?.length ? (
              <div className="mt-2 space-y-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  总人数：{scoreListUserState.data.data.totDataNum}，你的名次：{scoreListUserState.data.data.userRank}（userRank）
                  <button
                    type="button"
                    className={buttonStyles({ variant: 'outline', size: 'sm', className: 'ml-2' })}
                    onClick={() => void copyText(String(scoreListUserState.data?.data?.userRank ?? ''), 'userRank')}
                    disabled={scoreListUserState.data.data.userRank == null}
                  >
                    复制名次
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 dark:text-gray-400">
                        <th className="py-2 pr-3">名次</th>
                        <th className="py-2 pr-3">用户名</th>
                        <th className="py-2 pr-3">分数</th>
                        <th className="py-2 pr-3">准确率</th>
                        <th className="py-2 pr-3">FC</th>
                        <th className="py-2 pr-3">更新时间</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-800 dark:text-gray-200">
                      {scoreListUserState.data.data.users.slice(0, RESULT_MAX_ROWS).map((row) => (
                        <tr
                          key={`${row.index}:${row.gameuser?.PlayerId ?? ''}`}
                          className="border-t border-gray-200/70 dark:border-neutral-800/70"
                        >
                          <td className="py-2 pr-3 font-mono">{row.index}</td>
                          <td className="py-2 pr-3 break-all">{row.gameuser?.PlayerId || '-'}</td>
                          <td className="py-2 pr-3 font-mono">{row.record?.score ?? '-'}</td>
                          <td className="py-2 pr-3 font-mono">{row.record?.acc ?? '-'}</td>
                          <td className="py-2 pr-3 font-mono">{row.record?.fc ?? '-'}</td>
                          <td className="py-2 pr-3 font-mono break-all">{row.record?.updated_at ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {scoreListUserState.data.data.users.length > RESULT_MAX_ROWS && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">仅展示前 {RESULT_MAX_ROWS} 条结果。</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{scoreListUserState.loading ? '加载中...' : '暂无数据'}</p>
            )}

            {scoreListUserState.data && <ResponseJsonDetails data={scoreListUserState.data} className="mt-4" />}
          </div>
        </section>
      </div>
    </>
  );
}

