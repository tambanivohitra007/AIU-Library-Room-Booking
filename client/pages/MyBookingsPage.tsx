import React from 'react';
import { User, Room, Booking } from '../types';
import { TrashIcon } from '../components/Icons';

interface MyBookingsPageProps {
  user: User;
  rooms: Room[];
  bookings: Booking[];
  onCancelBooking: (id: string) => void;
}

const MyBookingsPage: React.FC<MyBookingsPageProps> = ({ user, rooms, bookings, onCancelBooking }) => {
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
          {myBookings.map(b => {
            const hasEnded = new Date(b.endTime) <= new Date();
            const canCancel = b.status === 'CONFIRMED' && !hasEnded;

            return (
              <div key={b.id} className="p-4 border-b last:border-0 flex justify-between items-center hover:bg-slate-50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-slate-800">
                      {rooms.find(r => r.id === b.roomId)?.name}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      b.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                      b.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500">
                    {new Date(b.startTime).toLocaleString()}
                  </div>
                  {b.purpose && <div className="text-xs text-slate-400 mt-1 italic">"{b.purpose}"</div>}
                </div>
                {canCancel ? (
                  <button
                    onClick={() => onCancelBooking(b.id)}
                    className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                    title="Cancel Booking"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                ) : (
                  <div className="text-xs text-slate-400 px-2">
                    {hasEnded ? 'Ended' : b.status === 'CANCELLED' ? 'Cancelled' : 'Completed'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyBookingsPage;
