import React, { useState, useEffect } from 'react';
import { User, Room, Booking, UserRole } from '../types';
import { api } from '../services/api';
import { BarChartIcon, CalendarIcon, UsersIcon, BuildingIcon } from './Icons';
import UserImportModal from './UserImportModal';
import AddUserModal from './AddUserModal';
import EditUserModal from './EditUserModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface AdminDashboardProps {
  bookings: Booking[];
  rooms: Room[];
  onExportCSV: () => void;
  onCancelBooking: (id: string) => void;
}

interface Stats {
  totalBookings: number;
  activeBookings: number;
  totalUsers: number;
  roomUtilization: { [key: string]: number };
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ bookings, rooms, onExportCSV, onCancelBooking }) => {
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
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Bookings</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats?.totalBookings || 0}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Active Now</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats?.activeBookings || 0}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Users</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats?.totalUsers || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Rooms</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{rooms.length}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Room Utilization */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Room Utilization</h3>
        <div className="space-y-4">
          {rooms.map(room => {
            const utilization = stats?.roomUtilization[room.id] || 0;
            const percentage = Math.min((utilization / 20) * 100, 100); // Assuming 20 is max
            return (
              <div key={room.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">{room.name}</span>
                  <span className="text-slate-500">{utilization} bookings</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Bookings</h3>
        <div className="space-y-3">
          {bookings.slice(0, 5).map(booking => (
            <div key={booking.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div className="flex-1">
                <p className="font-medium text-slate-800">{booking.userDisplay}</p>
                <p className="text-sm text-slate-500">
                  {rooms.find(r => r.id === booking.roomId)?.name} • {new Date(booking.startTime).toLocaleDateString()}
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search bookings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Status</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <select
            value={filterRoom}
            onChange={(e) => setFilterRoom(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Rooms</option>
            {rooms.map(room => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
          <button
            onClick={onExportCSV}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-4 font-semibold text-slate-700">Room</th>
                <th className="text-left p-4 font-semibold text-slate-700">User</th>
                <th className="text-left p-4 font-semibold text-slate-700">Date & Time</th>
                <th className="text-left p-4 font-semibold text-slate-700">Attendees</th>
                <th className="text-left p-4 font-semibold text-slate-700">Status</th>
                <th className="text-left p-4 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBookings.map(booking => (
                <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-800">
                    {rooms.find(r => r.id === booking.roomId)?.name}
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-slate-800">{booking.userDisplay}</div>
                    <div className="text-xs text-slate-500">{booking.userId}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-slate-800">{new Date(booking.startTime).toLocaleDateString()}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                      {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-full">
                      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span className="text-sm font-medium text-slate-700">{booking.attendees.length}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                      booking.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {booking.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {booking.status === 'CONFIRMED' && (
                      <button
                        onClick={() => onCancelBooking(booking.id)}
                        className="text-red-600 hover:text-red-700 font-medium text-sm"
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
        {filteredBookings.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            No bookings found matching your filters
          </div>
        )}
      </div>
    </div>
  );

  const renderUsers = () => (
    <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-800">User Management</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm transition-colors"
            >
              Import Users
            </button>
            <button 
              onClick={() => setShowAddUserModal(true)}
              className="px-4 py-2 bg-primary hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              Add User
            </button>
          </div>
        </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left p-4 font-semibold text-slate-700">Name</th>
              <th className="text-left p-4 font-semibold text-slate-700">Email</th>
              <th className="text-left p-4 font-semibold text-slate-700">Role</th>
              <th className="text-left p-4 font-semibold text-slate-700">Joined</th>
              <th className="text-left p-4 font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-medium text-slate-800">{user.name}</td>
                <td className="p-4 text-slate-600">{user.email}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="p-4 text-slate-600">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="p-4">
                  <button 
                    onClick={() => setEditingUser(user)}
                    className="text-primary hover:text-indigo-700 font-medium text-sm mr-3"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => setDeletingUser(user)}
                    className="text-red-600 hover:text-red-700 font-medium text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-800">Room Management</h3>
        <button className="px-4 py-2 bg-primary hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors">
          Add Room
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {rooms.map(room => (
          <div key={room.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-semibold text-slate-800 text-lg">{room.name}</h4>
                <p className="text-sm text-slate-500 mt-1">{room.description}</p>
              </div>
              <span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-700">
                Cap: {room.capacity}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {room.features.map((feature, idx) => (
                <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                  {feature}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="flex-1 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 rounded text-sm font-medium text-slate-700 transition-colors">
                Edit
              </button>
              <button className="flex-1 px-3 py-1.5 border border-red-300 hover:bg-red-50 rounded text-sm font-medium text-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Admin Dashboard</h2>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', Icon: BarChartIcon },
            { id: 'bookings', label: 'Bookings', Icon: CalendarIcon },
            { id: 'users', label: 'Users', Icon: UsersIcon },
            { id: 'rooms', label: 'Rooms', Icon: BuildingIcon },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center ${
                selectedTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.Icon className="w-4 h-4 mr-2" />
              {tab.label}
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
