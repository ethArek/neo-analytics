import { formatDate, parseDate } from '../ingestion/date-utils';
import type { SwapUsdCoverage } from '../stats/stats.service.types';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type RecentVolumeWindow = {
  from: string | null;
  to: string | null;
  expectedDays: number;
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

const countInclusiveCalendarDays = (from: string, to: string): number => {
  const start = parseDate(from).getTime();
  const end = parseDate(to).getTime();
  if (start > end) {
    return 0;
  }

  return Math.floor((end - start) / DAY_IN_MS) + 1;
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
