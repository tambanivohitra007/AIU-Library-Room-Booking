import React, { useState } from 'react';
import Timeline from '../components/Timeline';
import DayView from '../components/DayView';
import MonthView from '../components/MonthView';
import ViewSwitcher, { CalendarView } from '../components/ViewSwitcher';
import MiniCalendar from '../components/MiniCalendar';
import BookingForm from '../components/BookingForm';
import BookingDetails from '../components/BookingDetails';
import { User, Room, Booking } from '../types';

interface HomePageProps {
  user: User;
  rooms: Room[];
  bookings: Booking[];
  onRefresh: () => void;
  onCancelBooking: (id: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ user, rooms, bookings, onRefresh, onCancelBooking }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms.length > 0 ? rooms[0].id : '');
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [selectedRange, setSelectedRange] = useState<{start: Date, end: Date} | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

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
    onRefresh();
  };

  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  const activeRoom = rooms.find(r => r.id === selectedRoomId);
  const weekStart = getStartOfWeek(currentDate);
  const showSidePanel = selectedRange || selectedBooking;

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
                  onCancelBooking={onCancelBooking}
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

export default HomePage;
