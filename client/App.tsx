import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Timeline from './components/Timeline';
import DayView from './components/DayView';
import MonthView from './components/MonthView';
import ViewSwitcher, { CalendarView } from './components/ViewSwitcher';
import MiniCalendar from './components/MiniCalendar';
import BookingForm from './components/BookingForm';
import BookingDetails from './components/BookingDetails';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import AdminDashboard from './components/AdminDashboard';
import ConfirmModal from './components/ConfirmModal';
import ChangePasswordModal from './components/ChangePasswordModal';
import LoadingOverlay from './components/LoadingOverlay';
import { api } from './services/api';
import { User, Room, Booking, UserRole } from './types';
import { TrashIcon } from './components/Icons';
import { useToast } from './contexts/ToastContext';

function App() {
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState('home');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);

  // Selection State
  const [selectedRange, setSelectedRange] = useState<{start: Date, end: Date} | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Change Password Modal State
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Force refresh trigger
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      setIsAuthLoading(true);
      try {
        const currentUser = await api.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Load data only if authenticated
    const loadData = async () => {
      setIsDataLoading(true);
      try {
        const loadedRooms = await api.getRooms();
        setRooms(loadedRooms);
        if (loadedRooms.length > 0 && !selectedRoomId) {
          setSelectedRoomId(loadedRooms[0].id);
        }

        const loadedBookings = await api.getBookings();
        setBookings(loadedBookings);
      } catch (error) {
        console.error('Failed to load data:', error);
        toast.error('Failed to load data');
      } finally {
        setIsDataLoading(false);
      }
    };

    loadData();
  }, [tick, isAuthenticated]);

  const handleRangeSelect = (start: Date, end: Date) => {
      setSelectedBooking(null);
      setSelectedRange({ start, end });
  };
  
  const handleBookingClick = (booking: Booking) => {
      setSelectedRange(null);
      setSelectedBooking(booking);
  }

  const handleBookingSuccess = () => {
    setSelectedRange(null);
    refresh();
  };

  const handleCancelBooking = async (id: string) => {
      setConfirmModal({
        isOpen: true,
        title: 'Cancel Booking',
        message: 'Are you sure you want to cancel this booking? This action cannot be undone.',
        onConfirm: async () => {
          setConfirmModal({ ...confirmModal, isOpen: false });
          try {
            const success = await api.cancelBooking(id);
            if (success) {
              toast.success('Booking cancelled successfully');
              refresh();
              setSelectedBooking(null);
            } else {
              toast.error('Could not cancel booking');
            }
          } catch (error) {
            toast.error('Failed to cancel booking');
          }
        },
      });
  }

  const handleExportCSV = async () => {
    const allBookings = await api.getAllBookingsForAdmin();
    const headers = ["Booking ID", "Room", "User Name", "User ID", "Start Time", "End Time", "Status", "Attendees Count", "Attendees List", "Purpose"];
    const rows = allBookings.map(b => [
        b.id,
        rooms.find(r => r.id === b.roomId)?.name || b.roomId,
        `"${b.userDisplay}"`,
        b.userId,
        new Date(b.startTime).toISOString(),
        new Date(b.endTime).toISOString(),
        b.status,
        b.attendees.length,
        `"${b.attendees.map(a => a.name).join(', ')}"`,
        `"${b.purpose || ''}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bookings_export_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      setAuthError(null);
      const { user: loggedInUser } = await api.login(email, password);
      setUser(loggedInUser);
      setIsAuthenticated(true);
      toast.success(`Welcome back, ${loggedInUser.name}!`);
      refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setAuthError(errorMessage);
      toast.error(errorMessage);
      throw error;
    }
  };

  const handleRegister = async (name: string, email: string, password: string) => {
    try {
      setAuthError(null);
      const { user: registeredUser } = await api.register(name, email, password);
      setUser(registeredUser);
      setIsAuthenticated(true);
      toast.success(`Welcome to AIU Library, ${registeredUser.name}!`);
      refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setAuthError(errorMessage);
      toast.error(errorMessage);
      throw error;
    }
  };

  const handleLogout = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      onConfirm: () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        api.logout();
        setUser(null);
        setIsAuthenticated(false);
        setBookings([]);
        setRooms([]);
        toast.info('You have been logged out');
      },
    });
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    try {
      await api.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to change password';
      toast.error(errorMessage);
      throw error;
    }
  };

  // --- Date Navigation Helpers ---
  const getStartOfWeek = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      return new Date(date.setDate(diff));
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
      setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  // Show loading overlay during initial auth check
  if (isAuthLoading) {
    return <LoadingOverlay message="Checking authentication..." />;
  }

  // Show login/register if not authenticated
  if (!isAuthenticated || !user) {
    if (authView === 'login') {
      return (
        <LoginForm
          onLogin={handleLogin}
          onSwitchToRegister={() => { setAuthView('register'); setAuthError(null); }}
          error={authError}
        />
      );
    } else {
      return (
        <RegisterForm
          onRegister={handleRegister}
          onSwitchToLogin={() => { setAuthView('login'); setAuthError(null); }}
          error={authError}
        />
      );
    }
  }

  const activeRoom = rooms.find(r => r.id === selectedRoomId);
  const weekStart = getStartOfWeek(currentDate);
  const showSidePanel = selectedRange || selectedBooking;

  // --- PAGES ---

  const renderHome = () => {
    const viewLabel = calendarView === 'day' ? 'Day' : calendarView === 'week' ? 'Week' : 'Month';
    const dateDisplay = calendarView === 'month'
      ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
      <div className="flex flex-col h-[calc(100vh-140px)] sm:h-[calc(100vh-100px)]">
        {/* Enhanced Calendar Header Controls */}
        <div className="flex flex-col gap-3 mb-4">
          {/* Top Row: Date & View Switcher */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">{dateDisplay}</h2>
            </div>
            {/* View Switcher - Desktop */}
            <div className="hidden sm:block">
              <ViewSwitcher currentView={calendarView} onViewChange={setCalendarView} />
            </div>
          </div>

          {/* Middle Row: Navigation & Mobile View Switcher */}
          <div className="flex items-center justify-between gap-2">
            {/* Navigation Controls */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => navigateWeek('prev')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label={`Previous ${viewLabel}`}
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-2 text-sm font-medium text-primary hover:bg-indigo-50 rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => navigateWeek('next')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label={`Next ${viewLabel}`}
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => setShowMiniCalendar(!showMiniCalendar)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors ml-1"
                aria-label="Open calendar picker"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            </div>

            {/* View Switcher - Mobile */}
            <div className="sm:hidden">
              <ViewSwitcher currentView={calendarView} onViewChange={setCalendarView} />
            </div>
          </div>

          {/* Bottom Row: Room Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => { setSelectedRoomId(room.id); setSelectedRange(null); setSelectedBooking(null); }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                  selectedRoomId === room.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {room.name}
              </button>
            ))}
          </div>

          {/* Room Details - Show when a room is selected */}
          {activeRoom && (
            <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 mb-2">{activeRoom.description}</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-700">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Capacity: {activeRoom.capacity}
                    </span>
                    {activeRoom.features.map((feature, idx) => (
                      <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mini Calendar Popup */}
        {showMiniCalendar && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-20 z-40"
              onClick={() => setShowMiniCalendar(false)}
            />
            {/* Calendar */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:top-24 sm:left-4 sm:translate-x-0 sm:translate-y-0 z-50">
              <MiniCalendar
                selectedDate={currentDate}
                onDateSelect={(date) => {
                  setCurrentDate(date);
                  setShowMiniCalendar(false);
                }}
              />
            </div>
          </>
        )}

        {/* Main Area: Split View */}
        {activeRoom && (
          <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex relative">
            {/* Left: Calendar View */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="p-3 border-b bg-slate-50 flex justify-between items-center">
                <div className="text-sm font-medium text-slate-600">
                  {calendarView === 'month' ? 'Click date to book' : 'Select time for'}{' '}
                  <span className="text-slate-900 font-bold">{activeRoom.name}</span>
                </div>
              </div>
              <div className="flex-1 overflow-hidden relative">
                {calendarView === 'week' && (
                  <Timeline
                    weekStart={weekStart}
                    bookings={bookings}
                    room={activeRoom}
                    currentUser={user}
                    onRangeSelect={handleRangeSelect}
                    onBookingClick={handleBookingClick}
                    selectedRange={selectedRange}
                  />
                )}
                {calendarView === 'day' && (
                  <DayView
                    selectedDate={currentDate}
                    bookings={bookings}
                    room={activeRoom}
                    currentUser={user}
                    onRangeSelect={handleRangeSelect}
                    onBookingClick={handleBookingClick}
                    selectedRange={selectedRange}
                  />
                )}
                {calendarView === 'month' && (
                  <MonthView
                    selectedDate={currentDate}
                    bookings={bookings}
                    room={activeRoom}
                    currentUser={user}
                    onDateSelect={(date) => {
                      setCurrentDate(date);
                      setCalendarView('day');
                    }}
                    onBookingClick={handleBookingClick}
                  />
                )}
              </div>
            </div>

            {/* Right: Side Panel (Conditional Slide-in) */}
            {calendarView !== 'month' && (
              <div
                className={`transition-all duration-300 ease-in-out border-l border-slate-200 bg-white z-40 absolute inset-y-0 right-0 shadow-2xl sm:relative sm:shadow-none
                  ${showSidePanel ? 'w-full sm:w-80 translate-x-0' : 'w-0 translate-x-full sm:translate-x-0 overflow-hidden opacity-0 sm:opacity-100 sm:w-0'}
                `}
              >
                {selectedRange && (
                  <BookingForm
                    selectedRoom={activeRoom}
                    startTime={selectedRange.start}
                    endTime={selectedRange.end}
                    onSuccess={handleBookingSuccess}
                    onCancel={() => setSelectedRange(null)}
                  />
                )}

                {selectedBooking && !selectedRange && (
                  <BookingDetails
                    booking={selectedBooking}
                    room={activeRoom}
                    currentUser={user}
                    onCancelBooking={handleCancelBooking}
                    onClose={() => setSelectedBooking(null)}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderMyBookings = () => {
    const myBookings = bookings.filter(b => b.userId === user.id);
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">My Bookings</h2>
            {myBookings.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed text-slate-400">
                    No active bookings found.
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    {myBookings.map(b => {
                        const hasEnded = new Date(b.endTime) <= new Date();
                        const canCancel = b.status === 'CONFIRMED' && !hasEnded;

                        return (
                            <div key={b.id} className="p-4 border-b last:border-0 flex justify-between items-center hover:bg-slate-50">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className="font-semibold text-slate-800">
                                            {rooms.find(r => r.id === b.roomId)?.name}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                            b.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                                            b.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}>
                                            {b.status}
                                        </span>
                                    </div>
                                    <div className="text-sm text-slate-500">
                                        {new Date(b.startTime).toLocaleString()}
                                    </div>
                                    {b.purpose && <div className="text-xs text-slate-400 mt-1 italic">"{b.purpose}"</div>}
                                </div>
                                {canCancel ? (
                                    <button
                                        onClick={() => handleCancelBooking(b.id)}
                                        className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                                        title="Cancel Booking"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                ) : (
                                    <div className="text-xs text-slate-400 px-2">
                                        {hasEnded ? 'Ended' : b.status === 'CANCELLED' ? 'Cancelled' : 'Completed'}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    )
  };

  const renderAdmin = () => {
      if (user.role !== UserRole.ADMIN) return <div>Access Denied</div>;
      return (
        <AdminDashboard
          bookings={bookings}
          rooms={rooms}
          onExportCSV={handleExportCSV}
          onCancelBooking={handleCancelBooking}
          onRefresh={refresh}
        />
      );
  };

  return (
    <>
      <Layout
        user={user}
        onNavigate={setCurrentPage}
        currentPage={currentPage}
        onLogout={handleLogout}
        onChangePassword={() => setShowChangePasswordModal(true)}
      >
        {currentPage === 'home' && renderHome()}
        {currentPage === 'my-bookings' && renderMyBookings()}
        {currentPage === 'admin' && renderAdmin()}
      </Layout>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Confirm"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        onSubmit={handleChangePassword}
      />
    </>
  );
}

export default App;