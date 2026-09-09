// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SongCandidate } from '@/app/lib/api/song';
import { SongCandidateList } from '../SongCandidateList';

const candidate: SongCandidate = {
  id: 'KhronostasisKatharsis.Halv',
  name: 'Khronostasis Katharsis',
  artist: 'Halv',
  illustrator: 'utosao',
  chartConstants: { ez: 6.0, hd: 11.8, in: 14.0, at: null },
  coverUrl: 'https://somnia.xtower.site/lilith/illLow/KhronostasisKatharsis.Halv.webp',
  coverFallbackUrl: 'https://somnia.xtower.site/illustrationLowRes/KhronostasisKatharsis.Halv.png',
};

afterEach(() => {
  cleanup();
});

describe('SongCandidateList', () => {
  it('展示曲绘、曲名、曲师/画师、定数与曲目 ID', () => {
    render(<SongCandidateList candidates={[candidate]} onSelect={vi.fn()} />);

    expect(screen.getByText('Khronostasis Katharsis')).toBeTruthy();
    expect(screen.getByText('Halv · 画师 utosao')).toBeTruthy();
    expect(screen.getByText('KhronostasisKatharsis.Halv')).toBeTruthy();
    // 仅展示存在的难度（AT 为 null 时不渲染）
    expect(screen.getByText('IN')).toBeTruthy();
    expect(screen.queryByText('AT')).toBeNull();

    const cover = document.querySelector('img');
    expect(cover?.getAttribute('src')).toBe(candidate.coverUrl);
    expect(cover?.getAttribute('loading')).toBe('lazy');
  });

  it('点击候选时回调对应曲目', () => {
    const onSelect = vi.fn();
    render(<SongCandidateList candidates={[candidate]} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledWith(candidate);
  });

  it('WebP 加载失败时退回 CDN PNG，再失败才退回占位图标', () => {
    render(<SongCandidateList candidates={[candidate]} onSelect={vi.fn()} />);

    const cover = document.querySelector('img');
    expect(cover?.getAttribute('src')).toBe(candidate.coverUrl);

    fireEvent.error(cover!);
    const fallback = document.querySelector('img');
    expect(fallback?.getAttribute('src')).toBe(candidate.coverFallbackUrl);

    fireEvent.error(fallback!);
    expect(document.querySelector('img')).toBeNull();
  });

  it('无曲绘时退回占位图标（不渲染 img）', () => {
    render(
      <SongCandidateList
        candidates={[{ id: 'X.Y', name: 'X', coverUrl: undefined }]}
        onSelect={vi.fn()}
      />,
    );

    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('曲师未知')).toBeTruthy();
  });

  it('总命中数多于已返回候选时给出提示', () => {
    render(<SongCandidateList candidates={[candidate]} total={12} onSelect={vi.fn()} />);

    expect(screen.getByText(/共 12 首/)).toBeTruthy();
    expect(screen.getByText(/仅展示前 1 首/)).toBeTruthy();
  });

  it('候选为空时不渲染面板', () => {
    const { container } = render(<SongCandidateList candidates={[]} onSelect={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });
});
