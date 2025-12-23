import { User, Room, Booking } from '../types';

const API_BASE_URL = '/api';

// Get JWT token from localStorage
const getToken = (): string | null => {
  return localStorage.getItem('token');
};

// Set JWT token to localStorage
const setToken = (token: string) => {
  localStorage.setItem('token', token);
};

// Remove JWT token from localStorage
const removeToken = () => {
  localStorage.removeItem('token');
};

// Helper function for API calls
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  login: async (email: string, password: string): Promise<{ token: string; user: User }> => {
    const result = await fetchAPI<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(result.token);
    return result;
  },

  register: async (name: string, email: string, password: string): Promise<{ token: string; user: User }> => {
    const result = await fetchAPI<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setToken(result.token);
    return result;
  },

  logout: () => {
    removeToken();
  },

  getCurrentUser: async (): Promise<User | null> => {
    const token = getToken();
    if (!token) return null;

    try {
      return await fetchAPI<User>('/auth/me');
    } catch {
      removeToken();
      return null;
    }
  },

  isAuthenticated: (): boolean => {
    return getToken() !== null;
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    return fetchAPI<User[]>('/users');
  },

  createUser: async (userData: { name: string; email: string; password: string; role: string }): Promise<User> => {
    return fetchAPI<User>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  importUsers: async (users: Array<{ name: string; email: string; role?: string }>): Promise<{
    message: string;
    defaultPassword: string;
    results: {
      success: Array<{ id: string; email: string; name: string }>;
      failed: Array<{ email: string; reason: string }>;
    };
  }> => {
    return fetchAPI('/users/import', {
      method: 'POST',
      body: JSON.stringify({ users }),
    });
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

  checkConflicts: async (data: {
    roomId: string;
    startTime: Date;
    endTime: Date;
  }): Promise<{
    hasConflict: boolean;
    conflicts: Array<{
      id: string;
      startTime: string;
      endTime: string;
      userDisplay: string;
    }>;
  }> => {
    return fetchAPI('/bookings/check-conflicts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createBooking: async (data: {
    roomId: string;
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
