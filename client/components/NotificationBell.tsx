import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { dateLocale } from '../i18n';
import { Booking, Room, User } from '../types';
import {
  buildNotifications,
  canModerateAnything,
  countNew,
  getLastSeenAt,
  markSeen,
} from '../utils/notifications';

interface NotificationBellProps {
  user: User;
  rooms: Room[];
  bookings: Booking[];
}

const NotificationBell: React.FC<NotificationBellProps> = ({
  user,
  rooms,
  bookings,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState(getLastSeenAt);

  const notifications = useMemo(
    () => buildNotifications(user, rooms, bookings),
    [user, rooms, bookings],
  );

  // Nothing to moderate means no bell at all, rather than a control that can
  // only ever be empty.
  if (!canModerateAnything(user, rooms)) return null;

  const newCount = countNew(notifications, lastSeenAt);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // Reading the list clears the "new" marks, but NOT the badge - the badge
      // counts outstanding work, so it stays until the work is actually done.
      markSeen();
      setLastSeenAt(Date.now());
    }
  };

  const openBooking = (bookingId: string) => {
    setOpen(false);
    navigate(`/admin?tab=bookings&status=PENDING&focus=${bookingId}`);
  };

  const formatWhen = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString(dateLocale(), {
      month: 'short',
      day: 'numeric',
    })} · ${d.toLocaleTimeString(dateLocale(), {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="relative bg-white/10 hover:bg-white/20 rounded-md p-2 transition-all-smooth"
        aria-label={t('notifications.aria', { count: notifications.length })}
        title={t('notifications.title')}
      >
        <svg
          className="w-5 h-5 sm:w-6 sm:h-6 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1h6z"
          />
        </svg>
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center border border-white/40">
            {notifications.length > 99 ? '99+' : notifications.length}
          </span>
        )}
        {newCount > 0 && (
          <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-amber-400 animate-ping" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 glass border border-slate-200 rounded-lg z-40 w-[min(92vw,360px)] animate-slide-down overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800">
                {t('notifications.title')}
              </p>
              {notifications.length > 0 && (
                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  {t('notifications.awaiting', {
                    count: notifications.length,
                  })}
                </span>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <svg
                  className="w-10 h-10 mx-auto mb-2 text-slate-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <p className="text-sm text-slate-500 font-semibold">
                  {t('notifications.empty')}
                </p>
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openBooking(n.bookingId)}
                    className="w-full text-left px-4 py-3 hover:bg-primary/5 transition-colors flex gap-3 items-start"
                  >
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                        n.urgent ? 'bg-red-500' : 'bg-amber-500'
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-800 truncate">
                        {n.roomName}
                      </span>
                      <span className="block text-xs text-slate-600 truncate">
                        {t('notifications.requestedBy', {
                          name: n.requestedBy,
                        })}
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        {formatWhen(n.startTime)}
                        {n.urgent && (
                          <span className="ml-2 font-bold text-red-600">
                            {t('notifications.urgent')}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {notifications.length > 0 && (
              <button
                onClick={() => {
                  setOpen(false);
                  navigate('/admin?tab=bookings&status=PENDING');
                }}
                className="w-full px-4 py-3 text-sm font-bold text-primary hover:bg-primary/5 border-t border-slate-200 transition-colors"
              >
                {t('notifications.viewAll')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
