// Dynamic Date Formatting Utilities for NetHunt (Anchored strictly to Asia/Kolkata IST)

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parseDate(input) {
  if (!input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

// Helper: Extract date components in Asia/Kolkata (IST) timezone
function getISTParts(dateInput) {
  const d = parseDate(dateInput);
  if (!d) return null;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const parts = formatter.formatToParts(d);
    const map = {};
    for (const p of parts) map[p.type] = p.value;
    const hourPad = String(map.hour).padStart(2, '0');
    const dayPeriod = (map.dayPeriod || 'AM').toUpperCase();
    return {
      day: parseInt(map.day, 10),
      dayStr: map.day,
      monthShort: map.month,
      monthIndex: MONTHS_SHORT.indexOf(map.month),
      year: parseInt(map.year, 10),
      hourStr: hourPad,
      minuteStr: String(map.minute).padStart(2, '0'),
      ampm: dayPeriod
    };
  } catch (err) {
    const pad = (n) => String(n).padStart(2, '0');
    const h = d.getHours() % 12 || 12;
    return {
      day: d.getDate(),
      dayStr: String(d.getDate()),
      monthShort: MONTHS_SHORT[d.getMonth()],
      monthIndex: d.getMonth(),
      year: d.getFullYear(),
      hourStr: pad(h),
      minuteStr: pad(d.getMinutes()),
      ampm: d.getHours() >= 12 ? 'PM' : 'AM'
    };
  }
}

/**
 * Returns full event window in IST: e.g. "12 Sep 2026 (09:00 AM) – 18 Sep 2026 (09:00 AM)"
 */
export function formatEventWindow(startInput, endInput) {
  const s = getISTParts(startInput);
  const e = getISTParts(endInput);
  if (!s || !e) return '12 Sep 2026 (09:00 AM) – 18 Sep 2026 (09:00 AM)';

  const sStr = `${s.dayStr} ${s.monthShort} ${s.year} (${s.hourStr}:${s.minuteStr} ${s.ampm})`;
  const eStr = `${e.dayStr} ${e.monthShort} ${e.year} (${e.hourStr}:${e.minuteStr} ${e.ampm})`;
  return `${sStr} – ${eStr}`;
}

/**
 * Returns concise header window in IST: e.g. "12–18 SEP 2026" or "12 SEP – 18 OCT 2026"
 */
export function formatShortEventWindow(startInput, endInput) {
  const s = getISTParts(startInput);
  const e = getISTParts(endInput);
  if (!s || !e) return '12–18 SEP 2026';

  const sMonth = s.monthShort.toUpperCase();
  const eMonth = e.monthShort.toUpperCase();

  if (s.year === e.year && s.monthShort === e.monthShort) {
    return `${s.day}–${e.day} ${sMonth} ${s.year}`;
  }
  if (s.year === e.year) {
    return `${s.day} ${sMonth} – ${e.day} ${eMonth} ${s.year}`;
  }
  return `${s.day} ${sMonth} ${s.year} – ${e.day} ${eMonth} ${e.year}`;
}

/**
 * Returns full date time IST: e.g. "12th Sep 2026 at 09:00 AM IST"
 */
export function formatEventDateFull(dateInput) {
  const p = getISTParts(dateInput);
  if (!p) return '12th Sep 2026 at 09:00 AM IST';

  const day = p.day;
  const suffix = (day === 1 || day === 21 || day === 31) ? 'st' :
                 (day === 2 || day === 22) ? 'nd' :
                 (day === 3 || day === 23) ? 'rd' : 'th';

  return `${day}${suffix} ${p.monthShort} ${p.year} at ${p.hourStr}:${p.minuteStr} ${p.ampm} IST`;
}

/**
 * Returns simple date range in IST: e.g. "12th Sep – 18th Sep 2026"
 */
export function formatSimpleDateRange(startInput, endInput) {
  const s = getISTParts(startInput);
  const e = getISTParts(endInput);
  if (!s || !e) return '12th Sep – 18th Sep 2026';

  const getDayWithSuffix = (day) => {
    const suffix = (day === 1 || day === 21 || day === 31) ? 'st' :
                   (day === 2 || day === 22) ? 'nd' :
                   (day === 3 || day === 23) ? 'rd' : 'th';
    return `${day}${suffix}`;
  };

  if (s.year === e.year && s.monthShort === e.monthShort) {
    return `${getDayWithSuffix(s.day)} – ${getDayWithSuffix(e.day)} ${s.monthShort} ${s.year}`;
  }
  return `${getDayWithSuffix(s.day)} ${s.monthShort} – ${getDayWithSuffix(e.day)} ${e.monthShort} ${s.year}`;
}
