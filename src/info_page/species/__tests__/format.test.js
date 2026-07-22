import { formatRange, titleCase, depthStat, isMesophotic } from '../format';

describe('formatRange', () => {
  test('formats a numeric range with a unit', () => {
    expect(formatRange({ min: 24, max: 30 }, '°C')).toBe('24–30 °C');
  });
  test('collapses equal min/max', () => {
    expect(formatRange({ min: 5, max: 5 }, 'cm')).toBe('5 cm');
  });
  test('returns null for a null range', () => {
    expect(formatRange(null, 'cm')).toBeNull();
  });
});

describe('titleCase', () => {
  test('capitalizes an enum token', () => {
    expect(titleCase('semi-aggressive')).toBe('Semi-aggressive');
  });
});

describe('depth', () => {
  test('depthStat renders metres', () => {
    expect(depthStat({ min: 2, max: 55 })).toBe('2–55 m');
  });
  test('isMesophotic true when min > 30', () => {
    expect(isMesophotic({ min: 40, max: 80 })).toBe(true);
    expect(isMesophotic({ min: 2, max: 55 })).toBe(false);
  });
});
