import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Timeline from './components/Timeline';
import BookingForm from './components/BookingForm';
import BookingDetails from './components/BookingDetails';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import AdminDashboard from './components/AdminDashboard';
import ConfirmModal from './components/ConfirmModal';
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
      toast.success(`Welcome to LibBook, ${registeredUser.name}!`);
      refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setAuthError(errorMessage);
      toast.error(errorMessage);
      throw error;
    }
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setIsAuthenticated(false);
    setBookings([]);
    setRooms([]);
    toast.info('You have been logged out');
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

  const renderHome = () => (
    <div className="flex flex-col h-[calc(100vh-140px)] sm:h-[calc(100vh-100px)]">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">
             {weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
           </h2>
           <div className="flex gap-2 text-sm text-slate-500">
             <button onClick={() => navigateWeek('prev')} className="hover:text-primary">&larr; Prev Week</button>
             <span className="text-slate-300">|</span>
             <button onClick={goToToday} className="hover:text-primary">Today</button>
             <span className="text-slate-300">|</span>
             <button onClick={() => navigateWeek('next')} className="hover:text-primary">Next Week &rarr;</button>
           </div>
        </div>
        
        {/* Room Tabs */}
        <div className="flex bg-slate-200 p-1 rounded-lg self-start sm:self-auto">
            {rooms.map(room => (
                <button
                    key={room.id}
                    onClick={() => { setSelectedRoomId(room.id); setSelectedRange(null); setSelectedBooking(null); }}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                        selectedRoomId === room.id 
                        ? 'bg-white text-primary shadow-sm' 
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                >
                    {room.name}
                </button>
            ))}
        </div>
      </div>

      {/* Main Area: Split View */}
      {activeRoom && (
        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex relative">
            {/* Left: Timeline */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="p-3 border-b bg-slate-50 flex justify-between items-center">
                    <div className="text-sm font-medium text-slate-600">
                        Select time for <span className="text-slate-900 font-bold">{activeRoom.name}</span>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden relative">
                    <Timeline 
                        weekStart={weekStart}
                        bookings={bookings}
                        room={activeRoom}
                        currentUser={user}
                        onRangeSelect={handleRangeSelect}
                        onBookingClick={handleBookingClick}
                        selectedRange={selectedRange}
                    />
                </div>
            </div>

            {/* Right: Side Panel (Conditional Slide-in) */}
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
        </div>
      )}
    </div>
  );

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
                    {myBookings.map(b => (
                        <div key={b.id} className="p-4 border-b last:border-0 flex justify-between items-center hover:bg-slate-50">
                            <div>
                                <div className="font-semibold text-slate-800">
                                    {rooms.find(r => r.id === b.roomId)?.name}
                                </div>
                                <div className="text-sm text-slate-500">
                                    {new Date(b.startTime).toLocaleString()}
                                </div>
                                {b.purpose && <div className="text-xs text-slate-400 mt-1 italic">"{b.purpose}"</div>}
                            </div>
                            <button 
                                onClick={() => handleCancelBooking(b.id)}
                                className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                                title="Cancel Booking"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
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
        />
      );
  };

  return (
    <>
      <Layout user={user} onNavigate={setCurrentPage} currentPage={currentPage} onLogout={handleLogout}>
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
    </>
  );
}

export default App;