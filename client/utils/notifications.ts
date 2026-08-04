import { Booking, Room, User, isGlobalAdminRole, UserRole } from '../types';

// Notifications are DERIVED from live data rather than stored as their own
// records. A pending booking is the notification: approve it and the entry
// disappears, let it expire and it disappears too. Nothing to write, nothing to
// mark resolved, and the badge can never disagree with the Bookings tab.
export interface AppNotification {
  id: string;
  bookingId: string;
  roomName: string;
  requestedBy: string;
  startTime: string;
  createdAt: string;
  // Starts within the hour: the scheduler auto-cancels it the moment the start
  // time passes, so this one cannot wait for the next login.
  urgent: boolean;
}

// Mirrors canModerateBooking in server/src/routes/bookings.ts. The server is
// still the authority - this only decides what to show.
export const canModerateRoom = (user: User, room: Room | undefined): boolean => {
  if (isGlobalAdminRole(user.role) || user.role === UserRole.STUDENT_WORKER) {
    return true;
  }
  if (!room?.departmentId) return false;
  return (user.managedDepartmentIds || []).includes(room.departmentId);
};

export const canModerateAnything = (user: User, rooms: Room[]): boolean =>
  isGlobalAdminRole(user.role) ||
  user.role === UserRole.STUDENT_WORKER ||
  rooms.some((r) => canModerateRoom(user, r));

const URGENT_WINDOW_MS = 60 * 60 * 1000;

export const buildNotifications = (
  user: User,
  rooms: Room[],
  bookings: Booking[],
): AppNotification[] => {
  const now = Date.now();
  return bookings
    .filter((b) => b.status === 'PENDING')
    .filter((b) => canModerateRoom(user, rooms.find((r) => r.id === b.roomId)))
    .map((b) => ({
      id: `approval-${b.id}`,
      bookingId: b.id,
      roomName: rooms.find((r) => r.id === b.roomId)?.name || '',
      requestedBy: b.userDisplay || b.userEmail || '',
      startTime: b.startTime,
      createdAt: b.createdAt,
      urgent: new Date(b.startTime).getTime() - now < URGENT_WINDOW_MS,
    }))
    // Soonest start first: that is the one closest to being auto-cancelled
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
};

// "Seen" is a single timestamp rather than a set of ids, so it cannot grow
// without bound and needs no cleanup when bookings are resolved or deleted.
// Per-device by design, matching how the UI language is stored.
const SEEN_KEY = 'notifications:lastSeenAt';

export const getLastSeenAt = (): number => {
  const raw = localStorage.getItem(SEEN_KEY);
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const markSeen = (): void => {
  localStorage.setItem(SEEN_KEY, new Date().toISOString());
};

export const countNew = (
  notifications: AppNotification[],
  lastSeenAt: number,
): number =>
  notifications.filter((n) => Date.parse(n.createdAt) > lastSeenAt).length;
