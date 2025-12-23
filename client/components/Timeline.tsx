import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Booking, Room, User, UserRole } from '../types';
import { OPENING_HOUR, CLOSING_HOUR } from '../constants';

interface TimelineProps {
  weekStart: Date;
  bookings: Booking[];
  room: Room;
  currentUser: User;
  onRangeSelect: (start: Date, end: Date) => void;
  onBookingClick: (booking: Booking) => void;
  selectedRange?: { start: Date; end: Date } | null;
}

const Timeline: React.FC<TimelineProps> = ({ weekStart, bookings, room, currentUser, onRangeSelect, onBookingClick, selectedRange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ dayIndex: number; minutes: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ dayIndex: number; minutes: number } | null>(null);

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
    for (let i = OPENING_HOUR; i < CLOSING_HOUR; i++) h.push(i);
    return h;
  }, []);

  // Filter bookings for this week AND this room (only show CONFIRMED bookings)
  const weekBookings = useMemo(() => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return bookings.filter(b => {
      const bDate = new Date(b.startTime);
      // Only show CONFIRMED bookings - hide COMPLETED and CANCELLED
      return b.roomId === room.id &&
             bDate >= weekStart &&
             bDate < weekEnd &&
             b.status === 'CONFIRMED';
    });
  }, [bookings, weekStart, room.id]);

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

  // Check if a range overlaps with existing bookings OR library closure
  const checkOverlap = (start: Date, end: Date) => {
    // Check if time falls during library closure
    if (isLibraryClosed(start) || isLibraryClosed(end)) {
      return true;
    }

    // Check for booking conflicts
    return weekBookings.some(b => {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return start < bEnd && end > bStart;
    });
  };

  // Drag Handlers
  const handleMouseDown = (dayIndex: number, minutes: number, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    // Check if clicking on an existing event (approximated by checking if slot is occupied)
    const slotTime = new Date(days[dayIndex]);
    slotTime.setHours(OPENING_HOUR + Math.floor(minutes / 60), minutes % 60, 0, 0);
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
        startTime.setHours(OPENING_HOUR, startMin, 0, 0);
        
        const endTime = new Date(date);
        endTime.setHours(OPENING_HOUR, endMin, 0, 0);

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

  const isToday = (d: Date) => {
    const now = new Date();
    return d.getDate() === now.getDate() && 
           d.getMonth() === now.getMonth() && 
           d.getFullYear() === now.getFullYear();
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
    <div className="flex flex-col h-full select-none">
      {/* Header Row: Days */}
      <div className="flex border-b border-slate-200">
        <div className="w-12 sm:w-14 shrink-0 bg-white border-r border-slate-100"></div> {/* Time Label Spacer */}
        <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100">
          {days.map((day, i) => {
             const today = isToday(day);
             return (
              <div key={i} className={`text-center py-2 sm:py-3 ${today ? 'bg-indigo-50/50' : 'bg-white'}`}>
                <div className={`text-[10px] sm:text-xs font-semibold uppercase mb-0.5 sm:mb-1 ${today ? 'text-primary' : 'text-slate-500'}`}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-base sm:text-xl font-light ${today ? 'text-primary font-normal bg-indigo-100 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mx-auto text-sm sm:text-xl' : 'text-slate-700'}`}>
                  {day.getDate()}
                </div>
              </div>
             )
          })}
        </div>
      </div>

      {/* Scrollable Grid Body */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="flex relative min-h-[600px] h-full">
          
          {/* Time Sidebar */}
          <div className="w-12 sm:w-14 shrink-0 bg-white border-r border-slate-100 text-[10px] sm:text-xs text-slate-400 font-mono flex flex-col relative z-20 pt-2">
             {hours.map((h, idx) => (
               <div key={h} className="flex-1 border-b border-transparent relative">
                 <span className={`absolute right-1 sm:right-2 ${idx === 0 ? 'top-0' : '-top-2.5'}`}>{h}:00</span>
               </div>
             ))}
          </div>

          {/* Main Grid Columns */}
          <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100 relative">
             {/* Horizontal Hour Lines (Background) */}
             <div className="absolute inset-0 z-0 flex flex-col pointer-events-none">
                {hours.map(h => (
                  <div key={h} className="flex-1 border-b border-slate-100/60"></div>
                ))}
             </div>

             {/* Day Columns */}
             {days.map((day, dayIndex) => {
               const today = isToday(day);
               // Filter events for this specific day
               const dayEvents = weekBookings.filter(b => {
                 const d = new Date(b.startTime);
                 return d.getDate() === day.getDate();
               });

               // Is this column being dragged?
               const isDragColumn = isDragging && dragStart?.dayIndex === dayIndex;
               let dragStyle = {};
               let isDragValid = true;

               if (isDragColumn && dragStart && dragCurrent) {
                    const startMin = Math.min(dragStart.minutes, dragCurrent.minutes - 15);
                    const endMin = Math.max(dragStart.minutes, dragCurrent.minutes - 15) + 15;
                    
                    const s = new Date(day); s.setHours(OPENING_HOUR, startMin, 0, 0);
                    const e = new Date(day); e.setHours(OPENING_HOUR, endMin, 0, 0);
                    
                    dragStyle = getPositionStyle(s, e);
                    isDragValid = !checkOverlap(s, e);
               }

               // Check if this day is the Selected Range (persisted)
               let selectionStyle = null;
               if (!isDragging && selectedRange) {
                   const s = selectedRange.start;
                   const e = selectedRange.end;
                   if (s.getDate() === day.getDate() &&
                       s.getMonth() === day.getMonth() &&
                       s.getFullYear() === day.getFullYear()) {
                       selectionStyle = getPositionStyle(s, e);
                   }
               }

               // Calculate closed hours overlay
               const dayOfWeek = day.getDay();
               let closedStyle = null;
               let closedLabel = '';

               if (dayOfWeek === 6) {
                   // Saturday - all day closed
                   closedStyle = { top: '0%', height: '100%' };
                   closedLabel = 'Library Closed';
               } else if (dayOfWeek === 5) {
                   // Friday - closed from 5 PM (17:00) onwards
                   const closedStart = new Date(day);
                   closedStart.setHours(17, 0, 0, 0);
                   const closedEnd = new Date(day);
                   closedEnd.setHours(CLOSING_HOUR, 0, 0, 0);
                   closedStyle = getPositionStyle(closedStart, closedEnd);
                   closedLabel = 'Closed';
               } else if (dayOfWeek === 0) {
                   // Sunday - closed until opening hour
                   const closedStart = new Date(day);
                   closedStart.setHours(OPENING_HOUR, 0, 0, 0);
                   const closedEnd = new Date(day);
                   closedEnd.setHours(OPENING_HOUR, 0, 0, 0);
                   closedStyle = getPositionStyle(closedStart, closedEnd);
                   closedLabel = 'Closed';
               }

               return (
                 <div key={dayIndex} className={`relative h-full group ${today ? 'bg-indigo-50/20' : ''}`}>
                    {/* Time Slots (Interactivity) */}
                    {hours.map((h, hIndex) => (
                        <div key={h} style={{ height: `${100 / hours.length}%` }} className="flex flex-col">
                            {/* 4 slots per hour for 15 min granularity */}
                            {[0, 15, 30, 45].map(m => (
                                <div
                                    key={m}
                                    className="flex-1 z-10 hover:bg-black/5 cursor-crosshair"
                                    onMouseDown={(e) => handleMouseDown(dayIndex, (hIndex * 60) + m, e)}
                                    onMouseEnter={() => handleMouseEnter(dayIndex, (hIndex * 60) + m)}
                                />
                            ))}
                        </div>
                    ))}

                    {/* Drag Preview */}
                    {isDragColumn && (
                        <div 
                            className={`absolute left-0 right-0 z-30 rounded opacity-70 pointer-events-none transition-all ${isDragValid ? 'bg-primary/80 border-2 border-primary' : 'bg-red-500/50 border-2 border-red-600'}`}
                            style={{ ...dragStyle, left: '4px', right: '4px' }}
                        >
                            <div className="text-white text-xs font-bold p-1">
                                {isDragValid ? 'New Booking' : 'Conflict'}
                            </div>
                        </div>
                    )}

                    {/* Persisted Selection Block */}
                    {selectionStyle && (
                        <div 
                            className="absolute left-0 right-0 z-20 rounded bg-indigo-50 border-2 border-indigo-400 border-dashed pointer-events-none animate-pulse"
                            style={{ ...selectionStyle, left: '4px', right: '4px' }}
                        >
                             <div className="text-indigo-600 text-xs font-bold p-1">
                                Selected
                            </div>
                        </div>
                    )}

                    {/* Existing Events */}
                    {dayEvents.map(b => {
                        const style = getPositionStyle(new Date(b.startTime), new Date(b.endTime));
                        const isOwner = b.userId === currentUser.id;
                        const isAdmin = currentUser.role === UserRole.ADMIN;
                        const canView = isOwner || isAdmin;

                        return (
                          <div
                            key={b.id}
                            className={`absolute rounded px-1.5 py-0.5 text-[10px] leading-tight border-l-4 overflow-hidden shadow-sm z-20 transition-all hover:z-30 hover:shadow-md
                              ${canView ? 'bg-indigo-100 border-primary text-primary cursor-pointer' : 'bg-slate-200 border-slate-400 text-slate-500 cursor-default'}
                            `}
                            style={{ ...style, left: '2px', right: '2px' }}
                            title={`${canView ? b.userDisplay : 'Reserved'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (canView) onBookingClick(b);
                            }}
                          >
                            <div className="font-bold truncate">{canView ? b.userDisplay : 'Reserved'}</div>
                            <div className="truncate opacity-75">{new Date(b.startTime).getHours()}:{new Date(b.startTime).getMinutes().toString().padStart(2,'0')} - {new Date(b.endTime).getHours()}:{new Date(b.endTime).getMinutes().toString().padStart(2,'0')}</div>
                          </div>
                        )
                    })}

                    {/* Library Closed Overlay */}
                    {closedStyle && (
                        <div
                            className="absolute left-0 right-0 z-40 bg-slate-700/80 pointer-events-none flex items-center justify-center"
                            style={{ ...closedStyle, left: '2px', right: '2px' }}
                        >
                            <div className="text-white text-xs font-bold p-1 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                {closedLabel}
                            </div>
                        </div>
                    )}
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