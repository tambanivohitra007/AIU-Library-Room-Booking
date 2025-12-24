import React, { useState, useEffect } from 'react';
import { User, Room, Booking, UserRole } from '../types';
import { api } from '../services/api';
import { BarChartIcon, CalendarIcon, UsersIcon, BuildingIcon } from './Icons';
import UserImportModal from './UserImportModal';
import AddUserModal from './AddUserModal';
import EditUserModal from './EditUserModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import AddRoomModal from './AddRoomModal';
import EditRoomModal from './EditRoomModal';
import AttendeesModal from './AttendeesModal';
import { useToast } from '../contexts/ToastContext';

interface AdminDashboardProps {
  bookings: Booking[];
  rooms: Room[];
  onExportCSV: () => void;
  onCancelBooking: (id: string) => void;
  onRefresh: () => void;
}

interface Stats {
  totalBookings: number;
  activeBookings: number;
  totalUsers: number;
  roomUtilization: { [key: string]: number };
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ bookings, rooms, onExportCSV, onCancelBooking, onRefresh }) => {
  const toast = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'bookings' | 'users' | 'rooms'>('overview');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRoom, setFilterRoom] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Room management state
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);

  // Attendees modal state
  const [viewingAttendeesBooking, setViewingAttendeesBooking] = useState<Booking | null>(null);

  useEffect(() => {
    loadStats();
    loadUsers();
  }, [bookings]);

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    setIsDeleting(true);
    try {
      await api.deleteUser(deletingUser.id);
      setDeletingUser(null);
      loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!deletingRoom) return;

    setIsDeleting(true);
    try {
      await api.deleteRoom(deletingRoom.id);
      toast.success('Room deleted successfully');
      setDeletingRoom(null);
      onRefresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete room';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const loadStats = () => {
    const now = new Date();
    const activeBookings = bookings.filter(b =>
      b.status === 'CONFIRMED' &&
      new Date(b.endTime) > now &&
      new Date(b.startTime) <= now
    );

    const roomUtilization: { [key: string]: number } = {};
    rooms.forEach(room => {
      const roomBookings = bookings.filter(b => b.roomId === room.id && b.status === 'CONFIRMED');
      roomUtilization[room.id] = roomBookings.length;
    });

    setStats({
      totalBookings: bookings.length,
      activeBookings: activeBookings.length,
      totalUsers: 0, // Will be updated when users load
      roomUtilization,
    });
  };

  const loadUsers = async () => {
    try {
      const allUsers = await api.getUsers();
      setUsers(allUsers);
      setStats(prev => prev ? { ...prev, totalUsers: allUsers.length } : null);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const filteredBookings = bookings.filter(b => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (filterRoom !== 'all' && b.roomId !== filterRoom) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        b.userDisplay?.toLowerCase().includes(query) ||
        b.purpose.toLowerCase().includes(query) ||
        rooms.find(r => r.id === b.roomId)?.name.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const renderOverview = () => (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass rounded-lg border border-white/20 p-5 sm:p-6 shadow-medium hover:shadow-strong transition-all-smooth hover-lift animate-slide-up">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs sm:text-sm font-semibold text-slate-500">Total Bookings</p>
              <p className="text-2xl sm:text-3xl font-bold gradient-text mt-2">{stats?.totalBookings || 0}</p>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary/20 rounded-md flex items-center justify-center shadow-soft">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="glass rounded-lg border border-white/20 p-5 sm:p-6 shadow-medium hover:shadow-strong transition-all-smooth hover-lift animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs sm:text-sm font-semibold text-slate-500">Active Now</p>
              <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-2 flex items-center gap-2">
                {stats?.activeBookings || 0}
                {(stats?.activeBookings || 0) > 0 && (
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                )}
              </p>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-green-100 rounded-md flex items-center justify-center shadow-soft">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="glass rounded-lg border border-white/20 p-5 sm:p-6 shadow-medium hover:shadow-strong transition-all-smooth hover-lift animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs sm:text-sm font-semibold text-slate-500">Total Users</p>
              <p className="text-2xl sm:text-3xl font-bold gradient-text mt-2">{stats?.totalUsers || 0}</p>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-100 rounded-md flex items-center justify-center shadow-soft">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="glass rounded-lg border border-white/20 p-5 sm:p-6 shadow-medium hover:shadow-strong transition-all-smooth hover-lift animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs sm:text-sm font-semibold text-slate-500">Total Rooms</p>
              <p className="text-2xl sm:text-3xl font-bold gradient-text mt-2">{rooms.length}</p>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-purple-100 rounded-md flex items-center justify-center shadow-soft">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Room Utilization */}
      <div className="glass rounded-lg border border-white/20 p-5 sm:p-6 shadow-medium animate-slide-up">
        <h3 className="text-base sm:text-lg font-bold gradient-text mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Room Utilization
        </h3>
        <div className="space-y-3 sm:space-y-4">
          {rooms.map(room => {
            const utilization = stats?.roomUtilization[room.id] || 0;
            const percentage = Math.min((utilization / 20) * 100, 100); // Assuming 20 is max
            return (
              <div key={room.id}>
                <div className="flex justify-between text-xs sm:text-sm mb-2">
                  <span className="font-semibold text-slate-700">{room.name}</span>
                  <span className="px-2 py-0.5 bg-primary/10 rounded-lg text-primary text-xs font-bold">{utilization} bookings</span>
                </div>
                <div className="w-full bg-slate-200/50 rounded-full h-2.5 overflow-hidden shadow-inner">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all-smooth shadow-soft"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass rounded-lg border border-white/20 p-5 sm:p-6 shadow-medium animate-slide-up">
        <h3 className="text-base sm:text-lg font-bold gradient-text mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Recent Bookings
        </h3>
        <div className="space-y-2 sm:space-y-3">
          {bookings.slice(0, 5).map((booking, idx) => (
            <div key={booking.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 py-3 border-b border-slate-200/50 last:border-0 hover:bg-primary/5 rounded-lg px-2 transition-colors" style={{ animationDelay: `${idx * 0.05}s` }}>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{booking.userDisplay}</p>
                <p className="text-xs sm:text-sm text-slate-500 font-medium flex items-center gap-1 flex-wrap mt-1">
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    {rooms.find(r => r.id === booking.roomId)?.name}
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {new Date(booking.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </p>
              </div>
              <span className={`px-3 py-1 rounded-lg text-xs font-bold shadow-soft self-start sm:self-auto ${
                booking.status === 'CONFIRMED' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {booking.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderBookings = () => (
    <div className="space-y-3 sm:space-y-4 animate-fade-in">
      {/* Filters */}
      <div className="glass rounded-lg border border-white/20 p-4 shadow-medium">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Search bookings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all-smooth font-medium shadow-soft"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all-smooth font-medium shadow-soft"
          >
            <option value="all">All Status</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <select
            value={filterRoom}
            onChange={(e) => setFilterRoom(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all-smooth font-medium shadow-soft"
          >
            <option value="all">All Rooms</option>
            {rooms.map(room => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
          <button
            onClick={onExportCSV}
            className="px-3 py-2 bg-primary hover:bg-primary-light text-white rounded-md font-bold transition-all-smooth shadow-sm hover:shadow-md flex items-center justify-center gap-2 group"
          >
            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Bookings - Desktop Table & Mobile Cards */}
      {filteredBookings.length === 0 ? (
        <div className="glass rounded-lg border border-white/20 p-12 text-center shadow-medium">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-slate-500 font-semibold">No bookings found matching your filters</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block glass rounded-lg border border-white/20 shadow-medium overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="glass-dark border-b border-white/20">
                  <tr>
                    <th className="text-left p-4 font-bold text-white">Room</th>
                    <th className="text-left p-4 font-bold text-white">User</th>
                    <th className="text-left p-4 font-bold text-white">Date & Time</th>
                    <th className="text-left p-4 font-bold text-white">Attendees</th>
                    <th className="text-left p-4 font-bold text-white">Status</th>
                    <th className="text-left p-4 font-bold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 bg-white/50">
                  {filteredBookings.map(booking => (
                    <tr key={booking.id} className="hover:bg-primary/5 transition-colors">
                      <td className="p-4 font-semibold text-slate-800">
                        {rooms.find(r => r.id === booking.roomId)?.name}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-800">{booking.userDisplay}</div>
                        <div className="text-xs text-slate-500 font-medium">{booking.userId}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-slate-800">{new Date(booking.startTime).toLocaleDateString()}</div>
                        <div className="text-xs text-slate-500 font-medium">
                          {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                          {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => setViewingAttendeesBooking(booking)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-md transition-colors cursor-pointer group shadow-soft"
                          title="Click to view attendees"
                        >
                          <svg className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <span className="text-sm font-bold text-primary">{booking.attendees.length}</span>
                        </button>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold shadow-soft ${
                          booking.status === 'CONFIRMED' ? 'bg-green-50 border border-green-200 text-green-700' :
                          booking.status === 'CANCELLED' ? 'bg-red-50 border border-red-200 text-red-700' :
                          'bg-slate-50 border border-slate-200 text-slate-700'
                        }`}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {booking.status === 'CONFIRMED' && (
                          <button
                            onClick={() => onCancelBooking(booking.id)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-600 hover:text-white font-bold rounded-lg transition-all-smooth shadow-sm hover:shadow-md"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {filteredBookings.map((booking, idx) => (
              <div key={booking.id} className="glass rounded-lg border border-white/20 p-4 shadow-medium hover:shadow-strong transition-all-smooth animate-slide-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center shadow-md flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 truncate">{rooms.find(r => r.id === booking.roomId)?.name}</h4>
                        <p className="text-xs text-slate-500 font-medium truncate">{booking.userDisplay}</p>
                      </div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold shadow-soft flex-shrink-0 ${
                    booking.status === 'CONFIRMED' ? 'bg-green-50 border border-green-200 text-green-700' :
                    booking.status === 'CANCELLED' ? 'bg-red-50 border border-red-200 text-red-700' :
                    'bg-slate-50 border border-slate-200 text-slate-700'
                  }`}>
                    {booking.status}
                  </span>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold text-slate-700">{new Date(booking.startTime).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-slate-600 font-medium">
                      {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                      {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-200/50">
                  <button
                    onClick={() => setViewingAttendeesBooking(booking)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-md transition-colors group shadow-soft"
                  >
                    <svg className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="text-sm font-bold text-primary">{booking.attendees.length} Attendees</span>
                  </button>
                  {booking.status === 'CONFIRMED' && (
                    <button
                      onClick={() => onCancelBooking(booking.id)}
                      className="flex-1 px-3 py-2 bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-600 hover:text-white font-bold rounded-md transition-all-smooth shadow-sm hover:shadow-md"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Attendees Modal */}
      {viewingAttendeesBooking && (
        <AttendeesModal
          booking={viewingAttendeesBooking}
          onClose={() => setViewingAttendeesBooking(null)}
        />
      )}
    </div>
  );

  const renderUsers = () => (
    <>
      <div className="glass rounded-lg border border-white/20 shadow-medium overflow-hidden animate-fade-in">
        <div className="p-4 sm:p-5 border-b border-slate-200/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-base sm:text-lg font-bold gradient-text flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            User Management
          </h3>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex-1 sm:flex-none px-3 py-2 glass hover:bg-white/80 border border-slate-200 text-slate-700 rounded-md font-bold text-sm transition-all-smooth shadow-soft hover:shadow-medium flex items-center justify-center gap-2 group"
            >
              <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="flex-1 sm:flex-none px-3 py-2 bg-primary hover:bg-primary-light text-white rounded-md font-bold text-sm transition-all-smooth shadow-sm hover:shadow-md flex items-center justify-center gap-2 group"
            >
              <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add User
            </button>
          </div>
        </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto custom-scrollbar">
        <table className="w-full text-sm">
          <thead className="glass-dark border-b border-white/20">
            <tr>
              <th className="text-left p-4 font-bold text-white">Name</th>
              <th className="text-left p-4 font-bold text-white">Email</th>
              <th className="text-left p-4 font-bold text-white">Role</th>
              <th className="text-left p-4 font-bold text-white">Joined</th>
              <th className="text-left p-4 font-bold text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/50 bg-white/50">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-primary/5 transition-colors">
                <td className="p-4 font-semibold text-slate-800">{user.name}</td>
                <td className="p-4 text-slate-600 font-medium">{user.email}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold shadow-soft ${
                    user.role === 'ADMIN' ? 'bg-purple-50 border border-purple-200 text-purple-700' : 'bg-blue-50 border border-blue-200 text-blue-700'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="p-4 text-slate-600 font-medium">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-lg font-bold text-sm transition-all-smooth shadow-soft"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingUser(user)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-600 hover:text-white font-bold rounded-lg transition-all-smooth shadow-sm hover:shadow-md"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden p-4 space-y-3">
        {users.map((user, idx) => (
          <div key={user.id} className="glass rounded-lg border border-white/20 p-4 shadow-medium hover:shadow-strong transition-all-smooth animate-slide-up" style={{ animationDelay: `${idx * 0.05}s` }}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-light rounded-md flex items-center justify-center shadow-glow flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-800 truncate">{user.name}</h4>
                  <p className="text-xs text-slate-500 font-medium truncate">{user.email}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-lg text-xs font-bold shadow-soft flex-shrink-0 ${
                user.role === 'ADMIN' ? 'bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 text-purple-700' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-700'
              }`}>
                {user.role}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm mb-3">
              <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-slate-600 font-semibold">Joined {new Date(user.createdAt).toLocaleDateString()}</span>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-200/50">
              <button
                onClick={() => setEditingUser(user)}
                className="flex-1 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-md font-bold text-sm transition-all-smooth shadow-soft flex items-center justify-center gap-2 group"
              >
                <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              <button
                onClick={() => setDeletingUser(user)}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-50 to-rose-50 hover:from-red-500 hover:to-rose-500 border border-red-200 hover:border-red-500 text-red-600 hover:text-white font-bold rounded-md transition-all-smooth shadow-soft hover:shadow-medium flex items-center justify-center gap-2 group"
              >
                <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
    {showImportModal && (
      <UserImportModal
        onClose={() => setShowImportModal(false)}
        onImportSuccess={() => {
          loadUsers();
        }}
      />
    )}
    {showAddUserModal && (
      <AddUserModal
        onClose={() => setShowAddUserModal(false)}
        onSuccess={() => {
          loadUsers();
        }}
      />
    )}
    {editingUser && (
      <EditUserModal
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSuccess={() => {
          loadUsers();
        }}
      />
    )}
    {deletingUser && (
      <ConfirmDeleteModal
        title="Delete User"
        message={`Are you sure you want to delete ${deletingUser.name}? This action cannot be undone and will also delete all their bookings.`}
        confirmText="Delete"
        onConfirm={handleDeleteUser}
        onCancel={() => setDeletingUser(null)}
        isLoading={isDeleting}
      />
    )}
  </>
  );

  const renderRooms = () => (
    <>
      <div className="glass rounded-lg border border-white/20 shadow-medium overflow-hidden animate-fade-in">
        <div className="p-4 sm:p-5 border-b border-slate-200/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-base sm:text-lg font-bold gradient-text flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Room Management
          </h3>
          <button
            onClick={() => setShowAddRoomModal(true)}
            className="w-full sm:w-auto px-3 py-2 bg-primary hover:bg-primary-light text-white rounded-md font-bold text-sm transition-all-smooth shadow-sm hover:shadow-md flex items-center justify-center gap-2 group"
          >
            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Room
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-5">
          {rooms.map((room, idx) => (
            <div key={room.id} className="glass rounded-lg border border-white/20 p-4 sm:p-5 shadow-medium hover:shadow-strong transition-all-smooth hover-lift animate-slide-up" style={{ animationDelay: `${idx * 0.05}s` }}>
              <div className="flex justify-between items-start mb-3 gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-light rounded-md flex items-center justify-center shadow-glow flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 text-base sm:text-lg truncate">{room.name}</h4>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium line-clamp-2">{room.description}</p>
                  </div>
                </div>
                <span className="px-3 py-1.5 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-md text-xs font-bold text-primary shadow-soft flex-shrink-0 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {room.capacity}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {room.features.map((feature, idx) => (
                  <span key={idx} className="px-3 py-1 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200/50 text-indigo-700 rounded-md text-xs font-bold shadow-soft">
                    {feature}
                  </span>
                ))}
              </div>
              <div className="flex gap-2 pt-3 border-t border-slate-200/50">
                <button
                  onClick={() => setEditingRoom(room)}
                  className="flex-1 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-md font-bold text-sm transition-all-smooth shadow-soft flex items-center justify-center gap-2 group"
                >
                  <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => setDeletingRoom(room)}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-50 to-rose-50 hover:from-red-500 hover:to-rose-500 border border-red-200 hover:border-red-500 text-red-600 hover:text-white font-bold rounded-md transition-all-smooth shadow-soft hover:shadow-medium flex items-center justify-center gap-2 group"
                >
                  <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {showAddRoomModal && (
        <AddRoomModal
          onClose={() => setShowAddRoomModal(false)}
          onSuccess={onRefresh}
        />
      )}
      {editingRoom && (
        <EditRoomModal
          room={editingRoom}
          onClose={() => setEditingRoom(null)}
          onSuccess={onRefresh}
        />
      )}
      {deletingRoom && (
        <ConfirmDeleteModal
          title="Delete Room"
          message={`Are you sure you want to delete "${deletingRoom.name}"? This action cannot be undone. Rooms with existing bookings cannot be deleted.`}
          confirmText="Delete"
          onConfirm={handleDeleteRoom}
          onCancel={() => setDeletingRoom(null)}
          isLoading={isDeleting}
        />
      )}
    </>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold gradient-text">Admin Dashboard</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Manage bookings, users, and rooms</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass rounded-lg border border-white/20 shadow-medium p-2 overflow-x-auto">
        <nav className="flex space-x-1 sm:space-x-2 min-w-max">
          {[
            { id: 'overview', label: 'Overview', Icon: BarChartIcon },
            { id: 'bookings', label: 'Bookings', Icon: CalendarIcon },
            { id: 'users', label: 'Users', Icon: UsersIcon },
            { id: 'rooms', label: 'Rooms', Icon: BuildingIcon },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`px-3 sm:px-4 py-2 rounded-md font-bold text-xs sm:text-sm transition-all-smooth flex items-center gap-2 whitespace-nowrap ${
                selectedTab === tab.id
                  ? 'bg-primary text-white shadow-md'
                  : 'text-slate-600 hover:bg-primary/5 hover:text-primary'
              }`}
            >
              <tab.Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${selectedTab === tab.id ? 'scale-110' : ''} transition-transform`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.slice(0, 4)}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'bookings' && renderBookings()}
        {selectedTab === 'users' && renderUsers()}
        {selectedTab === 'rooms' && renderRooms()}
      </div>
    </div>
  );
};

export default AdminDashboard;
