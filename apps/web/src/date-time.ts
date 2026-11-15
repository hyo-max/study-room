/** Preserve server precision while displaying the wall-clock value in KST. */
export function inputDate(at: string) {
  return new Date(Date.parse(at) + 9 * 3600000).toISOString().slice(0, -1);
}
/** datetime-local may return minutes, seconds, or milliseconds; always interpret it as KST. */
export function iso(at: string) {
  return new Date(`${at}+09:00`).toISOString();
}

function clockOptions(at: Date): Intl.DateTimeFormatOptions {
  return {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(at.getUTCSeconds() || at.getUTCMilliseconds() ? { second: '2-digit' as const } : {}),
    ...(at.getUTCMilliseconds() ? { fractionalSecondDigits: 3 as const } : {}),
  };
}
/** Include the year and retain nonzero sub-minute precision in visible history. */
export function fmt(value: string, dateOnly = false) {
  const at = new Date(value);
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    ...(dateOnly ? {} : clockOptions(at)),
  }).format(at);
}
export function time(value: string) {
  const at = new Date(value);
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', ...clockOptions(at) }).format(
    at,
  );
}
