import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Booking, Room, User, UserRole, isGlobalAdminRole } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import {
  getGridBounds,
  getClosedRanges,
  isRangeClosed,
  getEffectiveOperatingHours,
} from '../utils/operatingHours';

interface TimelineProps {
  weekStart: Date;
  bookings: Booking[];
  room: Room;
  currentUser: User;
  onRangeSelect: (start: Date, end: Date) => void;
  onBookingClick: (booking: Booking) => void;
  selectedRange?: { start: Date; end: Date } | null;
}

const Timeline: React.FC<TimelineProps> = ({
  weekStart,
  bookings,
  room,
  currentUser,
  onRangeSelect,
  onBookingClick,
  selectedRange,
}) => {
  const { operatingHours: globalHours } = useSettings();
  const operatingHours = useMemo(
    () => getEffectiveOperatingHours(room.department, globalHours),
    [room.department, globalHours],
  );
  const { open: gridOpen, close: gridClose } = useMemo(
    () => getGridBounds(operatingHours),
    [operatingHours],
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{
    dayIndex: number;
    minutes: number;
  } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{
    dayIndex: number;
    minutes: number;
  } | null>(null);

  // Generate 7 days from weekStart
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const hours = useMemo(() => {
    const h = [];
    for (let i = gridOpen; i < gridClose; i++) h.push(i);
    return h;
  }, [gridOpen, gridClose]);

  // Filter bookings for this week AND this room (only show CONFIRMED bookings)
  const weekBookings = useMemo(() => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return bookings.filter((b) => {
      const bDate = new Date(b.startTime);
      // Show CONFIRMED and PENDING (slot-holding) bookings - hide COMPLETED and CANCELLED
      return (
        b.roomId === room.id &&
        bDate >= weekStart &&
        bDate < weekEnd &&
        (b.status === 'CONFIRMED' || b.status === 'PENDING')
      );
    });
  }, [bookings, weekStart, room.id]);

  // Check if a range overlaps with existing bookings OR closed hours
  const checkOverlap = (start: Date, end: Date) => {
    // Check if time falls outside configured operating hours
    if (isRangeClosed(start, end, operatingHours)) {
      return true;
    }

    // Check for booking conflicts
    return weekBookings.some((b) => {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return start < bEnd && end > bStart;
    });
  };

  // Drag Handlers
  const handleMouseDown = (
    dayIndex: number,
    minutes: number,
    e: React.MouseEvent,
  ) => {
    if (e.button !== 0) return; // Only left click
    // Check if clicking on an existing event (approximated by checking if slot is occupied)
    const slotTime = new Date(days[dayIndex]);
    slotTime.setHours(gridOpen + Math.floor(minutes / 60), minutes % 60, 0, 0);
    // Slight buffer for check
    const slotEnd = new Date(slotTime);
    slotEnd.setMinutes(slotEnd.getMinutes() + 15);

    if (checkOverlap(slotTime, slotEnd)) return;

    setIsDragging(true);
    setDragStart({ dayIndex, minutes });
    setDragCurrent({ dayIndex, minutes: minutes + 15 });
  };

  const handleMouseEnter = (dayIndex: number, minutes: number) => {
    if (!isDragging || !dragStart) return;

    // Constrain to same day
    if (dayIndex !== dragStart.dayIndex) return;

    setDragCurrent({ dayIndex, minutes: minutes + 15 }); // Snap to end of slot
  };

  const handleMouseUp = () => {
    if (isDragging && dragStart && dragCurrent) {
      const startMin = Math.min(dragStart.minutes, dragCurrent.minutes - 15); // Adjust back because current is end of slot
      const endMin = Math.max(dragStart.minutes, dragCurrent.minutes - 15) + 15;

      // Construct Date objects
      const date = days[dragStart.dayIndex];
      const startTime = new Date(date);
      startTime.setHours(gridOpen, startMin, 0, 0);

      const endTime = new Date(date);
      endTime.setHours(gridOpen, endMin, 0, 0);

      // Validate overlap
      if (!checkOverlap(startTime, endTime)) {
        onRangeSelect(startTime, endTime);
      }
    }
    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  // Helper to calculate CSS Position
  const getPositionStyle = (start: Date, end: Date) => {
    const startMinutes =
      (start.getHours() - gridOpen) * 60 + start.getMinutes();
    const durationMinutes = (end.getTime() - start.getTime()) / 60000;
    const totalDayMinutes = (gridClose - gridOpen) * 60;

    const topPercent = (startMinutes / totalDayMinutes) * 100;
    const heightPercent = (durationMinutes / totalDayMinutes) * 100;

    return {
      top: `${topPercent}%`,
      height: `${heightPercent}%`,
    };
  };

  const isToday = (d: Date) => {
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  // Global mouse up to catch drags releasing outside grid
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) handleMouseUp();
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, dragStart, dragCurrent]);

  return (
    <div className="flex-1 overflow-auto relative custom-scrollbar select-none">
      <div className="min-w-[700px] min-h-[500px] h-full flex flex-col relative">
        {/* Header Row: Days */}
        <div className="flex border-b border-slate-200 glass sticky top-0 z-40 ">
          <div className="w-14 sm:w-16 shrink-0 glass-dark border-r border-white/10 sticky left-0 z-50"></div>{' '}
          {/* Time Label Spacer */}
          <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100">
            {days.map((day, i) => {
              const today = isToday(day);
              return (
                <div
                  key={i}
                  className={`text-center py-3 sm:py-4 transition-colors ${today ? 'bg-primary/10' : 'glass'}`}
                >
                  <div
                    className={`text-[11px] sm:text-xs font-bold uppercase tracking-wide mb-1 ${today ? 'text-primary' : 'text-slate-600'}`}
                  >
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div
                    className={`text-sm sm:text-lg font-semibold ${today ? 'text-white bg-primary w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mx-auto' : 'text-slate-800'}`}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Grid Body */}
        <div className="flex relative flex-1">
          {/* Time Sidebar */}
          <div className="w-14 sm:w-16 shrink-0 glass-dark border-r border-white/10 text-[11px] sm:text-xs text-blue-200 font-bold flex flex-col relative z-30 pt-2 sticky left-0">
            {hours.map((h, idx) => (
              <div
                key={h}
                className="flex-1 border-b border-transparent relative"
              >
                <span
                  className={`absolute right-2 sm:right-3 ${idx === 0 ? 'top-0' : '-top-2.5'} text-white px-1.5 py-0.5 rounded text-[10px] sm:text-xs `}
                >
                  {h}:00
                </span>
              </div>
            ))}
          </div>

          {/* Main Grid Columns */}
          <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100 relative">
            {/* Horizontal Hour Lines (Background) */}
            <div className="absolute inset-0 z-0 flex flex-col pointer-events-none">
              {hours.map((h) => (
                <div
                  key={h}
                  className="flex-1 border-b border-slate-100/60"
                ></div>
              ))}
            </div>

            {/* Day Columns */}
            {days.map((day, dayIndex) => {
              const today = isToday(day);
              // Filter events for this specific day
              const dayEvents = weekBookings.filter((b) => {
                const d = new Date(b.startTime);
                return d.getDate() === day.getDate();
              });

              // Is this column being dragged?
              const isDragColumn =
                isDragging && dragStart?.dayIndex === dayIndex;
              let dragStyle = {};
              let isDragValid = true;

              if (isDragColumn && dragStart && dragCurrent) {
                const startMin = Math.min(
                  dragStart.minutes,
                  dragCurrent.minutes - 15,
                );
                const endMin =
                  Math.max(dragStart.minutes, dragCurrent.minutes - 15) + 15;

                const s = new Date(day);
                s.setHours(gridOpen, startMin, 0, 0);
                const e = new Date(day);
                e.setHours(gridOpen, endMin, 0, 0);

                dragStyle = getPositionStyle(s, e);
                isDragValid = !checkOverlap(s, e);
              }

              // Check if this day is the Selected Range (persisted)
              let selectionStyle = null;
              if (!isDragging && selectedRange) {
                const s = selectedRange.start;
                const e = selectedRange.end;
                if (
                  s.getDate() === day.getDate() &&
                  s.getMonth() === day.getMonth() &&
                  s.getFullYear() === day.getFullYear()
                ) {
                  selectionStyle = getPositionStyle(s, e);
                }
              }

              // Calculate closed hours overlays from configured operating hours
              const totalGridMinutes = (gridClose - gridOpen) * 60;
              const closedOverlays = getClosedRanges(
                day,
                operatingHours,
                gridOpen,
                gridClose,
              ).map((r) => ({
                top: `${(((r.startHour - gridOpen) * 60) / totalGridMinutes) * 100}%`,
                height: `${(((r.endHour - r.startHour) * 60) / totalGridMinutes) * 100}%`,
              }));

              return (
                <div
                  key={dayIndex}
                  className={`relative h-full group ${today ? 'bg-indigo-50/20' : ''}`}
                >
                  {/* Time Slots (Interactivity) */}
                  {hours.map((h, hIndex) => (
                    <div
                      key={h}
                      style={{ height: `${100 / hours.length}%` }}
                      className="flex flex-col"
                    >
                      {/* 4 slots per hour for 15 min granularity */}
                      {[0, 15, 30, 45].map((m) => (
                        <div
                          key={m}
                          className="flex-1 z-10 hover:bg-primary/5 active:bg-primary/10 cursor-crosshair touch-none transition-colors"
                          onMouseDown={(e) =>
                            handleMouseDown(dayIndex, hIndex * 60 + m, e)
                          }
                          onMouseEnter={() =>
                            handleMouseEnter(dayIndex, hIndex * 60 + m)
                          }
                          onTouchStart={(e) => {
                            handleMouseDown(dayIndex, hIndex * 60 + m, {
                              button: 0,
                            } as any);
                          }}
                        />
                      ))}
                    </div>
                  ))}

                  {/* Drag Preview */}
                  {isDragColumn && (
                    <div
                      className={`absolute left-0 right-0 z-30 rounded-md pointer-events-none transition-all ${isDragValid ? 'bg-primary border-2 border-accent' : 'bg-red-500 border-2 border-red-700'}`}
                      style={{ ...dragStyle, left: '6px', right: '6px' }}
                    >
                      <div className="text-white text-xs sm:text-sm font-bold p-2 flex items-center gap-2">
                        {isDragValid ? (
                          <>
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
                            New Booking
                          </>
                        ) : (
                          <>
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
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                            Conflict
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Persisted Selection Block */}
                  {selectionStyle && (
                    <div
                      className="absolute left-0 right-0 z-20 rounded-md glass border-2 border-accent border-dashed pointer-events-none animate-pulse-slow "
                      style={{ ...selectionStyle, left: '6px', right: '6px' }}
                    >
                      <div className="text-primary text-xs sm:text-sm font-bold p-2 flex items-center gap-2">
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Selected
                      </div>
                    </div>
                  )}

                  {/* Existing Events */}
                  {dayEvents.map((b) => {
                    const style = getPositionStyle(
                      new Date(b.startTime),
                      new Date(b.endTime),
                    );
                    const isOwner = b.userId === currentUser.id;
                    const canViewAll =
                      isGlobalAdminRole(currentUser.role) ||
                      currentUser.role === UserRole.STUDENT_WORKER ||
                      (!!room.departmentId &&
                        (currentUser.managedDepartmentIds || []).includes(
                          room.departmentId,
                        ));
                    const canView = isOwner || canViewAll;
                    const isPending = b.status === 'PENDING';

                    return (
                      <div
                        key={b.id}
                        className={`absolute rounded-md px-2 py-1.5 text-[10px] sm:text-xs leading-tight border-l-4 overflow-hidden z-20 transition-all hover:z-30  
                              ${
                                isPending
                                  ? canView
                                    ? 'bg-amber-50 border-amber-400 text-amber-700 cursor-pointer'
                                    : 'bg-amber-50/80 border-amber-300 text-amber-600 cursor-default'
                                  : canView
                                    ? 'bg-indigo-50 border-primary text-primary cursor-pointer'
                                    : 'glass border-slate-400 text-slate-600 cursor-default'
                              }
                            `}
                        style={{ ...style, left: '4px', right: '4px' }}
                        title={`${canView ? b.userDisplay : 'Reserved'}${isPending ? ' (pending approval)' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canView) onBookingClick(b);
                        }}
                        onTouchEnd={(e) => {
                          e.stopPropagation();
                          if (canView) onBookingClick(b);
                        }}
                      >
                        <div className="font-bold truncate text-[11px] sm:text-sm">
                          {canView ? b.userDisplay : 'Reserved'}
                        </div>
                        <div className="truncate opacity-80 font-medium text-[10px] sm:text-xs">
                          {new Date(b.startTime).getHours()}:
                          {new Date(b.startTime)
                            .getMinutes()
                            .toString()
                            .padStart(2, '0')}{' '}
                          - {new Date(b.endTime).getHours()}:
                          {new Date(b.endTime)
                            .getMinutes()
                            .toString()
                            .padStart(2, '0')}
                        </div>
                        {isPending && (
                          <div className="text-[9px] font-bold uppercase tracking-wide opacity-90">
                            Pending
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Closed Hours Overlays */}
                  {closedOverlays.map((overlayStyle, oIndex) => (
                    <div
                      key={oIndex}
                      className="absolute left-0 right-0 z-40 bg-slate-100/90 pointer-events-none flex items-center justify-center rounded"
                      style={{ ...overlayStyle, left: '4px', right: '4px' }}
                    >
                      <div className="text-slate-400 text-[10px] sm:text-xs font-semibold p-2 flex items-center gap-1 flex-col sm:flex-row shadow-sm bg-white/50 rounded px-2 py-1">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                        <span>Closed</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
