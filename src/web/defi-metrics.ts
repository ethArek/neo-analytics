import { formatDate, parseDate } from '../ingestion/date-utils';
import type { ResolveDefiWindowOptions, ResolvedDefiWindow } from './defi-metrics.types';

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

export const normalizeIsoDate = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!isoDatePattern.test(trimmed)) {
    return null;
  }

  const parsed = parseDate(trimmed);
  if (formatDate(parsed, 'UTC') !== trimmed) {
    return null;
  }

  return trimmed;
};

export const resolveDefiWindow = ({
  availableFrom,
  requestedFrom,
  requestedTo,
  fallbackFrom,
  fallbackTo,
}: ResolveDefiWindowOptions): ResolvedDefiWindow => {
  const normalizedAvailableFrom = normalizeIsoDate(availableFrom);
  const normalizedRequestedFrom = normalizeIsoDate(requestedFrom) ?? normalizeIsoDate(fallbackFrom);
  const normalizedRequestedTo =
    normalizeIsoDate(requestedTo) ?? normalizeIsoDate(fallbackTo) ?? normalizedRequestedFrom;

  if (
    normalizedRequestedFrom &&
    normalizedRequestedTo &&
    normalizedRequestedFrom > normalizedRequestedTo
  ) {
    return {
      status: 'invalid',
      availableFrom: normalizedAvailableFrom,
      requestedFrom: normalizedRequestedFrom,
      requestedTo: normalizedRequestedTo,
      effectiveFrom: null,
      effectiveTo: null,
    };
  }

  if (!normalizedAvailableFrom) {
    return {
      status: 'not-configured',
      availableFrom: null,
      requestedFrom: normalizedRequestedFrom,
      requestedTo: normalizedRequestedTo,
      effectiveFrom: null,
      effectiveTo: null,
    };
  }

  if (!normalizedRequestedFrom || !normalizedRequestedTo) {
    return {
      status: 'unavailable',
      availableFrom: normalizedAvailableFrom,
      requestedFrom: normalizedRequestedFrom,
      requestedTo: normalizedRequestedTo,
      effectiveFrom: null,
      effectiveTo: null,
    };
  }

  if (normalizedRequestedTo < normalizedAvailableFrom) {
    return {
      status: 'unavailable',
      availableFrom: normalizedAvailableFrom,
      requestedFrom: normalizedRequestedFrom,
      requestedTo: normalizedRequestedTo,
      effectiveFrom: null,
      effectiveTo: null,
    };
  }

  const effectiveFrom =
    normalizedRequestedFrom < normalizedAvailableFrom
      ? normalizedAvailableFrom
      : normalizedRequestedFrom;

  return {
    status: effectiveFrom === normalizedRequestedFrom ? 'ready' : 'partial',
    availableFrom: normalizedAvailableFrom,
    requestedFrom: normalizedRequestedFrom,
    requestedTo: normalizedRequestedTo,
    effectiveFrom,
    effectiveTo: normalizedRequestedTo,
  };
};

export const countInclusiveDays = (from?: string | null, to?: string | null): number => {
  const normalizedFrom = normalizeIsoDate(from);
  const normalizedTo = normalizeIsoDate(to);
  if (!normalizedFrom || !normalizedTo || normalizedFrom > normalizedTo) {
    return 0;
  }

  const start = parseDate(normalizedFrom);
  const end = parseDate(normalizedTo);

  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
};
