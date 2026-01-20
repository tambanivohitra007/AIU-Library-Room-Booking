import { User, Room, Booking, Semester } from '../types';

// Use environment variable or fallback to relative path (for dev proxy)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
    cache: 'no-store',
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

  register: async (name: string, email: string, password: string): Promise<{ message: string; user: User }> => {
    return fetchAPI<{ message: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  // Microsoft SSO
  getMicrosoftLoginUrl: async (): Promise<string> => {
    const { url } = await fetchAPI<{ url: string }>('/auth/microsoft/url');
    return url;
  },

  loginWithMicrosoft: async (code: string): Promise<{ token: string; user: User }> => {
    const result = await fetchAPI<{ token: string; user: User }>('/auth/microsoft/login', {
      method: 'POST',
      body: JSON.stringify({ code }),
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

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    return fetchAPI<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
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

  updateUser: async (id: string, userData: { name?: string; email?: string; role?: string; password?: string, status?: string }): Promise<User> => {
    return fetchAPI<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  deleteUser: async (id: string): Promise<{ message: string }> => {
    return fetchAPI(`/users/${id}`, {
      method: 'DELETE',
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

  createRoom: async (roomData: { name: string; description: string; minCapacity: number; maxCapacity: number; features: string[] }): Promise<Room> => {
    return fetchAPI<Room>('/rooms', {
      method: 'POST',
      body: JSON.stringify(roomData),
    });
  },

  updateRoom: async (id: string, roomData: { name: string; description: string; minCapacity: number; maxCapacity: number; features: string[] }): Promise<Room> => {
    return fetchAPI<Room>(`/rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(roomData),
    });
  },

  deleteRoom: async (id: string): Promise<{ message: string }> => {
    return fetchAPI(`/rooms/${id}`, {
      method: 'DELETE',
    });
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

  cancelBooking: async (id: string, reason?: string): Promise<boolean> => {
    try {
      await fetchAPI(`/bookings/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason }),
      });
      return true;
    } catch {
      return false;
    }
  },

  remindBooking: async (id: string): Promise<void> => {
    return fetchAPI('/bookings/' + id + '/remind', {
       method: 'POST'
    });
  },

  // Semesters
  getSemesters: async (): Promise<Semester[]> => {
    return fetchAPI<Semester[]>('/semesters');
  },

  getActiveSemester: async (): Promise<Semester | null> => {
    try {
      return await fetchAPI<Semester>('/semesters/active');
    } catch {
      return null;
    }
  },

  createSemester: async (data: { name: string; startDate: string; endDate: string; isActive?: boolean }): Promise<Semester> => {
    return fetchAPI<Semester>('/semesters', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateSemester: async (id: string, data: { name?: string; startDate?: string; endDate?: string; isActive?: boolean }): Promise<Semester> => {
    return fetchAPI<Semester>(`/semesters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteSemester: async (id: string): Promise<void> => {
    return fetchAPI(`/semesters/${id}`, {
      method: 'DELETE',
    });
  },
};
