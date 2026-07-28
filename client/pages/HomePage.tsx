import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { dateLocale } from '../i18n';
import Timeline from '../components/Timeline';
import DayView from '../components/DayView';
import MonthView from '../components/MonthView';
import ViewSwitcher, { CalendarView } from '../components/ViewSwitcher';
import MiniCalendar from '../components/MiniCalendar';
import BookingForm from '../components/BookingForm';
import BookingDetails from '../components/BookingDetails';
import RoomDetailsModal from '../components/RoomDetailsModal';
import {
  User,
  Room,
  Booking,
  Department,
  ScheduleException,
} from '../types';
import { api } from '../services/api';
import { useSettings } from '../contexts/SettingsContext';
import {
  getEffectiveOperatingHours,
  isRangeClosed,
} from '../utils/operatingHours';

interface HomePageProps {
  user: User;
  rooms: Room[];
  bookings: Booking[];
  onRefresh: () => void;
  onCancelBooking: (id: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({
  user,
  rooms,
  bookings,
  onRefresh,
  onCancelBooking,
}) => {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    rooms.length > 0 ? rooms[0].id : '',
  );
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [roomSearch, setRoomSearch] = useState('');

  // Departments derived from the rooms themselves; empty when the feature is unused
  const departments = useMemo(() => {
    const map = new Map<string, Department>();
    rooms.forEach((r) => {
      if (r.department) map.set(r.department.id, r.department);
    });
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [rooms]);

  const matchesSearch = (room: Room, q: string) =>
    room.name.toLowerCase().includes(q) ||
    room.description.toLowerCase().includes(q) ||
    room.features.some((f) => f.toLowerCase().includes(q)) ||
    (room.department?.name.toLowerCase().includes(q) ?? false);

  const visibleRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    let pool =
      selectedDeptId === 'all'
        ? rooms
        : rooms.filter((r) => r.departmentId === selectedDeptId);
    if (q) pool = pool.filter((r) => matchesSearch(r, q));
    return pool;
  }, [rooms, selectedDeptId, roomSearch]);

  // Sidebar room list grouped by department (unassigned last), search-filtered
  const roomGroups = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    const pool = q ? rooms.filter((r) => matchesSearch(r, q)) : rooms;
    const groups = new Map<string, { name: string; rooms: Room[] }>();
    for (const room of pool) {
      const key = room.departmentId || 'none';
      const name =
        room.department?.name ||
        (departments.length > 0 ? t('calendar.otherRooms') : t('calendar.rooms'));
      if (!groups.has(key)) groups.set(key, { name, rooms: [] });
      groups.get(key)!.rooms.push(room);
    }
    return Array.from(groups.entries())
      .map(([key, g]) => ({ key, ...g }))
      .sort((a, b) =>
        a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.name.localeCompare(b.name),
      );
  }, [rooms, departments.length, roomSearch, t]);

  const handleDeptSelect = (deptId: string) => {
    setSelectedDeptId(deptId);
    const pool =
      deptId === 'all' ? rooms : rooms.filter((r) => r.departmentId === deptId);
    if (!pool.some((r) => r.id === selectedRoomId) && pool.length > 0) {
      setSelectedRoomId(pool[0].id);
      setSelectedRange(null);
      setSelectedBooking(null);
    }
  };
  // Default to Day view on mobile (screens < 640px)
  const [calendarView, setCalendarView] = useState<CalendarView>(() => {
    return window.innerWidth < 640 ? 'day' : 'week';
  });
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [selectedRange, setSelectedRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const [detailsRoom, setDetailsRoom] = useState<Room | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const { operatingHours: globalHours } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);

  // Closures/special hours change rarely; one fetch per page load is enough
  useEffect(() => {
    api
      .getScheduleExceptions()
      .then(setExceptions)
      .catch(() => {});
  }, []);

  // Global search navigates here with ?room=<id> to select a room
  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam && rooms.some((r) => r.id === roomParam)) {
      setSelectedRoomId(roomParam);
      setSelectedRange(null);
      setSelectedBooking(null);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, rooms, setSearchParams]);

  // Open the booking form pre-filled with the next FREE one-hour slot:
  // within the room's operating hours and clear of existing bookings.
  const handleNewBooking = () => {
    if (!activeRoom) return;
    const hours = getEffectiveOperatingHours(activeRoom.department, globalHours);
    const roomBookings = bookings.filter(
      (b) =>
        b.roomId === activeRoom.id &&
        (b.status === 'CONFIRMED' || b.status === 'PENDING'),
    );
    const overlaps = (s: Date, e: Date) =>
      roomBookings.some(
        (b) => s < new Date(b.endTime) && e > new Date(b.startTime),
      );

    const DURATION_MS = 60 * 60000;
    const first = new Date();
    first.setMinutes(first.getMinutes() + (30 - (first.getMinutes() % 30)), 0, 0);

    // Scan forward in 30-minute steps, up to 14 days out
    for (let i = 0; i < 14 * 48; i++) {
      const s = new Date(first.getTime() + i * 30 * 60000);
      const e = new Date(s.getTime() + DURATION_MS);
      if (s.toDateString() !== e.toDateString()) continue; // stay within one day
      if (isRangeClosed(s, e, hours, activeRoom.departmentId, exceptions))
        continue;
      if (overlaps(s, e)) continue;
      setSelectedBooking(null);
      setSelectedRange({ start: s, end: e });
      setCurrentDate(new Date(s)); // bring the found day into view
      return;
    }

    // Nothing free in two weeks — open the form anyway with the naive slot
    setSelectedBooking(null);
    setSelectedRange({
      start: first,
      end: new Date(first.getTime() + DURATION_MS),
    });
  };

  const handleRangeSelect = (start: Date, end: Date) => {
    setSelectedBooking(null);
    setSelectedRange({ start, end });
  };

  const handleBookingClick = (booking: Booking) => {
    setSelectedRange(null);
    setSelectedBooking(booking);
  };

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

  const activeRoom = rooms.find((r) => r.id === selectedRoomId);
  const weekStart = getStartOfWeek(currentDate);
  const showSidePanel = selectedRange || selectedBooking;

  const viewLabel = t(`calendar.${calendarView}`);
  const dateDisplay = currentDate.toLocaleDateString(dateLocale(), {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] sm:h-[calc(100vh-96px)] animate-fade-in">
      {/* Outlook-style Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {t('common.today')}
          </button>
          <button
            onClick={() => navigateWeek('prev')}
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
            aria-label={t('calendar.prev', { view: viewLabel })}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={() => navigateWeek('next')}
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
            aria-label={t('calendar.next', { view: viewLabel })}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
          <h2 className="text-lg sm:text-xl font-semibold text-slate-800 truncate ml-1">
            {dateDisplay}
          </h2>
          {/* Date picker popup — desktop has the sidebar mini calendar instead */}
          <div className="relative lg:hidden">
            <button
              onClick={() => setShowMiniCalendar(!showMiniCalendar)}
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
              aria-label={t('calendar.openDatePicker')}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </button>
            {showMiniCalendar && (
              <>
                <div
                  className="fixed inset-0 bg-black bg-opacity-20 z-40"
                  onClick={() => setShowMiniCalendar(false)}
                />
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:absolute sm:top-full sm:left-auto sm:right-0 sm:translate-x-0 sm:translate-y-2 z-50">
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
          </div>
        </div>
        <ViewSwitcher
          currentView={calendarView}
          onViewChange={setCalendarView}
        />
      </div>

      {/* Mobile-only room browsing (desktop uses the sidebar) */}
      <div className="lg:hidden space-y-2">
        <div className="relative">
          <svg
            className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={roomSearch}
            onChange={(e) => setRoomSearch(e.target.value)}
            placeholder={t('calendar.searchRooms')}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
        {/* Department Filter (only when departments are in use) */}
        {departments.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-1 -mx-1 scrollbar-hide snap-x">
            {[
              { id: 'all', name: t('calendar.allDepartments') } as Department,
              ...departments,
            ].map((dept) => {
              const isSelected = selectedDeptId === dept.id;
              return (
                <button
                  key={dept.id}
                  onClick={() => handleDeptSelect(dept.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-300 border whitespace-nowrap snap-start
                    ${
                      isSelected
                        ? 'bg-accent text-white border-accent shadow-sm'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-accent/50 hover:text-accent'
                    }`}
                >
                  {dept.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Bottom Row: Compact Room List */}
        <div className="flex gap-2 overflow-x-auto pb-2 px-1 -mx-1 scrollbar-hide snap-x sticky top-0 z-10 bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/50">
          {visibleRooms.map((room, idx) => {
            const isSelected = selectedRoomId === room.id;
            return (
              <button
                key={room.id}
                onClick={() => {
                  setSelectedRoomId(room.id);
                  setSelectedRange(null);
                  setSelectedBooking(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all duration-300 border whitespace-nowrap snap-start
                  ${
                    isSelected
                      ? 'bg-primary text-white border-primary scale-100 ring-2 ring-primary/20'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-primary/50 hover:text-primary '
                  }`}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <span>{room.name}</span>
                {isSelected && (
                  <span className="flex items-center gap-1 text-[10px] font-medium bg-white/20 px-1.5 py-0.5 rounded text-white/90 ml-1">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    {room.maxCapacity}
                  </span>
                )}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailsRoom(room);
                  }}
                  title={t('calendar.aboutRoom', { name: room.name })}
                  className={`ml-1 -mr-1 p-0.5 rounded-full transition-colors ${
                    isSelected
                      ? 'text-white/70 hover:text-white hover:bg-white/20'
                      : 'text-slate-400 hover:text-primary hover:bg-primary/10'
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Area: Sidebar + Calendar (Outlook shell) */}
      <div className="flex-1 bg-white border border-slate-200 rounded-md overflow-hidden flex relative min-h-0">
        {/* Left Sidebar (desktop) */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-slate-50 border-r border-slate-200 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="p-3">
            <button
              onClick={handleNewBooking}
              disabled={!activeRoom}
              className="w-full py-2 px-4 bg-primary hover:bg-primary-light text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {t('common.newBooking')}
            </button>
          </div>
          <div className="px-3 pb-3 border-b border-slate-200">
            <MiniCalendar
              selectedDate={currentDate}
              onDateSelect={(date) => setCurrentDate(date)}
            />
          </div>
          <div className="p-3 space-y-4">
            <div className="relative">
              <svg
                className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
                placeholder={t('calendar.searchRooms')}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
            {roomGroups.length === 0 && (
              <p className="px-2 text-sm text-slate-400 italic">
                {t('calendar.noRoomsMatch')}
              </p>
            )}
            {roomGroups.map((group) => (
              <div key={group.key}>
                <p className="px-2 mb-1 text-xs font-bold text-primary">
                  {group.name}
                </p>
                <div className="space-y-0.5">
                  {group.rooms.map((room) => {
                    const isSelected = room.id === selectedRoomId;
                    return (
                      <div
                        key={room.id}
                        onClick={() => {
                          setSelectedRoomId(room.id);
                          setSelectedRange(null);
                          setSelectedBooking(null);
                        }}
                        className={`group flex items-center gap-2 py-1.5 pr-1.5 rounded cursor-pointer text-sm transition-colors ${
                          isSelected
                            ? 'border-l-2 border-primary pl-2 bg-white text-primary font-bold'
                            : 'pl-2.5 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <svg
                          className="w-4 h-4 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="truncate flex-1">{room.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailsRoom(room);
                          }}
                          title={t('calendar.aboutRoom', { name: room.name })}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full text-slate-400 hover:text-primary hover:bg-primary/10 transition-all"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {activeRoom ? (
          <>
          {/* Left: Calendar View */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="p-3 border-b bg-slate-50 flex justify-between items-center">
              <div className="text-sm font-medium text-slate-600">
                {calendarView === 'month'
                  ? t('calendar.clickDateToBook')
                  : t('calendar.selectTimeFor')}{' '}
                <span className="text-slate-900 font-bold">
                  {activeRoom.name}
                </span>
              </div>
              <button
                onClick={() => setDetailsRoom(activeRoom)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-primary/40 hover:text-primary rounded-md transition-colors flex items-center gap-1.5"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {t('common.details')}
              </button>
            </div>
            <div className="flex-1 overflow-hidden relative">
              {calendarView === 'week' && (
                <Timeline
                  weekStart={weekStart}
                  bookings={bookings}
                  room={activeRoom}
                  currentUser={user}
                  exceptions={exceptions}
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
                  exceptions={exceptions}
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
              className={`transition-all duration-300 ease-in-out border-l border-slate-200 bg-white z-40 absolute inset-y-0 right-0 sm:relative sm:shadow-none
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
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            {t('calendar.noRoomsAvailable')}
          </div>
        )}
      </div>

      {/* Mobile: New Booking FAB */}
      <button
        onClick={handleNewBooking}
        disabled={!activeRoom}
        className="lg:hidden fixed bottom-24 right-4 z-40 w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
        aria-label={t('common.newBooking')}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>

      {/* Read-only Room Details */}
      {detailsRoom && (
        <RoomDetailsModal
          room={detailsRoom}
          onClose={() => setDetailsRoom(null)}
        />
      )}
    </div>
  );
};

export default HomePage;
