import React from 'react';
import AdminDashboard from '../components/AdminDashboard';
import { User, Room, Booking } from '../types';

interface AdminPageProps {
  user: User;
  rooms: Room[];
  bookings: Booking[];
  onExportCSV: () => void;
  onCancelBooking: (id: string) => void;
  onRefresh: () => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ user, rooms, bookings, onExportCSV, onCancelBooking, onRefresh }) => {
  return (
    <AdminDashboard
      bookings={bookings}
      rooms={rooms}
      onExportCSV={onExportCSV}
      onCancelBooking={onCancelBooking}
      onRefresh={onRefresh}
    />
  );
};

export default AdminPage;
