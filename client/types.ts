export enum UserRole {
  STUDENT = 'STUDENT',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  provider?: 'LOCAL' | 'MICROSOFT';
  avatarUrl?: string;
}

export interface Room {
  id: string;
  name: string;
  minCapacity: number;
  maxCapacity: number;
  description: string;
  features: string[];
}

export enum BookingStatus {
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED'
}

export interface Attendee {
  name: string;
  studentId?: string; // Optional ID
  isCompanion: boolean; // true if not the booker
}

export interface Booking {
  id: string;
  roomId: string;
  userId: string;
  userDisplay?: string; // Joined for display
  startTime: string; // ISO String
  endTime: string; // ISO String
  purpose: string;
  attendees: Attendee[];
  status: BookingStatus;
  cancellationReason?: string;
  createdAt: string;
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
