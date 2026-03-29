import { formatDate, parseDate } from '../ingestion/date-utils';
import type { SwapUsdCoverage } from '../stats/stats.service.types';
import type { FlamingoDexVolumeRow } from './token-performance.service.types';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type RecentVolumeWindow = {
  from: string | null;
  to: string | null;
  expectedDays: number;
};

export type FlamingoRecentVolume = {
  latestDayLabel: string;
  latestDayVolume: number;
  last7dLabel: string;
  last7dVolume: number;
  notice: string | null;
};

type BuildRecentVolumeNoticeArgs = {
  latestDayLabel: string | null;
  expectedLatestDayLabel: string;
  missingWindowDays: number;
  latestDayCoverage: SwapUsdCoverage;
  displayedCoverage: SwapUsdCoverage;
};

export const resolveRecentVolumeWindow = (
  latestDayLabel: string | null,
  availableFrom: string | null,
): RecentVolumeWindow => {
  if (!latestDayLabel) {
    return {
      from: null,
      to: null,
      expectedDays: 0,
    };
  }

  const requestedFrom = formatDate(
    new Date(parseDate(latestDayLabel).getTime() - 6 * DAY_IN_MS),
    'UTC',
  );
  const from = availableFrom && requestedFrom < availableFrom ? availableFrom : requestedFrom;

  return {
    from,
    to: latestDayLabel,
    expectedDays: countInclusiveCalendarDays(from, latestDayLabel),
  };
};

export const buildRecentVolumeNotice = ({
  latestDayLabel,
  expectedLatestDayLabel,
  missingWindowDays,
  latestDayCoverage,
  displayedCoverage,
}: BuildRecentVolumeNoticeArgs): string | null => {
  if (!latestDayLabel) {
    return null;
  }

  const reasons: string[] = [];
  if (latestDayLabel < expectedLatestDayLabel) {
    reasons.push(`latest ingested day is ${latestDayLabel}, so newer days are not included yet`);
  }

  if (missingWindowDays > 0) {
    reasons.push(
      `${formatCountLabel(missingWindowDays, 'day')} in the displayed recent window ${
        missingWindowDays === 1 ? 'has' : 'have'
      } not been ingested yet`,
    );
  }

  if (displayedCoverage.missingSwapCount > 0) {
    if (latestDayCoverage.missingSwapCount > 0) {
      reasons.push(
        `${formatCountLabel(
          displayedCoverage.missingSwapCount,
          'swap transaction',
        )} in the displayed recent window ${
          displayedCoverage.missingSwapCount === 1 ? 'is' : 'are'
        } still missing USD pricing, including ${formatCountLabel(
          latestDayCoverage.missingSwapCount,
          'swap',
        )} on ${latestDayLabel}`,
      );
    } else {
      reasons.push(
        `${formatCountLabel(
          displayedCoverage.missingSwapCount,
          'swap transaction',
        )} in the displayed recent window ${
          displayedCoverage.missingSwapCount === 1 ? 'is' : 'are'
        } still missing USD pricing`,
      );
    }
  }

  if (reasons.length === 0) {
    return null;
  }

  return `Recent DEX volume may be incomplete because ${joinClauses(reasons)}.`;
};

export const resolveFlamingoRecentVolume = ({
  rows,
  expectedLatestDayLabel,
}: {
  rows: FlamingoDexVolumeRow[];
  expectedLatestDayLabel: string;
}): FlamingoRecentVolume | null => {
  const completeRows = rows
    .filter((row) => row.date <= expectedLatestDayLabel)
    .sort((left, right) => left.date.localeCompare(right.date));
  const latestDay = completeRows[completeRows.length - 1];
  if (!latestDay) {
    return null;
  }

  const availableFrom = completeRows[0]?.date ?? null;
  const window = resolveRecentVolumeWindow(latestDay.date, availableFrom);
  if (!window.from || !window.to) {
    return null;
  }

  const from = window.from;
  const to = window.to;
  const windowRows = completeRows.filter((row) => row.date >= from && row.date <= to);
  const last7dVolume = windowRows.reduce((total, row) => total + row.swapVolume, 0);
  const missingWindowDays = Math.max(0, window.expectedDays - windowRows.length);

  return {
    latestDayLabel: latestDay.date,
    latestDayVolume: latestDay.swapVolume,
    last7dLabel: `${from} to ${to}`,
    last7dVolume,
    notice: buildFlamingoRecentVolumeNotice({
      latestDayLabel: latestDay.date,
      expectedLatestDayLabel,
      missingWindowDays,
    }),
  };
};

const countInclusiveCalendarDays = (from: string, to: string): number => {
  const start = parseDate(from).getTime();
  const end = parseDate(to).getTime();
  if (start > end) {
    return 0;
  }

  return Math.floor((end - start) / DAY_IN_MS) + 1;
};

const buildFlamingoRecentVolumeNotice = ({
  latestDayLabel,
  expectedLatestDayLabel,
  missingWindowDays,
}: {
  latestDayLabel: string;
  expectedLatestDayLabel: string;
  missingWindowDays: number;
}): string | null => {
  const reasons: string[] = [];
  if (latestDayLabel < expectedLatestDayLabel) {
    reasons.push(
      `latest Flamingo analytics day is ${latestDayLabel}, so newer days are not included yet`,
    );
  }

  if (missingWindowDays > 0) {
    reasons.push(
      `${formatCountLabel(missingWindowDays, 'day')} in the displayed recent window ${
        missingWindowDays === 1 ? 'is' : 'are'
      } not available from Flamingo Analytics`,
    );
  }

  if (reasons.length === 0) {
    return null;
  }

  return `Recent DEX volume is sourced from Flamingo Analytics swap volume and may be incomplete because ${joinClauses(
    reasons,
  )}.`;
};

const formatCountLabel = (count: number, singular: string): string => {
  if (count === 1) {
    return `1 ${singular}`;
  }

  return `${count} ${singular}s`;
};

const joinClauses = (values: string[]): string => {
  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]}, and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
};
