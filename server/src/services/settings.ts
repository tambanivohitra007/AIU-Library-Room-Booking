import { PrismaClient, ServiceSettings } from '@prisma/client';
import { Lang, tr, weekdayName } from './i18n.js';

const prisma = new PrismaClient();

export const DEFAULT_OPEN_HOUR = 8;
export const DEFAULT_CLOSE_HOUR = 22;

// One entry per weekday (0 = Sunday .. 6 = Saturday); null = closed all day
export type DayHours = { open: number; close: number } | null;
export type OperatingHours = DayHours[];

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DEFAULT_OPERATING_HOURS: OperatingHours = Array.from({ length: 7 }, () => ({
  open: DEFAULT_OPEN_HOUR,
  close: DEFAULT_CLOSE_HOUR,
}));

// The settings table is a singleton row; create it with defaults on first access
export const getServiceSettings = async (): Promise<ServiceSettings> => {
  const existing = await prisma.serviceSettings.findFirst();
  if (existing) return existing;

  return prisma.serviceSettings.create({
    data: {
      serviceName: 'Room Booking',
      description: 'Room booking system',
    },
  });
};

// Upper bound on the notice period an admin can demand (7 days). Anything
// larger is a mistyped value rather than a policy, and would quietly make
// approval-gated rooms unbookable.
export const MAX_APPROVAL_LEAD_MINUTES = 7 * 24 * 60;

// Stored as a plain Int, so guard against a value written before validation
// existed (or edited directly in the DB) turning every request into an error.
export const getApprovalLeadMinutes = (settings: ServiceSettings): number => {
  const raw = (settings as { approvalLeadTimeMinutes?: number }).approvalLeadTimeMinutes;
  if (!Number.isFinite(raw) || (raw as number) <= 0) return 0;
  return Math.min(Math.floor(raw as number), MAX_APPROVAL_LEAD_MINUTES);
};

// Human-readable notice period, used in the booking-rejection message
export const formatLeadTime = (minutes: number, lang: Lang): string => {
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1
      ? tr(lang, 'durationHour')
      : tr(lang, 'durationHours', { count: hours });
  }
  return minutes === 1
    ? tr(lang, 'durationMinute')
    : tr(lang, 'durationMinutes', { count: minutes });
};

export const parseAllowedDomains = (settings: ServiceSettings): string[] => {
  return (settings.allowedEmailDomains || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
};

// Empty domain list = open registration (any domain accepted)
export const isEmailAllowed = (email: string, settings: ServiceSettings): boolean => {
  const domains = parseAllowedDomains(settings);
  if (domains.length === 0) return true;
  const emailLower = email.toLowerCase();
  return domains.some((d) => emailLower.endsWith(`@${d}`));
};

export const allowedDomainsMessage = (settings: ServiceSettings): string => {
  const domains = parseAllowedDomains(settings);
  return `Access restricted. Please use an email from: ${domains.map((d) => `@${d}`).join(', ')}`;
};

const isValidDayHours = (entry: unknown): entry is DayHours => {
  if (entry === null) return true;
  if (typeof entry !== 'object') return false;
  const { open, close } = entry as { open?: unknown; close?: unknown };
  return (
    Number.isInteger(open) &&
    Number.isInteger(close) &&
    (open as number) >= 0 &&
    (close as number) <= 24 &&
    (open as number) < (close as number)
  );
};

export const parseOperatingHoursJson = (json: string | null | undefined): OperatingHours | null => {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length !== 7 || !parsed.every(isValidDayHours)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const getOperatingHours = (settings: ServiceSettings): OperatingHours => {
  return parseOperatingHoursJson(settings.operatingHours) || DEFAULT_OPERATING_HOURS;
};

// Most specific schedule wins: room overrides department, department overrides global.
// A set schedule replaces the one above it outright - it is not intersected with it,
// so a room may open earlier or later than its department.
export const getEffectiveOperatingHours = (
  settings: ServiceSettings,
  departmentHours: string | null | undefined,
  roomHours?: string | null
): OperatingHours => {
  return (
    parseOperatingHoursJson(roomHours) ||
    parseOperatingHoursJson(departmentHours) ||
    getOperatingHours(settings)
  );
};

const formatHour = (h: number) => `${h}:00`;

// A schedule exception row as needed for resolution (matches ScheduleException)
export interface ExceptionLike {
  name: string;
  startDate: Date;
  endDate: Date;
  closed: boolean;
  openHour: number | null;
  closeHour: number | null;
  departmentId: string | null;
}

// Find the exception applying to a calendar date for a department;
// a department-specific entry beats a service-wide one.
export const findException = (
  date: Date,
  departmentId: string | null | undefined,
  exceptions: ExceptionLike[]
): ExceptionLike | null => {
  const day = new Date(date);
  day.setHours(12, 0, 0, 0); // midday avoids boundary/timezone edge cases

  const applicable = exceptions.filter((ex) => {
    const s = new Date(ex.startDate);
    s.setHours(0, 0, 0, 0);
    const e = new Date(ex.endDate);
    e.setHours(23, 59, 59, 999);
    if (day < s || day > e) return false;
    return ex.departmentId === null || ex.departmentId === (departmentId || null);
  });

  if (applicable.length === 0) return null;
  return (
    applicable.find((ex) => ex.departmentId !== null) || applicable[0]
  );
};

// Effective hours for a specific date: exception overrides the weekly schedule
export const resolveDayHours = (
  date: Date,
  weekly: OperatingHours,
  departmentId: string | null | undefined,
  exceptions: ExceptionLike[]
): { hours: DayHours; exceptionName?: string } => {
  const ex = findException(date, departmentId, exceptions);
  if (ex) {
    if (ex.closed) return { hours: null, exceptionName: ex.name };
    if (ex.openHour !== null && ex.closeHour !== null) {
      return {
        hours: { open: ex.openHour, close: ex.closeHour },
        exceptionName: ex.name,
      };
    }
  }
  return { hours: weekly[date.getDay()] };
};

// Validates that a booking falls entirely within the schedule of its day,
// including date-specific exceptions. Local-timezone semantics throughout.
export const checkBookingSchedule = (
  start: Date,
  end: Date,
  weekly: OperatingHours,
  departmentId: string | null | undefined,
  exceptions: ExceptionLike[],
  lang: Lang = 'en'
): { ok: true } | { ok: false; error: string } => {
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  let endMinutes: number;
  if (sameDay) {
    endMinutes = end.getHours() * 60 + end.getMinutes();
  } else {
    const midnight = new Date(start);
    midnight.setHours(24, 0, 0, 0);
    if (end.getTime() === midnight.getTime()) {
      endMinutes = 24 * 60;
    } else {
      return { ok: false, error: tr(lang, 'sameDay') };
    }
  }

  const { hours: dayHours, exceptionName } = resolveDayHours(
    start,
    weekly,
    departmentId,
    exceptions
  );

  if (!dayHours) {
    return {
      ok: false,
      error: exceptionName
        ? tr(lang, 'closedForException', { name: exceptionName })
        : tr(lang, 'closedOnWeekday', { weekday: weekdayName(lang, start.getDay()) }),
    };
  }

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  if (startMinutes < dayHours.open * 60 || endMinutes > dayHours.close * 60) {
    const open = formatHour(dayHours.open);
    const close = formatHour(dayHours.close);
    return {
      ok: false,
      error: exceptionName
        ? tr(lang, 'exceptionHours', { name: exceptionName, open, close })
        : tr(lang, 'weekdayHours', {
            weekday: weekdayName(lang, start.getDay()),
            open,
            close,
          }),
    };
  }

  return { ok: true };
};

// Validates that a booking falls entirely within the operating hours of its day.
// Times are interpreted in the server's local timezone, consistent with the rest of the API.
export const checkWithinOperatingHours = (
  start: Date,
  end: Date,
  hours: OperatingHours
): { ok: true } | { ok: false; error: string } => {
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  let endMinutes: number;
  if (sameDay) {
    endMinutes = end.getHours() * 60 + end.getMinutes();
  } else {
    // Allow an end at exactly midnight following the start day (close = 24)
    const midnight = new Date(start);
    midnight.setHours(24, 0, 0, 0);
    if (end.getTime() === midnight.getTime()) {
      endMinutes = 24 * 60;
    } else {
      return { ok: false, error: 'Bookings must start and end on the same day.' };
    }
  }

  const day = start.getDay();
  const dayHours = hours[day];

  if (!dayHours) {
    return { ok: false, error: `Bookings are not available on ${WEEKDAY_NAMES[day]}s.` };
  }

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  if (startMinutes < dayHours.open * 60 || endMinutes > dayHours.close * 60) {
    return {
      ok: false,
      error: `Bookings on ${WEEKDAY_NAMES[day]}s are only available between ${formatHour(dayHours.open)} and ${formatHour(dayHours.close)}.`,
    };
  }

  return { ok: true };
};
