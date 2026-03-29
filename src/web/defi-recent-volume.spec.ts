import {
  buildRecentVolumeNotice,
  resolveFlamingoRecentVolume,
  resolveRecentVolumeWindow,
} from './defi-recent-volume';

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

  it('uses the latest complete Flamingo analytics day and ignores today partial row', () => {
    const result = resolveFlamingoRecentVolume({
      rows: [
        { date: '2026-03-22', swapVolume: 227846.2088, totalOrderVolume: 279274.47 },
        { date: '2026-03-23', swapVolume: 44981.9785, totalOrderVolume: 59143.37 },
        { date: '2026-03-24', swapVolume: 54598.1771, totalOrderVolume: 65922.85 },
        { date: '2026-03-25', swapVolume: 22514.208, totalOrderVolume: 22856.4 },
        { date: '2026-03-26', swapVolume: 12398.3677, totalOrderVolume: 13991.22 },
        { date: '2026-03-27', swapVolume: 27807.9501, totalOrderVolume: 29739.92 },
        { date: '2026-03-28', swapVolume: 29175.2921, totalOrderVolume: 36255.74 },
        { date: '2026-03-29', swapVolume: 1323.0355, totalOrderVolume: 1323.04 },
      ],
      expectedLatestDayLabel: '2026-03-28',
    });

    expect(result).not.toBeNull();
    expect(result?.latestDayLabel).toBe('2026-03-28');
    expect(result?.latestDayVolume).toBeCloseTo(29175.2921, 6);
    expect(result?.last7dLabel).toBe('2026-03-22 to 2026-03-28');
    expect(result?.last7dVolume).toBeCloseTo(419322.18229999996, 6);
    expect(result?.notice).toBeNull();
  });

  it('explains stale Flamingo analytics data and missing days in one notice', () => {
    const result = resolveFlamingoRecentVolume({
      rows: [
        { date: '2026-03-22', swapVolume: 1, totalOrderVolume: 1 },
        { date: '2026-03-24', swapVolume: 1, totalOrderVolume: 1 },
        { date: '2026-03-25', swapVolume: 1, totalOrderVolume: 1 },
        { date: '2026-03-26', swapVolume: 1, totalOrderVolume: 1 },
        { date: '2026-03-27', swapVolume: 1, totalOrderVolume: 1 },
      ],
      expectedLatestDayLabel: '2026-03-28',
    });

    expect(result?.notice).toBe(
      'Recent DEX volume is sourced from Flamingo Analytics swap volume and may be incomplete because latest Flamingo analytics day is 2026-03-27, so newer days are not included yet, and 1 day in the displayed recent window is not available from Flamingo Analytics.',
    );
  });
});
