import React, { useState, useMemo } from 'react';
import { User, Room, Booking } from '../types';
import { TrashIcon } from '../components/Icons';

type TabType = 'upcoming' | 'past' | 'cancelled';

interface MyBookingsPageProps {
  user: User;
  rooms: Room[];
  bookings: Booking[];
  onCancelBooking: (id: string) => void;
}

const ITEMS_PER_PAGE = 5;

const MyBookingsPage: React.FC<MyBookingsPageProps> = ({ user, rooms, bookings, onCancelBooking }) => {
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [currentPage, setCurrentPage] = useState(1);

  const myBookings = bookings.filter(b => b.userId === user.id);

  // Categorize bookings
  const categorizedBookings = useMemo(() => {
    const now = new Date();
    return {
      upcoming: myBookings
        .filter(b => b.status === 'CONFIRMED' && new Date(b.endTime) > now)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
      past: myBookings
        .filter(b => (b.status === 'CONFIRMED' || b.status === 'COMPLETED') && new Date(b.endTime) <= now)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
      cancelled: myBookings
        .filter(b => b.status === 'CANCELLED')
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    };
  }, [myBookings]);

  const filteredBookings = categorizedBookings[activeTab];
  const totalPages = Math.ceil(filteredBookings.length / ITEMS_PER_PAGE);
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when changing tabs
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'upcoming', label: 'Upcoming', count: categorizedBookings.upcoming.length },
    { key: 'past', label: 'Past', count: categorizedBookings.past.length },
    { key: 'cancelled', label: 'Cancelled', count: categorizedBookings.cancelled.length },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold gradient-text">My Bookings</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Manage your room reservations</p>
        </div>
        {myBookings.length > 0 && (
          <div className="glass px-4 py-2 rounded-md border border-white/20 shadow-soft">
            <span className="text-sm font-bold text-slate-700">{myBookings.length} {myBookings.length === 1 ? 'Booking' : 'Bookings'}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      {myBookings.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all-smooth flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-primary text-white shadow-md'
                  : 'glass border border-white/20 text-slate-600 hover:bg-white/50'
              }`}
            >
              {tab.label}
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.key
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {myBookings.length === 0 ? (
        <div className="glass rounded-lg border border-white/20 shadow-medium p-12 text-center animate-slide-up">
          <div className="w-20 h-20 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">No Bookings Yet</h3>
          <p className="text-slate-500 font-medium">Start by booking a room from the home page</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="glass rounded-lg border border-white/20 shadow-medium p-8 text-center animate-slide-up">
          <div className="w-16 h-16 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-1">No {activeTab} bookings</h3>
          <p className="text-slate-500 text-sm font-medium">
            {activeTab === 'upcoming' && 'Book a room to see your upcoming reservations'}
            {activeTab === 'past' && 'Your completed bookings will appear here'}
            {activeTab === 'cancelled' && 'No cancelled bookings'}
          </p>
        </div>
      ) : (
        <>
        <div className="grid gap-4">
          {paginatedBookings.map((b, idx) => {
            const hasEnded = new Date(b.endTime) <= new Date();
            const canCancel = b.status === 'CONFIRMED' && !hasEnded;
            const room = rooms.find(r => r.id === b.roomId);

            return (
              <div
                key={b.id}
                className="glass rounded-lg border border-white/20 shadow-medium hover:shadow-strong transition-all-smooth overflow-hidden hover-lift animate-slide-up"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className="p-5">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-primary rounded-md flex items-center justify-center shadow-md">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-slate-800">{room?.name || 'Unknown Room'}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold shadow-soft ${
                              b.status === 'CONFIRMED' ? 'bg-green-50 border border-green-200 text-green-700' :
                              b.status === 'CANCELLED' ? 'bg-red-50 border border-red-200 text-red-700' :
                              'bg-slate-50 border border-slate-200 text-slate-700'
                            }`}>
                              {b.status}
                            </span>
                            {!hasEnded && b.status === 'CONFIRMED' && (
                              <span className="px-2 py-1 bg-accent/10 border border-accent/20 rounded-lg text-xs font-bold text-accent flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse"></div>
                                Active
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-semibold text-slate-700">
                            {new Date(b.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-600 font-medium">
                            {new Date(b.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            {' - '}
                            {new Date(b.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {b.purpose && (
                          <div className="flex items-start gap-2 text-sm">
                            <svg className="w-4 h-4 text-accent mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            <span className="text-slate-600 font-medium italic">"{b.purpose}"</span>
                          </div>
                        )}
                        {b.status === 'CANCELLED' && b.cancellationReason && (
                          <div className="flex items-start gap-2 text-sm mt-3 p-3 bg-red-50 border border-red-200 rounded-lg animate-fade-in text-left">
                            <div className="min-w-4 pt-0.5">
                              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <span className="font-bold text-red-700 block mb-1">Reason for Cancellation:</span>
                              <span className="text-slate-700">{b.cancellationReason}</span>
                            </div>
                          </div>
                        )}                      </div>
                    </div>

                    {canCancel && (
                      <button
                        onClick={() => onCancelBooking(b.id)}
                        className="group px-3 py-2 bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-600 hover:text-white font-bold rounded-md transition-all-smooth shadow-sm hover:shadow-md flex items-center gap-2"
                        title="Cancel Booking"
                      >
                        <TrashIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span className="hidden sm:inline">Cancel</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between glass rounded-lg border border-white/20 px-4 py-3">
            <p className="text-sm text-slate-600 font-medium">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredBookings.length)} of {filteredBookings.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 rounded-md hover:bg-white/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="First page"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-md hover:bg-white/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-1 mx-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    if (totalPages <= 5) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (Math.abs(page - currentPage) <= 1) return true;
                    return false;
                  })
                  .map((page, idx, arr) => (
                    <React.Fragment key={page}>
                      {idx > 0 && arr[idx - 1] !== page - 1 && (
                        <span className="px-1 text-slate-400">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-md text-sm font-semibold transition-colors ${
                          currentPage === page
                            ? 'bg-primary text-white shadow-sm'
                            : 'hover:bg-white/50 text-slate-600'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  ))}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-md hover:bg-white/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-md hover:bg-white/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Last page"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
};

export default MyBookingsPage;
