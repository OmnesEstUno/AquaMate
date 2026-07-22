export function formatRange(range, unit) {
  if (!range || range.min == null || range.max == null) return null;
  const body = range.min === range.max ? `${range.min}` : `${range.min}–${range.max}`;
  return unit ? `${body} ${unit}` : body;
}
export function titleCase(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function depthStat(range) {
  return formatRange(range, 'm');
}
export function isMesophotic(range) {
  return !!range && range.min != null && range.min > 30;
}
