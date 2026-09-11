// Dynamic Date Formatting Utilities for NetHunt

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parseDate(input) {
  if (!input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Returns full event window: e.g. "12 Sep 2026 (09:00 AM) – 18 Sep 2026 (09:00 AM)"
 */
export function formatEventWindow(startInput, endInput) {
  const s = parseDate(startInput);
  const e = parseDate(endInput);
  if (!s || !e) return '12 Sep 2026 (09:00 AM) – 18 Sep 2026 (09:00 AM)';

  const pad = (n) => String(n).padStart(2, '0');
  const sHours = s.getHours() % 12 || 12;
  const sAm = s.getHours() >= 12 ? 'PM' : 'AM';
  const eHours = e.getHours() % 12 || 12;
  const eAm = e.getHours() >= 12 ? 'PM' : 'AM';

  const sStr = `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} ${s.getFullYear()} (${pad(sHours)}:${pad(s.getMinutes())} ${sAm})`;
  const eStr = `${e.getDate()} ${MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()} (${pad(eHours)}:${pad(e.getMinutes())} ${eAm})`;
  return `${sStr} – ${eStr}`;
}

/**
 * Returns concise header window: e.g. "12–18 SEP 2026" or "12 SEP – 18 OCT 2026"
 */
export function formatShortEventWindow(startInput, endInput) {
  const s = parseDate(startInput);
  const e = parseDate(endInput);
  if (!s || !e) return '12–18 SEP 2026';

  const sMonth = MONTHS_SHORT[s.getMonth()].toUpperCase();
  const eMonth = MONTHS_SHORT[e.getMonth()].toUpperCase();

  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${sMonth} ${s.getFullYear()}`;
  }
  if (s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} ${sMonth} – ${e.getDate()} ${eMonth} ${s.getFullYear()}`;
  }
  return `${s.getDate()} ${sMonth} ${s.getFullYear()} – ${e.getDate()} ${eMonth} ${e.getFullYear()}`;
}

/**
 * Returns full date time IST: e.g. "12th Sep 2026 at 9:00 AM IST"
 */
export function formatEventDateFull(dateInput) {
  const d = parseDate(dateInput);
  if (!d) return '12th Sep 2026 at 9:00 AM IST';

  const day = d.getDate();
  const suffix = (day === 1 || day === 21 || day === 31) ? 'st' :
                 (day === 2 || day === 22) ? 'nd' :
                 (day === 3 || day === 23) ? 'rd' : 'th';
  const pad = (n) => String(n).padStart(2, '0');
  const hours = d.getHours() % 12 || 12;
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';

  return `${day}${suffix} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()} at ${pad(hours)}:${pad(d.getMinutes())} ${ampm} IST`;
}

/**
 * Returns simple date range: e.g. "12th Sep – 18th Sep 2026"
 */
export function formatSimpleDateRange(startInput, endInput) {
  const s = parseDate(startInput);
  const e = parseDate(endInput);
  if (!s || !e) return '12th Sep – 18th Sep 2026';

  const getDayWithSuffix = (day) => {
    const suffix = (day === 1 || day === 21 || day === 31) ? 'st' :
                   (day === 2 || day === 22) ? 'nd' :
                   (day === 3 || day === 23) ? 'rd' : 'th';
    return `${day}${suffix}`;
  };

  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${getDayWithSuffix(s.getDate())} – ${getDayWithSuffix(e.getDate())} ${MONTHS_SHORT[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${getDayWithSuffix(s.getDate())} ${MONTHS_SHORT[s.getMonth()]} – ${getDayWithSuffix(e.getDate())} ${MONTHS_SHORT[e.getMonth()]} ${s.getFullYear()}`;
}
