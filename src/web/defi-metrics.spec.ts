import { countInclusiveDays, normalizeIsoDate, resolveDefiWindow } from './defi-metrics';

describe('defi metrics helpers', () => {
  it('normalizes valid ISO dates and rejects invalid ones', () => {
    expect(normalizeIsoDate('2026-03-07')).toBe('2026-03-07');
    expect(normalizeIsoDate('2026-02-30')).toBeNull();
    expect(normalizeIsoDate('03-07-2026')).toBeNull();
  });

  it('marks ranges before availability as unavailable', () => {
    expect(
      resolveDefiWindow({
        availableFrom: '2026-03-07',
        requestedFrom: '2026-03-01',
        requestedTo: '2026-03-06',
      }),
    ).toEqual({
      status: 'unavailable',
      availableFrom: '2026-03-07',
      requestedFrom: '2026-03-01',
      requestedTo: '2026-03-06',
      effectiveFrom: null,
      effectiveTo: null,
    });
  });

  it('clamps partially overlapping ranges to the availability boundary', () => {
    expect(
      resolveDefiWindow({
        availableFrom: '2026-03-07',
        requestedFrom: '2026-03-01',
        requestedTo: '2026-03-10',
      }),
    ).toEqual({
      status: 'partial',
      availableFrom: '2026-03-07',
      requestedFrom: '2026-03-01',
      requestedTo: '2026-03-10',
      effectiveFrom: '2026-03-07',
      effectiveTo: '2026-03-10',
    });
  });

  it('rejects reversed ranges', () => {
    expect(
      resolveDefiWindow({
        availableFrom: '2026-03-07',
        requestedFrom: '2026-03-10',
        requestedTo: '2026-03-09',
      }),
    ).toEqual({
      status: 'invalid',
      availableFrom: '2026-03-07',
      requestedFrom: '2026-03-10',
      requestedTo: '2026-03-09',
      effectiveFrom: null,
      effectiveTo: null,
    });
  });

  it('stays disabled until an availability date is configured', () => {
    expect(
      resolveDefiWindow({
        requestedFrom: '2026-03-07',
        requestedTo: '2026-03-10',
      }),
    ).toEqual({
      status: 'not-configured',
      availableFrom: null,
      requestedFrom: '2026-03-07',
      requestedTo: '2026-03-10',
      effectiveFrom: null,
      effectiveTo: null,
    });
  });

  it('counts inclusive day coverage', () => {
    expect(countInclusiveDays('2026-03-07', '2026-03-10')).toBe(4);
    expect(countInclusiveDays('2026-03-10', '2026-03-07')).toBe(0);
  });
});
