import { Booking, BookingStatus, Room, User, UserRole, Attendee } from '../types';
import { OPENING_HOUR, CLOSING_HOUR, MAX_DURATION_MINUTES } from '../constants';

// --- SEED DATA ---
const SEED_ROOMS: Room[] = [
  { id: 'room-a', name: 'Room A (Quiet Study)', capacity: 6, description: 'Glass-walled room near reference section.', features: ['Whiteboard', 'Power Outlets'] },
  { id: 'room-b', name: 'Room B (Group Project)', capacity: 10, description: 'Larger room with projector.', features: ['Projector', 'Large Table', 'Whiteboard'] },
];

const SEED_USERS: User[] = [
  { id: 'u1', name: 'Alice Student', email: 'alice@uni.edu', role: UserRole.STUDENT },
  { id: 'u2', name: 'Bob Admin', email: 'bob@uni.edu', role: UserRole.ADMIN },
];

const SEED_BOOKINGS: Booking[] = []; // Start empty or add samples if needed

// --- LOCAL STORAGE HELPERS ---
const getStorage = <T>(key: string, defaultVal: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch {
    return defaultVal;
  }
};

const setStorage = <T>(key: string, val: T) => {
  localStorage.setItem(key, JSON.stringify(val));
};

// --- SERVICE CLASS ---
class MockService {
  private users: User[];
  private rooms: Room[];
  private bookings: Booking[];
  private currentUser: User | null = null;

  constructor() {
    this.users = getStorage('lib_users', SEED_USERS);
    this.rooms = getStorage('lib_rooms', SEED_ROOMS);
    this.bookings = getStorage('lib_bookings', SEED_BOOKINGS);
    
    // Auto-login as student for demo
    this.currentUser = this.users[0]; 
  }

  // Auth
  login(userId: string) {
    const user = this.users.find(u => u.id === userId);
    if (user) this.currentUser = user;
    return user;
  }

  getCurrentUser() { return this.currentUser; }
  
  getUsers() { return this.users; }

  // Rooms
  getRooms() { return this.rooms; }

  // Bookings
  getBookings(filter?: { roomId?: string; userId?: string; start?: string; end?: string }) {
    let res = this.bookings.filter(b => b.status !== BookingStatus.CANCELLED);

    if (filter?.roomId) res = res.filter(b => b.roomId === filter.roomId);
    if (filter?.userId) res = res.filter(b => b.userId === filter.userId);
    // Simple date filtering (overlap check for range) can be added here
    
    return res.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  getAllBookingsForAdmin() {
    return this.bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Core Booking Logic
  createBooking(payload: Omit<Booking, 'id' | 'status' | 'createdAt' | 'userDisplay'>): { success: boolean; error?: string; booking?: Booking } {
    if (!this.currentUser) return { success: false, error: "Unauthorized" };

    const start = new Date(payload.startTime);
    const end = new Date(payload.endTime);
    const now = new Date();

    // 1. Lead time check
    if (start.getTime() < now.getTime() + 30 * 60000) {
      return { success: false, error: "Bookings must be made at least 30 minutes in advance." };
    }

    // 2. Duration check
    const durationMinutes = (end.getTime() - start.getTime()) / 60000;
    if (durationMinutes > MAX_DURATION_MINUTES) return { success: false, error: `Maximum booking duration is ${MAX_DURATION_MINUTES / 60} hours.` };
    if (durationMinutes < 15) return { success: false, error: "Minimum booking duration is 15 minutes." };

    // 3. Opening Hours
    const startHour = start.getHours();
    const endHour = end.getHours() + (end.getMinutes() / 60);
    if (startHour < OPENING_HOUR || endHour > CLOSING_HOUR) {
        return { success: false, error: `Library hours are ${OPENING_HOUR}:00 to ${CLOSING_HOUR}:00.` };
    }

    // 4. Overlap Check
    const hasOverlap = this.bookings.some(b => {
      if (b.status === BookingStatus.CANCELLED) return false;
      if (b.roomId !== payload.roomId) return false;
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      // Overlap formula: (StartA < EndB) && (EndA > StartB)
      return start < bEnd && end > bStart;
    });

    if (hasOverlap) {
      return { success: false, error: "Selected time slot overlaps with an existing booking." };
    }

    const newBooking: Booking = {
      ...payload,
      id: `bk_${Date.now()}`,
      userId: this.currentUser.id,
      userDisplay: this.currentUser.name,
      status: BookingStatus.CONFIRMED,
      createdAt: new Date().toISOString()
    };

    this.bookings.push(newBooking);
    this.persist();
    return { success: true, booking: newBooking };
  }

  cancelBooking(bookingId: string) {
    const idx = this.bookings.findIndex(b => b.id === bookingId);
    if (idx === -1) return false;
    
    // Check permission
    const booking = this.bookings[idx];
    if (this.currentUser?.role !== UserRole.ADMIN && booking.userId !== this.currentUser?.id) {
        return false;
    }

    this.bookings[idx].status = BookingStatus.CANCELLED;
    this.persist();
    return true;
  }

  private persist() {
    setStorage('lib_bookings', this.bookings);
  }
}

export const api = new MockService();