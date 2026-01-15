import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ConfirmModal from './components/ConfirmModal';
import CancelBookingModal from './components/CancelBookingModal';
import ChangePasswordModal from './components/ChangePasswordModal';
import LoadingOverlay from './components/LoadingOverlay';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import MyBookingsPage from './pages/MyBookingsPage';
import AdminPage from './pages/AdminPage';
import { api } from './services/api';
import { User, Room, Booking } from './types';
import { useToast } from './contexts/ToastContext';

function App() {
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Cancel Booking Modal State
  const [cancelBookingModal, setCancelBookingModal] = useState<{
    isOpen: boolean;
    bookingId: string | null;
  }>({
    isOpen: false,
    bookingId: null,
  });

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
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
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

  // Poll for updates every 5 seconds when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const intervalId = setInterval(() => {
      refresh();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Load data only if authenticated
    const loadData = async () => {
      // Don't show loading spinner for background refreshes unless it's the first load
      if (rooms.length === 0) setIsDataLoading(true);
      
      try {
        const [loadedRooms, loadedBookings] = await Promise.all([
          api.getRooms(),
          api.getBookings()
        ]);
        
        // Only update state if data has actually changed to prevent unnecessary re-renders
        // Simple comparison by length + last item ID or timestamp would be better, but deep check is expensive
        // For now, we just set state which triggers re-render. React handles DOM diffing.
        setRooms(loadedRooms);
        setBookings(loadedBookings);
        setLastRefreshed(new Date());
      } catch (error) {
        console.error('Failed to load data:', error);
        // Only show toast error on initial load failure, not on polling failure to avoid spamming the user
        if (rooms.length === 0) toast.error('Failed to load data');
      } finally {
        setIsDataLoading(false);
      }
    };

    loadData();
  }, [tick, isAuthenticated]);

  const handleCancelBooking = (id: string) => {
    setCancelBookingModal({
      isOpen: true,
      bookingId: id,
    });
  };

  const onConfirmCancelBooking = async (reason: string) => {
    if (!cancelBookingModal.bookingId) return;
    
    const id = cancelBookingModal.bookingId;
    setCancelBookingModal({ isOpen: false, bookingId: null });

    try {
      const success = await api.cancelBooking(id, reason);
      if (success) {
        toast.success('Booking cancelled successfully');
        refresh();
      } else {
        toast.error('Could not cancel booking');
      }
    } catch (error) {
      toast.error('Failed to cancel booking');
    }
  };

  const handleExportCSV = async () => {
    try {
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
    } catch (error) {
      toast.error('Failed to export CSV');
    }
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
      const { message } = await api.register(name, email, password);
      // Do not log in immediately. Show success message and redirect to login.
      toast.success(message || 'Registration successful. Waiting for approval.');
      // Returning true/false or similar might be needed if RegisterForm expects it, 
      // but usually throwing error handles failure.
      
      // We need to tell the RegisterForm to switch to Login view
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

  // Show loading overlay during initial auth check
  if (isAuthLoading) {
    return <LoadingOverlay message="Checking authentication..." />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route
          path="/login"
          element={
            isAuthenticated && user ? (
              <Navigate to="/" replace />
            ) : (
              <LoginForm
                onLogin={handleLogin}
                error={authError}
              />
            )
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated && user ? (
              <Navigate to="/" replace />
            ) : (
              <RegisterForm
                onRegister={handleRegister}
                error={authError}
              />
            )
          }
        />

        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute user={user} isAuthenticated={isAuthenticated}>
              <Layout
                user={user!}
                onLogout={handleLogout}
                onChangePassword={() => setShowChangePasswordModal(true)}
              >
                <HomePage
                  user={user!}
                  rooms={rooms}
                  bookings={bookings}
                  onRefresh={refresh}
                  onCancelBooking={handleCancelBooking}
                />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-bookings"
          element={
            <ProtectedRoute user={user} isAuthenticated={isAuthenticated}>
              <Layout
                user={user!}
                onLogout={handleLogout}
                onChangePassword={() => setShowChangePasswordModal(true)}
              >
                <MyBookingsPage
                  user={user!}
                  rooms={rooms}
                  bookings={bookings}
                  onCancelBooking={handleCancelBooking}
                />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute user={user} isAuthenticated={isAuthenticated} requireAdmin={true}>
              <Layout
                user={user!}
                onLogout={handleLogout}
                onChangePassword={() => setShowChangePasswordModal(true)}
              >
                <AdminPage
                  user={user!}
                  rooms={rooms}
                  bookings={bookings}
                  onExportCSV={handleExportCSV}
                  onCancelBooking={handleCancelBooking}
                  onRefresh={refresh}
                />
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>

      {/* Global Modals */}
      <CancelBookingModal
        isOpen={cancelBookingModal.isOpen}
        onConfirm={onConfirmCancelBooking}
        onCancel={() => setCancelBookingModal({ isOpen: false, bookingId: null })}
      />

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
    </BrowserRouter>
  );
}

export default App;