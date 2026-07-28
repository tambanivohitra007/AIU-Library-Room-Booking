import { Request } from 'express';

// Server-side message localization for user-facing API errors.
// The client sends Accept-Language: en|th (see client/services/api.ts);
// anything else falls back to English. Staff/technical errors stay English.

export type Lang = 'en' | 'th';

export const getLang = (req: Request): Lang => {
  const header = String(req.headers['accept-language'] || '').toLowerCase();
  return header.startsWith('th') ? 'th' : 'en';
};

// Normalize a stored User.language value ("en"/"th"/anything) to a Lang
export const asLang = (value: string | null | undefined): Lang =>
  value === 'th' ? 'th' : 'en';

// Locale tag for date formatting; Thai forced to the Gregorian calendar so
// years match what the client shows (default th-TH renders Buddhist Era).
export const dateLocaleTag = (lang: Lang): string =>
  lang === 'th' ? 'th-TH-u-ca-gregory' : 'en-US';

const WEEKDAYS: Record<Lang, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  th: ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'],
};

export const weekdayName = (lang: Lang, dayIndex: number): string =>
  WEEKDAYS[lang][dayIndex] ?? WEEKDAYS.en[dayIndex];

const STATUS_NAMES: Record<Lang, Record<string, string>> = {
  en: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed',
  },
  th: {
    PENDING: 'รออนุมัติ',
    CONFIRMED: 'ยืนยันแล้ว',
    CANCELLED: 'ยกเลิกแล้ว',
    COMPLETED: 'เสร็จสิ้น',
  },
};

export const statusName = (lang: Lang, status: string): string =>
  STATUS_NAMES[lang][status] ?? status.toLowerCase();

const MESSAGES = {
  pastStart: {
    en: 'Cannot book a time slot in the past. Please select a future time.',
    th: 'ไม่สามารถจองเวลาที่ผ่านมาแล้ว กรุณาเลือกเวลาในอนาคต',
  },
  pastEnd: {
    en: 'Booking end time cannot be in the past.',
    th: 'เวลาสิ้นสุดการจองต้องไม่อยู่ในอดีต',
  },
  roomNotFound: {
    en: 'Room not found',
    th: 'ไม่พบห้อง',
  },
  capacityRange: {
    en: 'This room requires between {min} and {max} people (including you).',
    th: 'ห้องนี้ต้องมีผู้เข้าใช้ {min} ถึง {max} คน (รวมคุณ)',
  },
  termsRequired: {
    en: "You must accept this room's terms and conditions to book it.",
    th: 'คุณต้องยอมรับข้อกำหนดและเงื่อนไขของห้องนี้ก่อนจอง',
  },
  sameDay: {
    en: 'Bookings must start and end on the same day.',
    th: 'การจองต้องเริ่มและสิ้นสุดภายในวันเดียวกัน',
  },
  closedForException: {
    en: 'Bookings are not available on this date: closed for {name}.',
    th: 'วันที่เลือกไม่เปิดให้จอง: ปิดทำการเนื่องใน {name}',
  },
  closedOnWeekday: {
    en: 'Bookings are not available on {weekday}s.',
    th: 'ไม่เปิดให้จองใน{weekday}',
  },
  exceptionHours: {
    en: 'On this date ({name}) bookings are only available between {open} and {close}.',
    th: 'ในวันที่เลือก ({name}) เปิดให้จองเฉพาะเวลา {open} ถึง {close}',
  },
  weekdayHours: {
    en: 'Bookings on {weekday}s are only available between {open} and {close}.',
    th: '{weekday}เปิดให้จองเฉพาะเวลา {open} ถึง {close}',
  },
  semesterOnly: {
    en: 'Bookings are only allowed within the current semester: {name} ({start} - {end})',
    th: 'สามารถจองได้เฉพาะภายในภาคการศึกษาปัจจุบัน: {name} ({start} - {end})',
  },
  slotConflict: {
    en: 'This time slot conflicts with an existing booking',
    th: 'ช่วงเวลานี้ซ้ำกับการจองที่มีอยู่แล้ว',
  },
  bookingNotFound: {
    en: 'Booking not found',
    th: 'ไม่พบการจอง',
  },
  permissionDenied: {
    en: 'Permission denied',
    th: 'ไม่มีสิทธิ์ดำเนินการ',
  },
  onlyPendingApprove: {
    en: 'Only pending bookings can be approved',
    th: 'สามารถอนุมัติได้เฉพาะการจองที่รออนุมัติ',
  },
  onlyPendingReject: {
    en: 'Only pending bookings can be rejected',
    th: 'สามารถปฏิเสธได้เฉพาะการจองที่รออนุมัติ',
  },
  alreadyPassed: {
    en: 'This booking request has already passed',
    th: 'คำขอจองนี้เลยกำหนดเวลาไปแล้ว',
  },
  rejectedDefault: {
    en: 'Booking request rejected',
    th: 'คำขอจองถูกปฏิเสธ',
  },
  cancelOwnOnly: {
    en: 'You can only cancel your own bookings',
    th: 'คุณสามารถยกเลิกได้เฉพาะการจองของตนเอง',
  },
  cannotCancelStatus: {
    en: 'Cannot cancel a {status} booking',
    th: 'ไม่สามารถยกเลิกการจองที่มีสถานะ{status}ได้',
  },
  alreadyEnded: {
    en: 'Cannot cancel a booking that has already ended',
    th: 'ไม่สามารถยกเลิกการจองที่สิ้นสุดไปแล้ว',
  },
  createFailed: {
    en: 'Failed to create booking',
    th: 'สร้างการจองไม่สำเร็จ',
  },
} as const;

export type MessageKey = keyof typeof MESSAGES;

export const tr = (
  lang: Lang,
  key: MessageKey,
  params?: Record<string, string | number>
): string => {
  let text: string = MESSAGES[key][lang] ?? MESSAGES[key].en;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.split(`{${k}}`).join(String(v));
    }
  }
  return text;
};
