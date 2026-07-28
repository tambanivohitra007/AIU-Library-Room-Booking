import React from 'react';
import { useTranslation } from 'react-i18next';
import { dateLocale } from '../i18n';
import { Booking, User, UserRole, Room } from '../types';
import { ClockIcon, UsersIcon, UserCircleIcon, TrashIcon } from './Icons';

interface BookingDetailsProps {
  booking: Booking;
  room: Room;
  currentUser: User;
  onCancelBooking: (id: string) => void;
  onClose: () => void;
}

const BookingDetails: React.FC<BookingDetailsProps> = ({
  booking,
  room,
  currentUser,
  onCancelBooking,
  onClose,
}) => {
  const { t } = useTranslation();
  const isOwner = currentUser.id === booking.userId;
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const canCancel = isOwner || isAdmin;

  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const duration = (end.getTime() - start.getTime()) / 60000;

  // Check if booking has already ended
  const now = new Date();
  const hasEnded = end <= now;
  const canCancelBooking =
    canCancel && booking.status === 'CONFIRMED' && !hasEnded;

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200 ">
      {/* Header */}
      <div className="bg-slate-800 text-white p-4 flex justify-between items-start">
        <div>
          <h3 className="font-bold text-lg">{t('bookingDetails.title')}</h3>
          <p className="text-slate-300 text-sm">{room.name}</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-2xl leading-none"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Status Badge */}
        <div
          className={`inline-block px-2 py-1 rounded text-xs font-bold ${booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
        >
          {t(`status.${booking.status}`)}
        </div>

        {/* Time */}
        <div className="flex gap-3">
          <ClockIcon className="w-5 h-5 text-slate-400" />
          <div>
            <div className="text-sm font-semibold text-slate-800">
              {start.toLocaleDateString(dateLocale(), {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </div>
            <div className="text-lg text-slate-900">
              {start.getHours()}:
              {start.getMinutes().toString().padStart(2, '0')} -{' '}
              {end.getHours()}:{end.getMinutes().toString().padStart(2, '0')}
            </div>
            <div className="text-sm text-slate-500">
              {t('bookingDetails.duration', { hours: duration / 60 })}
            </div>
          </div>
        </div>

        {/* User */}
        <div className="flex gap-3">
          <UserCircleIcon className="w-5 h-5 text-slate-400" />
          <div>
            <div className="text-sm text-slate-500">
              {t('bookingDetails.bookedBy')}
            </div>
            <div className="font-medium text-slate-900">
              {booking.userDisplay}
            </div>
          </div>
        </div>

        {/* Purpose */}
        {booking.purpose && (
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-700 italic">
            "{booking.purpose}"
          </div>
        )}

        {/* Attendees */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <UsersIcon className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">
              {t('bookingDetails.attendees', {
                total: booking.attendees.length,
              })}
            </span>
          </div>
          <ul className="text-sm text-slate-600 space-y-1 pl-6 list-disc">
            {booking.attendees.map((a, i) => (
              <li key={i}>{a.name}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Actions */}
      {canCancel && (
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          {canCancelBooking ? (
            <button
              onClick={() => onCancelBooking(booking.id)}
              className="w-full flex justify-center items-center gap-2 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
              {t('bookingDetails.releaseBooking')}
            </button>
          ) : hasEnded ? (
            <div className="text-center py-2 text-sm text-slate-500">
              {t('bookingDetails.endedNoCancel')}
            </div>
          ) : booking.status !== 'CONFIRMED' ? (
            <div className="text-center py-2 text-sm text-slate-500">
              {t('bookingDetails.alreadyStatus', {
                status: t(`status.${booking.status}`).toLocaleLowerCase(),
              })}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
export default BookingDetails;
