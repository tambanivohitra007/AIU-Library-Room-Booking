export enum UserRole {
  STUDENT = 'STUDENT',
  STUDENT_WORKER = 'STUDENT_WORKER',
  ADMIN = 'ADMIN',
  SUPERADMIN = 'SUPERADMIN'
}

export const isGlobalAdminRole = (role?: UserRole): boolean =>
  role === UserRole.ADMIN || role === UserRole.SUPERADMIN;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  provider?: 'LOCAL' | 'MICROSOFT';
  language?: 'en' | 'th'; // notification email preference (UI language is per-device)
  avatarUrl?: string;
  createdAt?: string;
  managedDepartmentIds?: string[]; // departments this user administers (any role); sent for the signed-in user
  managedDepartments?: { id: string; name: string }[]; // same grant, named, as listed by GET /users for admin screens
}

// Date-specific schedule override: a closure (holiday, maintenance) or
// special hours; departmentId null = applies service-wide
export interface ScheduleException {
  id: string;
  name: string;
  startDate: string;
  endDate: string; // inclusive
  closed: boolean;
  openHour?: number | null;
  closeHour?: number | null;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
}

export interface Department {
  id: string;
  name: string;
  contactEmail?: string | null;
  operatingHours?: string | null; // JSON-encoded OperatingHours; null = inherit global schedule
  roomCount?: number;
}

export interface Room {
  id: string;
  name: string;
  minCapacity: number;
  maxCapacity: number;
  description: string;
  features: string[];
  bookingTerms?: string | null; // terms & conditions; null = no acceptance required
  requiresApproval?: boolean; // bookings start as PENDING until approved
  operatingHours?: string | null; // JSON-encoded OperatingHours; null = inherit the department (or global) schedule
  departmentId?: string | null;
  department?: Department | null;
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED'
}

export interface Attendee {
  name: string;
  studentId?: string; // Optional ID
  isCompanion: boolean; // true if not the booker
}

export interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Booking {
  id: string;
  roomId: string;
  userId: string;
  userDisplay?: string; // Joined for display
  userEmail?: string; // Joined for display
  startTime: string; // ISO String
  endTime: string; // ISO String
  purpose: string;
  attendees: Attendee[];
  status: BookingStatus;
  cancellationReason?: string;
  termsAcceptedAt?: string | null;
  createdAt: string;
}

// One entry per weekday (0 = Sunday .. 6 = Saturday); null = closed all day
export type DayHours = { open: number; close: number } | null;
export type OperatingHours = DayHours[];

export interface ServiceSettings {
  id: string;
  serviceName: string;
  logoUrl?: string; // Optional URL
  contactEmail?: string;
  websiteUrl?: string;
  description?: string;
  allowedEmailDomains?: string; // comma-separated; empty = any domain
  operatingHours?: string; // JSON-encoded OperatingHours
  allowSelfRegistration?: boolean; // false = accounts only via SSO, admin creation, or import
  updatedAt?: string;
}

/*
  --- DATABASE SCHEMA DDL (Hypothetical for PostgreSQL) ---
  
  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'STUDENT',
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    capacity INT NOT NULL,
    features TEXT[]
  );

  CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id),
    user_id UUID REFERENCES users(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    purpose TEXT,
    status VARCHAR(50) DEFAULT 'CONFIRMED',
    created_at TIMESTAMP DEFAULT NOW(),
    CHECK (end_time > start_time)
  );

  CREATE TABLE booking_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL,
    student_id VARCHAR(50),
    is_companion BOOLEAN DEFAULT TRUE
  );
*/
