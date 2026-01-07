import React, { useMemo, useState } from 'react';
import { Booking, Room, User, UserRole } from '../types';
import { OPENING_HOUR, CLOSING_HOUR } from '../constants';

interface DayViewProps {
  selectedDate: Date;
  bookings: Booking[];
  room: Room;
  currentUser: User;
  onRangeSelect: (start: Date, end: Date) => void;
  onBookingClick: (booking: Booking) => void;
  selectedRange?: { start: Date; end: Date } | null;
}

const DayView: React.FC<DayViewProps> = ({
  selectedDate,
  bookings,
  room,
  currentUser,
  onRangeSelect,
  onBookingClick,
  selectedRange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragCurrent, setDragCurrent] = useState<number | null>(null);

  const hours = useMemo(() => {
    const h = [];
    for (let i = OPENING_HOUR; i < CLOSING_HOUR; i++) h.push(i);
    return h;
  }, []);

  // Filter bookings for this day and room (only show CONFIRMED bookings)
  const dayBookings = useMemo(() => {
    return bookings.filter((b) => {
      const bDate = new Date(b.startTime);
      return (
        b.roomId === room.id &&
        bDate.getDate() === selectedDate.getDate() &&
        bDate.getMonth() === selectedDate.getMonth() &&
        bDate.getFullYear() === selectedDate.getFullYear() &&
        b.status === 'CONFIRMED'
      );
    });
  }, [bookings, selectedDate, room.id]);

  // Check if a time is during library closure (Friday 5 PM - Sunday 8 AM)
  const isLibraryClosed = (date: Date) => {
    const day = date.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
    const hour = date.getHours();

    // Saturday - all day closed
    if (day === 6) return true;

    // Friday after 5 PM (17:00)
    if (day === 5 && hour >= 17) return true;

    // Sunday before opening hour (8 AM)
    if (day === 0 && hour < OPENING_HOUR) return true;

    return false;
  };

  const checkOverlap = (start: Date, end: Date) => {
    // Check if time falls during library closure
    if (isLibraryClosed(start) || isLibraryClosed(end)) {
      return true;
    }

    // Check for booking conflicts
    return dayBookings.some((b) => {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return start < bEnd && end > bStart;
    });
  };

  const getPositionStyle = (start: Date, end: Date) => {
    const startMinutes = (start.getHours() - OPENING_HOUR) * 60 + start.getMinutes();
    const durationMinutes = (end.getTime() - start.getTime()) / 60000;
    const totalDayMinutes = (CLOSING_HOUR - OPENING_HOUR) * 60;

    const topPercent = (startMinutes / totalDayMinutes) * 100;
    const heightPercent = (durationMinutes / totalDayMinutes) * 100;

    return {
      top: `${topPercent}%`,
      height: `${heightPercent}%`,
    };
  };

  const handleMouseDown = (minutes: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const slotTime = new Date(selectedDate);
    slotTime.setHours(OPENING_HOUR + Math.floor(minutes / 60), minutes % 60, 0, 0);
    const slotEnd = new Date(slotTime);
    slotEnd.setMinutes(slotEnd.getMinutes() + 15);

    if (checkOverlap(slotTime, slotEnd)) return;

    setIsDragging(true);
    setDragStart(minutes);
    setDragCurrent(minutes + 15);
  };

  const handleMouseEnter = (minutes: number) => {
    if (!isDragging || dragStart === null) return;
    setDragCurrent(minutes + 15);
  };

  const handleMouseUp = () => {
    if (isDragging && dragStart !== null && dragCurrent !== null) {
      const startMin = Math.min(dragStart, dragCurrent - 15);
      const endMin = Math.max(dragStart, dragCurrent - 15) + 15;

      const startTime = new Date(selectedDate);
      startTime.setHours(OPENING_HOUR, startMin, 0, 0);

      const endTime = new Date(selectedDate);
      endTime.setHours(OPENING_HOUR, endMin, 0, 0);

      if (!checkOverlap(startTime, endTime)) {
        onRangeSelect(startTime, endTime);
      }
    }
    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  // Calculate drag preview style
  let dragStyle = {};
  let isDragValid = true;
  if (isDragging && dragStart !== null && dragCurrent !== null) {
    const startMin = Math.min(dragStart, dragCurrent - 15);
    const endMin = Math.max(dragStart, dragCurrent - 15) + 15;

    const s = new Date(selectedDate);
    s.setHours(OPENING_HOUR, startMin, 0, 0);
    const e = new Date(selectedDate);
    e.setHours(OPENING_HOUR, endMin, 0, 0);

    dragStyle = getPositionStyle(s, e);
    isDragValid = !checkOverlap(s, e);
  }

  // Selection style
  let selectionStyle = null;
  if (!isDragging && selectedRange) {
    const s = selectedRange.start;
    const e = selectedRange.end;
    if (
      s.getDate() === selectedDate.getDate() &&
      s.getMonth() === selectedDate.getMonth() &&
      s.getFullYear() === selectedDate.getFullYear()
    ) {
      selectionStyle = getPositionStyle(s, e);
    }
  }

  // Calculate closed hours overlay
  const dayOfWeek = selectedDate.getDay();
  let closedStyle = null;
  let closedLabel = '';

  if (dayOfWeek === 6) {
    // Saturday - all day closed
    closedStyle = { top: '0%', height: '100%' };
    closedLabel = 'Library Closed';
  } else if (dayOfWeek === 5) {
    // Friday - closed from 5 PM (17:00) onwards
    const closedStart = new Date(selectedDate);
    closedStart.setHours(17, 0, 0, 0);
    const closedEnd = new Date(selectedDate);
    closedEnd.setHours(CLOSING_HOUR, 0, 0, 0);
    closedStyle = getPositionStyle(closedStart, closedEnd);
    closedLabel = 'Closed';
  } else if (dayOfWeek === 0) {
    // Sunday - closed until opening hour
    const closedStart = new Date(selectedDate);
    closedStart.setHours(OPENING_HOUR, 0, 0, 0);
    const closedEnd = new Date(selectedDate);
    closedEnd.setHours(OPENING_HOUR, 0, 0, 0);
    closedStyle = getPositionStyle(closedStart, closedEnd);
    closedLabel = 'Closed';
  }

  return (
    <div className="flex flex-col h-full select-none">
      {/* Header */}
      <div className="flex border-b border-slate-200 bg-slate-50 py-3 px-4">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase mb-1 text-slate-500">
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
          </div>
          <div className="text-2xl font-light text-slate-700">{selectedDate.getDate()}</div>
          <div className="text-xs text-slate-500">
            {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="flex relative min-h-[600px] h-full">
          {/* Time Sidebar */}
          <div className="w-16 shrink-0 bg-white border-r border-slate-100 text-xs text-slate-400 font-mono flex flex-col relative z-20 pt-2">
            {hours.map((h, idx) => (
              <div key={h} className="flex-1 border-b border-transparent relative">
                <span className={`absolute right-2 ${idx === 0 ? 'top-0' : '-top-2.5'}`}>
                  {h}:00
                </span>
              </div>
            ))}
          </div>

          {/* Main Column */}
          <div className="flex-1 relative border-l border-slate-100">
            {/* Horizontal Hour Lines */}
            <div className="absolute inset-0 z-0 flex flex-col pointer-events-none">
              {hours.map((h) => (
                <div key={h} className="flex-1 border-b border-slate-100/60"></div>
              ))}
            </div>

            {/* Time Slots */}
            <div className="absolute inset-0 z-10">
              {hours.map((h, hIndex) => (
                <div key={h} className="h-[calc(100%/14)] flex flex-col">
                  {[0, 15, 30, 45].map((m) => (
                    <div
                      key={m}
                      className="flex-1 hover:bg-black/5 cursor-crosshair"
                      onMouseDown={(e) => handleMouseDown(hIndex * 60 + m, e)}
                      onMouseEnter={() => handleMouseEnter(hIndex * 60 + m)}
                      onMouseUp={handleMouseUp}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Drag Preview */}
            {isDragging && (
              <div
                className={`absolute left-0 right-0 z-30 rounded opacity-70 pointer-events-none transition-all ${
                  isDragValid
                    ? 'bg-primary/80 border-2 border-primary'
                    : 'bg-red-500/50 border-2 border-red-600'
                }`}
                style={{ ...dragStyle, left: '8px', right: '8px' }}
              >
                <div className="text-white text-xs font-bold p-2">
                  {isDragValid ? 'New Booking' : 'Conflict'}
                </div>
              </div>
            )}

            {/* Selection */}
            {selectionStyle && (
              <div
                className="absolute left-0 right-0 z-20 rounded bg-indigo-50 border-2 border-indigo-400 border-dashed pointer-events-none animate-pulse"
                style={{ ...selectionStyle, left: '8px', right: '8px' }}
              >
                <div className="text-indigo-600 text-xs font-bold p-2">Selected</div>
              </div>
            )}

            {/* Bookings */}
            {dayBookings.map((b) => {
              const style = getPositionStyle(new Date(b.startTime), new Date(b.endTime));
              const isOwner = b.userId === currentUser.id;
              const isAdmin = currentUser.role === UserRole.ADMIN;
              const canView = isOwner || isAdmin;

              return (
                <div
                  key={b.id}
                  className={`absolute rounded px-2 py-1 text-xs border-l-4 overflow-hidden shadow-sm z-20 transition-all hover:z-30 hover:shadow-md
                    ${
                      canView
                        ? 'bg-indigo-100 border-primary text-primary cursor-pointer'
                        : 'bg-slate-200 border-slate-400 text-slate-500 cursor-default'
                    }
                  `}
                  style={{ ...style, left: '8px', right: '8px' }}
                  title={`${canView ? b.userDisplay : 'Reserved'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canView) onBookingClick(b);
                  }}
                >
                  <div className="font-bold truncate">{canView ? b.userDisplay : 'Reserved'}</div>
                  <div className="truncate opacity-75">
                    {new Date(b.startTime).getHours()}:
                    {new Date(b.startTime).getMinutes().toString().padStart(2, '0')} -{' '}
                    {new Date(b.endTime).getHours()}:
                    {new Date(b.endTime).getMinutes().toString().padStart(2, '0')}
                  </div>
                  {b.purpose && <div className="truncate text-[10px] mt-1">{b.purpose}</div>}
                </div>
              );
            })}

            {/* Library Closed Overlay */}
            {closedStyle && (
              <div
                className="absolute left-0 right-0 z-40 bg-slate-100/90 pointer-events-none flex items-center justify-center"
                style={{ ...closedStyle, left: '8px', right: '8px' }}
              >
                <div className="text-slate-400 text-sm font-semibold p-2 flex items-center gap-2 bg-white/50 rounded px-3 py-1.5 shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {closedLabel}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayView;
