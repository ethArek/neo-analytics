import { formatDate, parseDate, yesterdayInTimeZone } from './date-utils';

describe('date-utils', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('formats dates in the selected timezone', () => {
    const input = new Date('2024-05-01T23:30:00.000Z');

    expect(formatDate(input, 'UTC')).toBe('2024-05-01');
    expect(formatDate(input, 'Asia/Tokyo')).toBe('2024-05-02');
  });

  it('falls back to empty date parts when formatter parts are missing', () => {
    const fakeParts: Intl.DateTimeFormatPart[] = [
      {
        type: 'year',
        value: '2024',
      },
    ];
    const partsSpy = jest
      .spyOn(Intl.DateTimeFormat.prototype, 'formatToParts')
      .mockReturnValue(fakeParts);

    expect(formatDate(new Date('2024-05-01T00:00:00.000Z'), 'UTC')).toBe('2024--');
    expect(partsSpy).toHaveBeenCalled();
  });

  it('parses YYYY-MM-DD into a UTC date', () => {
    const parsed = parseDate('2024-05-09');

    expect(parsed.toISOString()).toBe('2024-05-09T00:00:00.000Z');
  });

  it('returns yesterday for a timezone using deterministic system time', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-05-11T08:00:00.000Z'));

    expect(yesterdayInTimeZone('UTC')).toBe('2024-05-10');
  });
});
