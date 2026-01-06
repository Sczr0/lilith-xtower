import { describe, expect, it } from 'vitest';
import { computeNextAnnouncementModalStep } from '../AnnouncementModal';

describe('computeNextAnnouncementModalStep', () => {
  it('returns close when there is no visible announcement', () => {
    expect(
      computeNextAnnouncementModalStep({ visibleIndex: 0, visibleCount: 0, dismissCurrent: false }),
    ).toEqual({ kind: 'close' });
  });

  it('returns close when current is the last visible item', () => {
    expect(
      computeNextAnnouncementModalStep({ visibleIndex: 0, visibleCount: 1, dismissCurrent: false }),
    ).toEqual({ kind: 'close' });
    expect(
      computeNextAnnouncementModalStep({ visibleIndex: 2, visibleCount: 3, dismissCurrent: true }),
    ).toEqual({ kind: 'close' });
  });

  it('keeps index when dismissing current (next item shifts into place)', () => {
    expect(
      computeNextAnnouncementModalStep({ visibleIndex: 0, visibleCount: 2, dismissCurrent: true }),
    ).toEqual({ kind: 'advance', nextIndex: 0 });
    expect(
      computeNextAnnouncementModalStep({ visibleIndex: 1, visibleCount: 3, dismissCurrent: true }),
    ).toEqual({ kind: 'advance', nextIndex: 1 });
  });

  it('advances index when not dismissing current', () => {
    expect(
      computeNextAnnouncementModalStep({ visibleIndex: 0, visibleCount: 2, dismissCurrent: false }),
    ).toEqual({ kind: 'advance', nextIndex: 1 });
    expect(
      computeNextAnnouncementModalStep({ visibleIndex: -1, visibleCount: 3, dismissCurrent: false }),
    ).toEqual({ kind: 'advance', nextIndex: 1 });
  });

  it('clamps out-of-range index to avoid producing invalid nextIndex', () => {
    expect(
      computeNextAnnouncementModalStep({ visibleIndex: 999, visibleCount: 2, dismissCurrent: true }),
    ).toEqual({ kind: 'close' });
    expect(
      computeNextAnnouncementModalStep({ visibleIndex: 999, visibleCount: 3, dismissCurrent: true }),
    ).toEqual({ kind: 'close' });
    expect(
      computeNextAnnouncementModalStep({ visibleIndex: 999, visibleCount: 3, dismissCurrent: false }),
    ).toEqual({ kind: 'close' });
  });
});

