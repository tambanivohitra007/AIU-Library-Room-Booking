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
  approvalLeadTime: {
    en: 'This room needs approval, so requests must be made at least {duration} before the booking starts. Please choose a later time.',
    th: 'ห้องนี้ต้องได้รับการอนุมัติ จึงต้องส่งคำขอล่วงหน้าอย่างน้อย {duration} ก่อนเวลาเริ่มจอง กรุณาเลือกเวลาที่ช้ากว่านี้',
  },
  durationMinute: {
    en: '1 minute',
    th: '1 นาที',
  },
  durationMinutes: {
    en: '{count} minutes',
    th: '{count} นาที',
  },
  durationHour: {
    en: '1 hour',
    th: '1 ชั่วโมง',
  },
  durationHours: {
    en: '{count} hours',
    th: '{count} ชั่วโมง',
  },
  invalidApprovalLeadTime: {
    en: 'Approval notice must be a whole number of minutes between 0 and 10080 (7 days).',
    th: 'ระยะเวลาแจ้งล่วงหน้าสำหรับการอนุมัติต้องเป็นจำนวนเต็มนาทีระหว่าง 0 ถึง 10080 (7 วัน)',
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
  autoCancelledUnapproved: {
    en: 'Not approved before the booking start time',
    th: 'ไม่ได้รับการอนุมัติก่อนถึงเวลาเริ่มจอง',
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

  // --- Bookings (remaining) ---
  fetchBookingsFailed: {
    en: 'Failed to fetch bookings',
    th: 'ดึงข้อมูลการจองไม่สำเร็จ',
  },
  fetchBookingFailed: {
    en: 'Failed to fetch booking',
    th: 'ดึงข้อมูลการจองไม่สำเร็จ',
  },
  missingFields: {
    en: 'Missing required fields',
    th: 'กรอกข้อมูลไม่ครบถ้วน',
  },
  checkConflictsFailed: {
    en: 'Failed to check conflicts',
    th: 'ตรวจสอบการจองซ้ำไม่สำเร็จ',
  },
  approveFailed: {
    en: 'Failed to approve booking',
    th: 'อนุมัติการจองไม่สำเร็จ',
  },
  rejectFailed: {
    en: 'Failed to reject booking',
    th: 'ปฏิเสธการจองไม่สำเร็จ',
  },
  cancelFailed: {
    en: 'Failed to cancel booking',
    th: 'ยกเลิกการจองไม่สำเร็จ',
  },
  remindConfirmedOnly: {
    en: 'Can only remind for confirmed bookings',
    th: 'ส่งการแจ้งเตือนได้เฉพาะการจองที่ยืนยันแล้ว',
  },
  remindNotCompleted: {
    en: 'Cannot remind for completed bookings',
    th: 'ไม่สามารถส่งการแจ้งเตือนสำหรับการจองที่เสร็จสิ้นแล้ว',
  },
  reminderSent: {
    en: 'Reminder sent successfully',
    th: 'ส่งการแจ้งเตือนเรียบร้อยแล้ว',
  },
  reminderFailed: {
    en: 'Failed to send reminder',
    th: 'ส่งการแจ้งเตือนไม่สำเร็จ',
  },
  userNoEmail: {
    en: 'User has no email address',
    th: 'ผู้ใช้ไม่มีที่อยู่อีเมล',
  },

  // --- Auth / session ---
  tokenRequired: {
    en: 'Access token required',
    th: 'กรุณาเข้าสู่ระบบก่อนใช้งาน',
  },
  tokenInvalid: {
    en: 'Invalid or expired token',
    th: 'เซสชันไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่',
  },
  accountGone: {
    en: 'Account no longer exists',
    th: 'บัญชีนี้ไม่มีอยู่ในระบบแล้ว',
  },
  accountSuspended: {
    en: 'Your account has been suspended.',
    th: 'บัญชีของคุณถูกระงับการใช้งาน',
  },
  accountPending: {
    en: 'Your account is pending approval.',
    th: 'บัญชีของคุณรอการอนุมัติ',
  },
  accountPendingContact: {
    en: 'Your account is pending approval. Please contact the administrator.',
    th: 'บัญชีของคุณรอการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ',
  },
  authCheckFailed: {
    en: 'Authentication check failed',
    th: 'ตรวจสอบการยืนยันตัวตนไม่สำเร็จ',
  },
  adminRequired: {
    en: 'Admin access required',
    th: 'ต้องมีสิทธิ์ผู้ดูแลระบบ',
  },
  superAdminRequired: {
    en: 'Super admin access required',
    th: 'ต้องมีสิทธิ์ผู้ดูแลระบบสูงสุด',
  },
  accessRequired: {
    en: 'Access required',
    th: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้',
  },
  tooManyLogins: {
    en: 'Too many login attempts, please try again later',
    th: 'พยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่อีกครั้งภายหลัง',
  },
  tooManyRequests: {
    en: 'Too many requests, please try again later',
    th: 'มีคำขอมากเกินไป กรุณาลองใหม่อีกครั้งภายหลัง',
  },

  // --- Login / registration / password ---
  invalidCredentials: {
    en: 'Invalid email or password',
    th: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  },
  loginFieldsRequired: {
    en: 'Email and password are required',
    th: 'กรุณากรอกอีเมลและรหัสผ่าน',
  },
  loginFailed: {
    en: 'Failed to login',
    th: 'เข้าสู่ระบบไม่สำเร็จ',
  },
  useMicrosoftSignIn: {
    en: 'Please sign in using your Microsoft account',
    th: 'กรุณาเข้าสู่ระบบด้วยบัญชี Microsoft',
  },
  registerFieldsRequired: {
    en: 'Email, password, and name are required',
    th: 'กรุณากรอกอีเมล รหัสผ่าน และชื่อ',
  },
  selfRegistrationDisabled: {
    en: 'Self-registration is disabled. Please sign in with your Microsoft account.',
    th: 'ระบบปิดการสมัครสมาชิกด้วยตนเอง กรุณาเข้าสู่ระบบด้วยบัญชี Microsoft',
  },
  emailExists: {
    en: 'User already exists with this email',
    th: 'มีผู้ใช้ที่ใช้อีเมลนี้อยู่แล้ว',
  },
  registerPending: {
    en: 'Registration successful. Your account is pending admin approval.',
    th: 'สมัครสมาชิกสำเร็จ บัญชีของคุณรอผู้ดูแลระบบอนุมัติ',
  },
  registerFailed: {
    en: 'Failed to register user',
    th: 'สมัครสมาชิกไม่สำเร็จ',
  },
  fetchMeFailed: {
    en: 'Failed to get user',
    th: 'ดึงข้อมูลผู้ใช้ไม่สำเร็จ',
  },
  passwordFieldsRequired: {
    en: 'Current password and new password are required',
    th: 'กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่',
  },
  passwordTooShort: {
    en: 'New password must be at least 6 characters long',
    th: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร',
  },
  externalAuthPassword: {
    en: 'Account uses external authentication. Password cannot be changed here.',
    th: 'บัญชีนี้ใช้การยืนยันตัวตนจากภายนอก จึงไม่สามารถเปลี่ยนรหัสผ่านที่นี่ได้',
  },
  currentPasswordWrong: {
    en: 'Current password is incorrect',
    th: 'รหัสผ่านปัจจุบันไม่ถูกต้อง',
  },
  passwordChanged: {
    en: 'Password changed successfully',
    th: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว',
  },
  changePasswordFailed: {
    en: 'Failed to change password',
    th: 'เปลี่ยนรหัสผ่านไม่สำเร็จ',
  },

  // --- Microsoft SSO ---
  ssoConfigMissing: {
    en: 'Server SSO configuration is missing',
    th: 'การตั้งค่า SSO ของเซิร์ฟเวอร์ไม่ครบถ้วน',
  },
  ssoConfigMissingDetail: {
    en: 'Server SSO configuration is missing (Tenant ID, Client ID, or Redirect URI)',
    th: 'การตั้งค่า SSO ของเซิร์ฟเวอร์ไม่ครบถ้วน (Tenant ID, Client ID หรือ Redirect URI)',
  },
  authCodeRequired: {
    en: 'Authorization code is required',
    th: 'จำเป็นต้องมีรหัสยืนยันสิทธิ์',
  },
  msAuthFailed: {
    en: 'Failed to authenticate with Microsoft',
    th: 'ยืนยันตัวตนกับ Microsoft ไม่สำเร็จ',
  },
  msProfileFailed: {
    en: 'Failed to fetch user profile from Microsoft',
    th: 'ดึงข้อมูลโปรไฟล์จาก Microsoft ไม่สำเร็จ',
  },
  msEmailMissing: {
    en: 'Could not retrieve email from Microsoft account',
    th: 'ไม่สามารถอ่านอีเมลจากบัญชี Microsoft ได้',
  },
  ssoServerError: {
    en: 'Internal server error during SSO login',
    th: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์ระหว่างเข้าสู่ระบบด้วย SSO',
  },

  // --- Users ---
  userNotFound: {
    en: 'User not found',
    th: 'ไม่พบผู้ใช้',
  },
  fetchUsersFailed: {
    en: 'Failed to fetch users',
    th: 'ดึงข้อมูลผู้ใช้ไม่สำเร็จ',
  },
  fetchUserFailed: {
    en: 'Failed to fetch user',
    th: 'ดึงข้อมูลผู้ใช้ไม่สำเร็จ',
  },
  userFieldsRequired: {
    en: 'Name, email, and password are required',
    th: 'กรุณากรอกชื่อ อีเมล และรหัสผ่าน',
  },
  userEmailExists: {
    en: 'User with this email already exists',
    th: 'มีผู้ใช้ที่ใช้อีเมลนี้อยู่แล้ว',
  },
  userExists: {
    en: 'User already exists',
    th: 'มีผู้ใช้นี้อยู่แล้ว',
  },
  emailInUse: {
    en: 'Email already in use',
    th: 'อีเมลนี้ถูกใช้งานแล้ว',
  },
  createUserFailed: {
    en: 'Failed to create user',
    th: 'สร้างผู้ใช้ไม่สำเร็จ',
  },
  updateUserFailed: {
    en: 'Failed to update user',
    th: 'แก้ไขข้อมูลผู้ใช้ไม่สำเร็จ',
  },
  deleteUserFailed: {
    en: 'Failed to delete user',
    th: 'ลบผู้ใช้ไม่สำเร็จ',
  },
  userDeleted: {
    en: 'User deleted successfully',
    th: 'ลบผู้ใช้เรียบร้อยแล้ว',
  },
  cannotDeleteSelf: {
    en: 'Cannot delete your own account',
    th: 'ไม่สามารถลบบัญชีของตนเองได้',
  },
  superAdminCreateAdmin: {
    en: 'Only a super admin can create admin accounts',
    th: 'เฉพาะผู้ดูแลระบบสูงสุดเท่านั้นที่สร้างบัญชีผู้ดูแลระบบได้',
  },
  superAdminManageAdmin: {
    en: 'Only a super admin can manage admin accounts',
    th: 'เฉพาะผู้ดูแลระบบสูงสุดเท่านั้นที่จัดการบัญชีผู้ดูแลระบบได้',
  },
  superAdminDeleteAdmin: {
    en: 'Only a super admin can delete admin accounts',
    th: 'เฉพาะผู้ดูแลระบบสูงสุดเท่านั้นที่ลบบัญชีผู้ดูแลระบบได้',
  },
  updateRoleFailed: {
    en: 'Failed to update user role',
    th: 'แก้ไขบทบาทผู้ใช้ไม่สำเร็จ',
  },
  invalidUsersData: {
    en: 'Invalid users data. Expected an array of users.',
    th: 'ข้อมูลผู้ใช้ไม่ถูกต้อง ต้องเป็นรายการผู้ใช้',
  },
  importUsersFailed: {
    en: 'Failed to import users',
    th: 'นำเข้าผู้ใช้ไม่สำเร็จ',
  },
  unsupportedLanguage: {
    en: 'Unsupported language',
    th: 'ไม่รองรับภาษาที่เลือก',
  },
  saveLanguageFailed: {
    en: 'Failed to save language preference',
    th: 'บันทึกการตั้งค่าภาษาไม่สำเร็จ',
  },
  createAdminFailed: {
    en: 'Failed to create admin user',
    th: 'สร้างบัญชีผู้ดูแลระบบไม่สำเร็จ',
  },

  // --- Rooms ---
  fetchRoomsFailed: {
    en: 'Failed to fetch rooms',
    th: 'ดึงข้อมูลห้องไม่สำเร็จ',
  },
  fetchRoomFailed: {
    en: 'Failed to fetch room',
    th: 'ดึงข้อมูลห้องไม่สำเร็จ',
  },
  roomFieldsRequired: {
    en: 'Name, description, minimum capacity, and maximum capacity are required',
    th: 'กรุณากรอกชื่อ คำอธิบาย ความจุขั้นต่ำ และความจุสูงสุด',
  },
  minCapacityMin: {
    en: 'Minimum capacity must be at least 1',
    th: 'ความจุขั้นต่ำต้องไม่น้อยกว่า 1',
  },
  maxCapacityMin: {
    en: 'Maximum capacity must be at least 1',
    th: 'ความจุสูงสุดต้องไม่น้อยกว่า 1',
  },
  minGreaterThanMax: {
    en: 'Minimum capacity cannot be greater than maximum capacity',
    th: 'ความจุขั้นต่ำต้องไม่มากกว่าความจุสูงสุด',
  },
  createRoomFailed: {
    en: 'Failed to create room',
    th: 'สร้างห้องไม่สำเร็จ',
  },
  updateRoomFailed: {
    en: 'Failed to update room',
    th: 'แก้ไขห้องไม่สำเร็จ',
  },
  deleteRoomFailed: {
    en: 'Failed to delete room',
    th: 'ลบห้องไม่สำเร็จ',
  },
  roomDeleted: {
    en: 'Room deleted successfully',
    th: 'ลบห้องเรียบร้อยแล้ว',
  },
  roomHasBookings: {
    en: 'Cannot delete room with active bookings',
    th: 'ไม่สามารถลบห้องที่ยังมีการจองอยู่',
  },
  roomHasActiveBookingsCount: {
    en: 'Cannot delete this room: it has {count} active booking(s). Cancel them first.',
    th: 'ไม่สามารถลบห้องนี้ได้ เนื่องจากยังมีการจองที่ใช้งานอยู่ {count} รายการ กรุณายกเลิกก่อน',
  },
  importCompleted: {
    en: 'Import completed: {success} successful, {failed} failed',
    th: 'นำเข้าเสร็จสิ้น: สำเร็จ {success} รายการ ไม่สำเร็จ {failed} รายการ',
  },
  createOwnRooms: {
    en: 'You can only create rooms in your own department',
    th: 'คุณสร้างห้องได้เฉพาะในแผนกของคุณเท่านั้น',
  },
  manageOwnRooms: {
    en: 'You can only manage rooms in your own department',
    th: 'คุณจัดการได้เฉพาะห้องในแผนกของคุณเท่านั้น',
  },
  assignOwnDepartment: {
    en: 'You can only assign rooms to your own department',
    th: 'คุณกำหนดห้องให้ได้เฉพาะแผนกของคุณเท่านั้น',
  },
  invalidOperatingHours: {
    en: 'Invalid operating hours format',
    th: 'รูปแบบเวลาทำการไม่ถูกต้อง',
  },

  // --- Departments ---
  departmentNotFound: {
    en: 'Department not found',
    th: 'ไม่พบแผนก',
  },
  departmentNameRequired: {
    en: 'Department name is required',
    th: 'กรุณาระบุชื่อแผนก',
  },
  fetchDepartmentsFailed: {
    en: 'Failed to fetch departments',
    th: 'ดึงข้อมูลแผนกไม่สำเร็จ',
  },
  createDepartmentFailed: {
    en: 'Failed to create department',
    th: 'สร้างแผนกไม่สำเร็จ',
  },
  updateDepartmentFailed: {
    en: 'Failed to update department',
    th: 'แก้ไขแผนกไม่สำเร็จ',
  },
  deleteDepartmentFailed: {
    en: 'Failed to delete department',
    th: 'ลบแผนกไม่สำเร็จ',
  },
  departmentDeleted: {
    en: 'Department deleted successfully. Its rooms are now unassigned.',
    th: 'ลบแผนกเรียบร้อยแล้ว ห้องที่เคยอยู่ในแผนกนี้ถูกย้ายออกแล้ว',
  },
  fetchManagersFailed: {
    en: 'Failed to fetch department managers',
    th: 'ดึงข้อมูลผู้ดูแลแผนกไม่สำเร็จ',
  },
  manageOwnDepartment: {
    en: 'You can only manage your own department',
    th: 'คุณจัดการได้เฉพาะแผนกของคุณเท่านั้น',
  },
  someUsersMissing: {
    en: 'One or more selected users do not exist',
    th: 'มีผู้ใช้ที่เลือกบางรายไม่มีอยู่ในระบบ',
  },

  // --- Closures (schedule exceptions) ---
  closureNotFound: {
    en: 'Closure not found',
    th: 'ไม่พบรายการวันหยุด',
  },
  fetchClosuresFailed: {
    en: 'Failed to fetch closures',
    th: 'ดึงข้อมูลวันหยุดไม่สำเร็จ',
  },
  createClosureFailed: {
    en: 'Failed to create closure',
    th: 'สร้างวันหยุดไม่สำเร็จ',
  },
  updateClosureFailed: {
    en: 'Failed to update closure',
    th: 'แก้ไขวันหยุดไม่สำเร็จ',
  },
  deleteClosureFailed: {
    en: 'Failed to delete closure',
    th: 'ลบวันหยุดไม่สำเร็จ',
  },
  closureDeleted: {
    en: 'Closure deleted',
    th: 'ลบวันหยุดเรียบร้อยแล้ว',
  },
  createOwnClosures: {
    en: 'You can only create closures for your own department',
    th: 'คุณสร้างวันหยุดได้เฉพาะสำหรับแผนกของคุณเท่านั้น',
  },
  manageOwnClosures: {
    en: 'You can only manage closures for your own department',
    th: 'คุณจัดการได้เฉพาะวันหยุดของแผนกคุณเท่านั้น',
  },

  // --- Semesters ---
  fetchActiveSemesterFailed: {
    en: 'Failed to fetch active semester',
    th: 'ดึงข้อมูลภาคการศึกษาปัจจุบันไม่สำเร็จ',
  },
  fetchSemestersFailed: {
    en: 'Failed to fetch semesters',
    th: 'ดึงข้อมูลภาคการศึกษาไม่สำเร็จ',
  },
  createSemesterFailed: {
    en: 'Failed to create semester',
    th: 'สร้างภาคการศึกษาไม่สำเร็จ',
  },
  updateSemesterFailed: {
    en: 'Failed to update semester',
    th: 'แก้ไขภาคการศึกษาไม่สำเร็จ',
  },
  deleteSemesterFailed: {
    en: 'Failed to delete semester',
    th: 'ลบภาคการศึกษาไม่สำเร็จ',
  },
  semesterDeleted: {
    en: 'Semester deleted successfully',
    th: 'ลบภาคการศึกษาเรียบร้อยแล้ว',
  },

  // --- Admin / settings ---
  fetchStatsFailed: {
    en: 'Failed to fetch statistics',
    th: 'ดึงข้อมูลสถิติไม่สำเร็จ',
  },
  fetchAuditFailed: {
    en: 'Failed to fetch the audit log',
    th: 'ดึงข้อมูลบันทึกการตรวจสอบไม่สำเร็จ',
  },
  fetchSettingsFailed: {
    en: 'Error fetching settings',
    th: 'ดึงข้อมูลการตั้งค่าไม่สำเร็จ',
  },
  updateSettingsFailed: {
    en: 'Error updating settings',
    th: 'บันทึกการตั้งค่าไม่สำเร็จ',
  },

  // --- Field validation (express-validator; see middleware/validation.ts) ---
  invalidEmail: {
    en: 'Invalid email address',
    th: 'อีเมลไม่ถูกต้อง',
  },
  passwordMin6: {
    en: 'Password must be at least 6 characters',
    th: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
  },
  nameRequired: {
    en: 'Name is required',
    th: 'กรุณาระบุชื่อ',
  },
  passwordRequired: {
    en: 'Password is required',
    th: 'กรุณากรอกรหัสผ่าน',
  },
  roomIdRequired: {
    en: 'Room ID is required',
    th: 'กรุณาระบุห้อง',
  },
  invalidStartTime: {
    en: 'Invalid start time',
    th: 'เวลาเริ่มต้นไม่ถูกต้อง',
  },
  invalidEndTime: {
    en: 'Invalid end time',
    th: 'เวลาสิ้นสุดไม่ถูกต้อง',
  },
  purposeRequired: {
    en: 'Purpose is required',
    th: 'กรุณาระบุวัตถุประสงค์การใช้ห้อง',
  },
  attendeeRequired: {
    en: 'At least one attendee is required',
    th: 'ต้องมีผู้เข้าใช้อย่างน้อย 1 คน',
  },
  invalidRole: {
    en: 'Invalid role',
    th: 'บทบาทไม่ถูกต้อง',
  },
  roomNameRequired: {
    en: 'Room name is required',
    th: 'กรุณาระบุชื่อห้อง',
  },
  roomNameNotEmpty: {
    en: 'Room name cannot be empty',
    th: 'ชื่อห้องต้องไม่เว้นว่าง',
  },
  descriptionRequired: {
    en: 'Description is required',
    th: 'กรุณาระบุคำอธิบาย',
  },
  descriptionNotEmpty: {
    en: 'Description cannot be empty',
    th: 'คำอธิบายต้องไม่เว้นว่าง',
  },
  featuresArray: {
    en: 'Features must be an array',
    th: 'ข้อมูลสิ่งอำนวยความสะดวกต้องอยู่ในรูปแบบรายการ',
  },
} as const;

export type MessageKey = keyof typeof MESSAGES;

// Lets callers that carry a message key in a string field (e.g. express-validator's
// `withMessage`) translate it safely and fall back to the raw text if it isn't one.
export const isMessageKey = (value: unknown): value is MessageKey =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(MESSAGES, value);

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

// Convenience wrapper for route handlers: resolves the language straight from
// the request, so handlers don't each need to hold on to a `lang` variable.
export const trReq = (
  req: Request,
  key: MessageKey,
  params?: Record<string, string | number>
): string => tr(getLang(req), key, params);
