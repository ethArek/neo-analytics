import { buildRecentVolumeNotice, resolveRecentVolumeWindow } from './defi-recent-volume';

describe('defi recent volume helpers', () => {
  it('anchors the displayed recent volume window to the latest available day', () => {
    expect(resolveRecentVolumeWindow('2026-03-14', null)).toEqual({
      from: '2026-03-08',
      to: '2026-03-14',
      expectedDays: 7,
    });
  });

  it('clamps the recent volume window to the configured defi start date', () => {
    expect(resolveRecentVolumeWindow('2026-03-10', '2026-03-07')).toEqual({
      from: '2026-03-07',
      to: '2026-03-10',
      expectedDays: 4,
    });
  });

  it('explains stale ingestion and missing pricing in one notice', () => {
    expect(
      buildRecentVolumeNotice({
        latestDayLabel: '2026-03-14',
        expectedLatestDayLabel: '2026-03-27',
        missingWindowDays: 0,
        latestDayCoverage: {
          swapCount: 4,
          pricedSwapCount: 2,
          missingSwapCount: 2,
        },
        displayedCoverage: {
          swapCount: 10,
          pricedSwapCount: 7,
          missingSwapCount: 3,
        },
      }),
    ).toBe(
      'Recent DEX volume may be incomplete because latest ingested day is 2026-03-14, so newer days are not included yet, and 3 swap transactions in the displayed recent window are still missing USD pricing, including 2 swaps on 2026-03-14.',
    );
  });
});
