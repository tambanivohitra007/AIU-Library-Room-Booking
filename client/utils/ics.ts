// Minimal iCalendar (.ics) parser for importing calendar events as closures.
// Handles the VEVENT subset relevant to holiday calendars: SUMMARY,
// DTSTART/DTEND (date or date-time, all-day DTEND is exclusive per RFC 5545),
// line folding, and text unescaping. Recurring events (RRULE) are skipped.

export interface ParsedIcsEvent {
  name: string;
  startDate: string; // YYYY-MM-DD (local, inclusive)
  endDate: string; // YYYY-MM-DD (local, inclusive)
}

export interface IcsParseResult {
  events: ParsedIcsEvent[];
  skippedRecurring: number;
  skippedInvalid: number;
}

// RFC 5545 line folding: a line starting with space/tab continues the previous one
const unfoldLines = (text: string): string[] => {
  const raw = text.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
};

const unescapeText = (value: string): string =>
  value
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');

// "20261225" or "20261225T090000Z" -> "2026-12-25" (date part only)
const toDateString = (value: string): string | null => {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = parseInt(mo, 10);
  const day = parseInt(d, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${mo}-${d}`;
};

const shiftDate = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const parseIcs = (text: string): IcsParseResult => {
  const lines = unfoldLines(text);
  const result: IcsParseResult = {
    events: [],
    skippedRecurring: 0,
    skippedInvalid: 0,
  };

  let inEvent = false;
  let summary = '';
  let dtStart = '';
  let dtEnd = '';
  let dtEndIsDate = false;
  let hasRrule = false;

  const flush = () => {
    if (hasRrule) {
      result.skippedRecurring++;
      return;
    }
    const startDate = toDateString(dtStart);
    if (!summary.trim() || !startDate) {
      result.skippedInvalid++;
      return;
    }
    let endDate = dtEnd ? toDateString(dtEnd) : null;
    if (endDate && dtEndIsDate) {
      // All-day DTEND is exclusive: DTEND of Dec 26 means "through Dec 25"
      endDate = shiftDate(endDate, -1);
    }
    if (!endDate || endDate < startDate) endDate = startDate;
    result.events.push({ name: summary.trim(), startDate, endDate });
  };

  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) {
      inEvent = true;
      summary = '';
      dtStart = '';
      dtEnd = '';
      dtEndIsDate = false;
      hasRrule = false;
      continue;
    }
    if (/^END:VEVENT/i.test(line)) {
      if (inEvent) flush();
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const propAndParams = line.slice(0, colonIdx).toUpperCase();
    const value = line.slice(colonIdx + 1);
    const prop = propAndParams.split(';')[0];

    switch (prop) {
      case 'SUMMARY':
        summary = unescapeText(value);
        break;
      case 'DTSTART':
        dtStart = value;
        break;
      case 'DTEND':
        dtEnd = value;
        dtEndIsDate = propAndParams.includes('VALUE=DATE');
        break;
      case 'RRULE':
      case 'RDATE':
        hasRrule = true;
        break;
    }
  }

  result.events.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return result;
};
