import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Booking, Room, User, UserRole } from '../types';
import { OPENING_HOUR, CLOSING_HOUR } from '../constants';

interface TimelineProps {
  weekStart: Date;
  bookings: Booking[];
  room: Room;
  currentUser: User;
  onRangeSelect: (start: Date, end: Date) => void;
}

const Timeline: React.FC<TimelineProps> = ({ weekStart, bookings, room, currentUser, onRangeSelect }) => {
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

  // Filter bookings for this week AND this room
  const weekBookings = useMemo(() => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    
    return bookings.filter(b => {
      const bDate = new Date(b.startTime);
      return b.roomId === room.id && bDate >= weekStart && bDate < weekEnd;
    });
  }, [bookings, weekStart, room.id]);

  // Check if a range overlaps with existing bookings
  const checkOverlap = (start: Date, end: Date) => {
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
        <div className="w-14 shrink-0 bg-white border-r border-slate-100"></div> {/* Time Label Spacer */}
        <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100">
          {days.map((day, i) => {
             const today = isToday(day);
             return (
              <div key={i} className={`text-center py-3 ${today ? 'bg-indigo-50/50' : 'bg-white'}`}>
                <div className={`text-xs font-semibold uppercase mb-1 ${today ? 'text-primary' : 'text-slate-500'}`}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-xl font-light ${today ? 'text-primary font-normal bg-indigo-100 w-8 h-8 rounded-full flex items-center justify-center mx-auto' : 'text-slate-700'}`}>
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
          <div className="w-14 shrink-0 bg-white border-r border-slate-100 text-xs text-slate-400 font-mono flex flex-col relative z-20">
             {hours.map(h => (
               <div key={h} className="flex-1 border-b border-transparent relative">
                 <span className="absolute -top-2.5 right-2">{h}:00</span>
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

               return (
                 <div key={dayIndex} className={`relative h-full group ${today ? 'bg-indigo-50/20' : ''}`}>
                    {/* Time Slots (Interactivity) */}
                    {hours.map((h, hIndex) => (
                        <div key={h} className="h-[calc(100%/12)] flex flex-col">
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
                              ${canView ? 'bg-indigo-100 border-primary text-primary' : 'bg-slate-200 border-slate-400 text-slate-500'}
                            `}
                            style={{ ...style, left: '2px', right: '2px' }}
                            title={`${canView ? b.userDisplay : 'Reserved'}`}
                          >
                            <div className="font-bold truncate">{canView ? b.userDisplay : 'Reserved'}</div>
                            <div className="truncate opacity-75">{new Date(b.startTime).getHours()}:{new Date(b.startTime).getMinutes().toString().padStart(2,'0')} - {new Date(b.endTime).getHours()}:{new Date(b.endTime).getMinutes().toString().padStart(2,'0')}</div>
                          </div>
                        )
                    })}
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