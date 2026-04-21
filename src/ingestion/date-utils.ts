const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const formatDateParts = (
  date: Date,
  timeZone: string,
): { year: string; month: string; day: string } => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';

  return { year: get('year'), month: get('month'), day: get('day') };
};

export const formatDate = (date: Date, timeZone = 'Europe/Warsaw'): string => {
  const { year, month, day } = formatDateParts(date, timeZone);
  return `${year}-${month}-${day}`;
};

export const parseDate = (value: string): Date => {
  if (!isoDatePattern.test(value)) {
    throw new RangeError(`Invalid date "${value}". Expected YYYY-MM-DD.`);
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime()) || formatDate(parsed, 'UTC') !== value) {
    throw new RangeError(`Invalid date "${value}". Expected YYYY-MM-DD.`);
  }

  return parsed;
};

export const isValidIsoDate = (value: string): boolean => {
  try {
    parseDate(value);
    return true;
  } catch (_error) {
    return false;
  }
};

export const validateOptionalDateRange = (
  from?: string,
  to?: string,
): { from?: Date; to?: Date } => {
  let parsedFrom: Date | undefined;
  let parsedTo: Date | undefined;

  if (from) {
    try {
      parsedFrom = parseDate(from);
    } catch (_error) {
      throw new RangeError('Invalid "from" date. Expected YYYY-MM-DD.');
    }
  }

  if (to) {
    try {
      parsedTo = parseDate(to);
    } catch (_error) {
      throw new RangeError('Invalid "to" date. Expected YYYY-MM-DD.');
    }
  }

  if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
    throw new RangeError('The "from" date must be on or before the "to" date.');
  }

  return { from: parsedFrom, to: parsedTo };
};

export const yesterdayInTimeZone = (timeZone = 'Europe/Warsaw'): string => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return formatDate(yesterday, timeZone);
};
