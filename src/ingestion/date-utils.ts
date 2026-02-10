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
  const [year, month, day] = value.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day));
};

export const yesterdayInTimeZone = (timeZone = 'Europe/Warsaw'): string => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return formatDate(yesterday, timeZone);
};
