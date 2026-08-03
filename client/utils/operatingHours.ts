import {
  DayHours,
  Department,
  OperatingHours,
  Room,
  ScheduleException,
} from '../types';
import { OPENING_HOUR, CLOSING_HOUR } from '../constants';

export const DEFAULT_OPERATING_HOURS: OperatingHours = Array.from({ length: 7 }, () => ({
  open: OPENING_HOUR,
  close: CLOSING_HOUR,
}));

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

export const parseOperatingHoursOrNull = (json: string | null | undefined): OperatingHours | null => {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length === 7 && parsed.every(isValidDayHours)) {
      return parsed;
    }
  } catch {
    // fall through to null
  }
  return null;
};

export const parseOperatingHours = (json: string | null | undefined): OperatingHours => {
  return parseOperatingHoursOrNull(json) || DEFAULT_OPERATING_HOURS;
};

// Most specific schedule wins: room overrides department, department overrides global.
// A set schedule replaces the one above it outright - it is not intersected with it,
// so a room may open earlier or later than its department.
// Mirrors getEffectiveOperatingHours in server/src/services/settings.ts.
export const getEffectiveOperatingHours = (
  room: Room | null | undefined,
  department: Department | null | undefined,
  globalHours: OperatingHours
): OperatingHours => {
  return (
    parseOperatingHoursOrNull(room?.operatingHours) ||
    parseOperatingHoursOrNull(department?.operatingHours) ||
    globalHours
  );
};

// Grid bounds for the timeline: earliest open and latest close across open days
export const getGridBounds = (hours: OperatingHours): { open: number; close: number } => {
  const openDays = hours.filter((d): d is NonNullable<DayHours> => d !== null);
  if (openDays.length === 0) return { open: OPENING_HOUR, close: CLOSING_HOUR };
  return {
    open: Math.min(...openDays.map((d) => d.open)),
    close: Math.max(...openDays.map((d) => d.close)),
  };
};

// Find the exception applying to a calendar date for a department;
// a department-specific entry beats a service-wide one.
export const findExceptionForDate = (
  date: Date,
  departmentId: string | null | undefined,
  exceptions: ScheduleException[],
): ScheduleException | null => {
  const day = new Date(date);
  day.setHours(12, 0, 0, 0); // midday avoids boundary/timezone edge cases

  const applicable = exceptions.filter((ex) => {
    const s = new Date(ex.startDate);
    s.setHours(0, 0, 0, 0);
    const e = new Date(ex.endDate);
    e.setHours(23, 59, 59, 999);
    if (day < s || day > e) return false;
    return !ex.departmentId || ex.departmentId === (departmentId || null);
  });

  if (applicable.length === 0) return null;
  return applicable.find((ex) => !!ex.departmentId) || applicable[0];
};

// Effective hours for a specific date: exception overrides the weekly schedule
export const resolveDayHours = (
  date: Date,
  weekly: OperatingHours,
  departmentId?: string | null,
  exceptions: ScheduleException[] = [],
): { hours: DayHours; exceptionName?: string } => {
  const ex = findExceptionForDate(date, departmentId, exceptions);
  if (ex) {
    if (ex.closed) return { hours: null, exceptionName: ex.name };
    if (ex.openHour != null && ex.closeHour != null) {
      return {
        hours: { open: ex.openHour, close: ex.closeHour },
        exceptionName: ex.name,
      };
    }
  }
  return { hours: weekly[date.getDay()] };
};

export const isClosedAt = (
  date: Date,
  hours: OperatingHours,
  departmentId?: string | null,
  exceptions: ScheduleException[] = [],
): boolean => {
  const { hours: dayHours } = resolveDayHours(
    date,
    hours,
    departmentId,
    exceptions,
  );
  if (!dayHours) return true;
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes < dayHours.open * 60 || minutes >= dayHours.close * 60;
};

// A range is closed if any part of it falls outside the day's schedule.
// The end is exclusive so a booking ending exactly at closing time is allowed.
export const isRangeClosed = (
  start: Date,
  end: Date,
  hours: OperatingHours,
  departmentId?: string | null,
  exceptions: ScheduleException[] = [],
): boolean => {
  return (
    isClosedAt(start, hours, departmentId, exceptions) ||
    isClosedAt(new Date(end.getTime() - 60000), hours, departmentId, exceptions)
  );
};

// Closed segments of a day, expressed in hours relative to the timeline grid
export interface ClosedRange {
  startHour: number;
  endHour: number;
  label?: string; // exception name, e.g. "Christmas Day"
}

export const getClosedRanges = (
  day: Date,
  hours: OperatingHours,
  gridOpen: number,
  gridClose: number,
  departmentId?: string | null,
  exceptions: ScheduleException[] = [],
): ClosedRange[] => {
  const { hours: dayHours, exceptionName } = resolveDayHours(
    day,
    hours,
    departmentId,
    exceptions,
  );
  if (!dayHours) {
    return [{ startHour: gridOpen, endHour: gridClose, label: exceptionName }];
  }
  const ranges: ClosedRange[] = [];
  if (dayHours.open > gridOpen) {
    ranges.push({
      startHour: gridOpen,
      endHour: Math.min(dayHours.open, gridClose),
      label: exceptionName,
    });
  }
  if (dayHours.close < gridClose) {
    ranges.push({
      startHour: Math.max(dayHours.close, gridOpen),
      endHour: gridClose,
      label: exceptionName,
    });
  }
  return ranges;
};
