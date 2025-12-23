import React, { useMemo } from 'react';
import { Booking, Room, User, UserRole } from '../types';

interface MonthViewProps {
  selectedDate: Date;
  bookings: Booking[];
  room: Room;
  currentUser: User;
  onDateSelect: (date: Date) => void;
  onBookingClick: (booking: Booking) => void;
}

const MonthView: React.FC<MonthViewProps> = ({
  selectedDate,
  bookings,
  room,
  currentUser,
  onDateSelect,
  onBookingClick,
}) => {
  const currentMonth = selectedDate.getMonth();
  const currentYear = selectedDate.getFullYear();

  const daysInMonth = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysArray: (Date | null)[] = [];

    // Add empty cells for days before month starts
    const firstDayOfWeek = firstDay.getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
      daysArray.push(null);
    }

    // Add all days in month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      daysArray.push(new Date(currentYear, currentMonth, day));
    }

    return daysArray;
  }, [currentMonth, currentYear]);

  const getBookingsForDate = (date: Date | null) => {
    if (!date) return [];
    return bookings.filter((b) => {
      const bDate = new Date(b.startTime);
      return (
        b.roomId === room.id &&
        bDate.getDate() === date.getDate() &&
        bDate.getMonth() === date.getMonth() &&
        bDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date | null) => {
    if (!date) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
          <div key={day} className="text-center py-2 sm:py-3 text-xs sm:text-sm font-semibold text-slate-600 border-r last:border-r-0 border-slate-200">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{['S', 'M', 'T', 'W', 'T', 'F', 'S'][i]}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr border-l border-slate-200 overflow-y-auto">
        {daysInMonth.map((date, i) => {
          const dayBookings = getBookingsForDate(date);
          const hasBookings = dayBookings.length > 0;

          return (
            <div
              key={i}
              className={`border-r border-b border-slate-200 p-1 sm:p-2 min-h-[80px] sm:min-h-[100px] ${
                !date ? 'bg-slate-50' : ''
              } ${isToday(date) ? 'bg-indigo-50/30' : ''} ${
                isSelected(date) ? 'bg-indigo-100/50 ring-2 ring-inset ring-primary' : ''
              }`}
            >
              {date && (
                <>
                  {/* Date number */}
                  <div
                    onClick={() => onDateSelect(date)}
                    className={`text-xs sm:text-sm font-semibold mb-1 sm:mb-2 cursor-pointer inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full transition-colors touch-manipulation ${
                      isToday(date)
                        ? 'bg-primary text-white'
                        : isSelected(date)
                        ? 'bg-indigo-200 text-primary'
                        : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                    }`}
                  >
                    {date.getDate()}
                  </div>

                  {/* Bookings */}
                  <div className="space-y-0.5 sm:space-y-1">
                    {dayBookings.slice(0, 2).map((booking) => {
                      const isOwner = booking.userId === currentUser.id;
                      const isAdmin = currentUser.role === UserRole.ADMIN;
                      const canView = isOwner || isAdmin;
                      const startTime = new Date(booking.startTime);

                      return (
                        <div
                          key={booking.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canView) onBookingClick(booking);
                          }}
                          className={`text-[10px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded cursor-pointer truncate border-l-2 transition-all touch-manipulation ${
                            canView
                              ? 'bg-indigo-100 border-primary text-primary hover:bg-indigo-200 active:bg-indigo-300'
                              : 'bg-slate-100 border-slate-400 text-slate-600'
                          }`}
                          title={`${startTime.getHours()}:${startTime
                            .getMinutes()
                            .toString()
                            .padStart(2, '0')} - ${canView ? booking.userDisplay : 'Reserved'}`}
                        >
                          <span className="font-semibold">
                            {startTime.getHours()}:{startTime.getMinutes().toString().padStart(2, '0')}
                          </span>
                          <span className="hidden sm:inline">
                            {' '}{canView ? booking.userDisplay : 'Reserved'}
                          </span>
                        </div>
                      );
                    })}
                    {dayBookings.length > 2 && (
                      <div
                        className="text-[10px] sm:text-xs text-slate-500 pl-1 sm:pl-2 cursor-pointer hover:text-primary touch-manipulation"
                        onClick={() => onDateSelect(date)}
                      >
                        +{dayBookings.length - 2} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthView;
