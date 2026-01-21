// Time helpers with explicit timezone support.
// Many servers run in UTC; using Date#toISOString() can shift the "business day"
// for locales like Africa/Nairobi.

const DEFAULT_TZ = process.env.APP_TIMEZONE || 'Africa/Nairobi';

function partsToObj(parts) {
  const out = {};
  for (const p of parts) {
    if (p.type !== 'literal') out[p.type] = p.value;
  }
  return out;
}

/**
 * Returns an ISO-like timestamp in the given IANA timezone.
 * Example: 2026-01-21T12:34:56
 * (No trailing 'Z' so consumers treat it as local-time string.)
 */
function nowIsoInTz(timeZone = DEFAULT_TZ) {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const p = partsToObj(fmt.formatToParts(d));
  // en-CA gives YYYY-MM-DD ordering via parts.
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

function todayInTz(timeZone = DEFAULT_TZ) {
  return nowIsoInTz(timeZone).slice(0, 10);
}

module.exports = {
  nowIsoInTz,
  todayInTz,
  DEFAULT_TZ,
};
