import { User, Room, Booking } from '../types';

const API_BASE_URL = '/api';

// Helper function for API calls
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Session management (using localStorage for current user)
let currentUserId: string | null = localStorage.getItem('currentUserId') || 'u1'; // Default to Alice

export const api = {
  // Auth
  getCurrentUser: async (): Promise<User | null> => {
    if (!currentUserId) return null;
    try {
      return await fetchAPI<User>(`/users/${currentUserId}`);
    } catch {
      return null;
    }
  },

  login: (userId: string) => {
    currentUserId = userId;
    localStorage.setItem('currentUserId', userId);
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    return fetchAPI<User[]>('/users');
  },

  // Rooms
  getRooms: async (): Promise<Room[]> => {
    return fetchAPI<Room[]>('/rooms');
  },

  getRoom: async (id: string): Promise<Room> => {
    return fetchAPI<Room>(`/rooms/${id}`);
  },

  // Bookings
  getBookings: async (): Promise<Booking[]> => {
    return fetchAPI<Booking[]>('/bookings');
  },

  getBooking: async (id: string): Promise<Booking> => {
    return fetchAPI<Booking>(`/bookings/${id}`);
  },

  getAllBookingsForAdmin: async (): Promise<Booking[]> => {
    return fetchAPI<Booking[]>('/bookings');
  },

  createBooking: async (data: {
    roomId: string;
    userId: string;
    startTime: Date;
    endTime: Date;
    purpose: string;
    attendees: Array<{ name: string; studentId?: string; isCompanion: boolean }>;
  }): Promise<Booking> => {
    return fetchAPI<Booking>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  cancelBooking: async (id: string): Promise<boolean> => {
    try {
      await fetchAPI(`/bookings/${id}`, {
        method: 'DELETE',
      });
      return true;
    } catch {
      return false;
    }
  },
};
