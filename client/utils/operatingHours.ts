import { DayHours, OperatingHours } from '../types';
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

export const parseOperatingHours = (json: string | null | undefined): OperatingHours => {
  if (!json) return DEFAULT_OPERATING_HOURS;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length === 7 && parsed.every(isValidDayHours)) {
      return parsed;
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_OPERATING_HOURS;
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

export const isClosedAt = (date: Date, hours: OperatingHours): boolean => {
  const dayHours = hours[date.getDay()];
  if (!dayHours) return true;
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes < dayHours.open * 60 || minutes >= dayHours.close * 60;
};

// A range is closed if any part of it falls outside operating hours.
// The end is exclusive so a booking ending exactly at closing time is allowed.
export const isRangeClosed = (start: Date, end: Date, hours: OperatingHours): boolean => {
  return isClosedAt(start, hours) || isClosedAt(new Date(end.getTime() - 60000), hours);
};

// Closed segments of a day, expressed in hours relative to the timeline grid
export interface ClosedRange {
  startHour: number;
  endHour: number;
}

export const getClosedRanges = (
  day: Date,
  hours: OperatingHours,
  gridOpen: number,
  gridClose: number
): ClosedRange[] => {
  const dayHours = hours[day.getDay()];
  if (!dayHours) {
    return [{ startHour: gridOpen, endHour: gridClose }];
  }
  const ranges: ClosedRange[] = [];
  if (dayHours.open > gridOpen) {
    ranges.push({ startHour: gridOpen, endHour: dayHours.open });
  }
  if (dayHours.close < gridClose) {
    ranges.push({ startHour: dayHours.close, endHour: gridClose });
  }
  return ranges;
};
