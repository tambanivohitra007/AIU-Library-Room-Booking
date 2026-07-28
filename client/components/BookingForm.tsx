import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation, Trans } from 'react-i18next';
import { dateLocale } from '../i18n';
import { Room, Attendee } from '../types';
import { api } from '../services/api';
import { UsersIcon, ClockIcon, AlertTriangleIcon, XIcon } from './Icons';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from './LoadingSpinner';

interface BookingFormProps {
  selectedRoom: Room;
  startTime: Date;
  endTime: Date;
  onSuccess: () => void;
  onCancel: () => void;
}

const BookingForm: React.FC<BookingFormProps> = ({
  selectedRoom,
  startTime: initialStartTime,
  endTime: initialEndTime,
  onSuccess,
  onCancel,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  // Local state for time selection (allows editing in form)
  const [bookingStart, setBookingStart] = useState(initialStartTime);
  const [bookingEnd, setBookingEnd] = useState(initialEndTime);

  const [purpose, setPurpose] = useState('');
  const [attendeeInput, setAttendeeInput] = useState('');
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictDetails, setConflictDetails] = useState<string | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync state if props change (e.g. user selects new slot on calendar while form is open)
  useEffect(() => {
    setBookingStart(initialStartTime);
    setBookingEnd(initialEndTime);
  }, [initialStartTime, initialEndTime]);

  useEffect(() => {
    // Reset form when times change
    setError(null);
    checkForConflicts();
  }, [bookingStart, bookingEnd]);

  const checkForConflicts = async () => {
    setCheckingConflict(true);
    setHasConflict(false);
    setConflictDetails(null);

    try {
      const result = await api.checkConflicts({
        roomId: selectedRoom.id,
        startTime: bookingStart,
        endTime: bookingEnd,
      });

      if (result.hasConflict && result.conflicts.length > 0) {
        const conflict = result.conflicts[0];
        const conflictStart = new Date(conflict.startTime);
        const conflictEnd = new Date(conflict.endTime);
        setHasConflict(true);
        setConflictDetails(
          t('booking.conflictsWith', {
            name: conflict.userDisplay,
            start: conflictStart.toLocaleTimeString(dateLocale(), {
              hour: '2-digit',
              minute: '2-digit',
            }),
            end: conflictEnd.toLocaleTimeString(dateLocale(), {
              hour: '2-digit',
              minute: '2-digit',
            }),
          }),
        );
      }
    } catch (err) {
      console.error('Error checking conflicts:', err);
    } finally {
      setCheckingConflict(false);
    }
  };

  // Helper to handle time changes
  const handleTimeChange = (type: 'start' | 'end', timeString: string) => {
    if (!timeString) return;

    const [hours, minutes] = timeString.split(':').map(Number);
    const newDate = new Date(type === 'start' ? bookingStart : bookingEnd);
    newDate.setHours(hours, minutes);

    if (type === 'start') {
      setBookingStart(newDate);
      // Auto-adjust end time if start crosses end
      if (newDate >= bookingEnd) {
        const newEnd = new Date(newDate);
        newEnd.setMinutes(newEnd.getMinutes() + 15); // Default 15 min duration
        setBookingEnd(newEnd);
      }
    } else {
      // Validate booking order
      if (newDate > bookingStart) {
        setBookingEnd(newDate);
      }
    }
  };

  // Parse attendees
  useEffect(() => {
    const rawLines = attendeeInput
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const unique = new Set(rawLines);
    setAttendeeCount(unique.size);
  }, [attendeeInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate booking is not in the past
    const now = new Date();
    if (bookingStart <= now) {
      setError(t('booking.pastStart'));
      return;
    }

    if (bookingEnd <= now) {
      setError(t('booking.pastEnd'));
      return;
    }

    if (bookingStart >= bookingEnd) {
      setError(t('booking.endAfterStart'));
      return;
    }

    const rawLines = attendeeInput
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const uniqueRaw = Array.from(new Set(rawLines));

    const minAttendees = selectedRoom.minCapacity;
    const maxAttendees = selectedRoom.maxCapacity;

    if (uniqueRaw.length + 1 < minAttendees) {
      setError(
        t('booking.minPeople', { min: minAttendees, others: minAttendees - 1 }),
      );
      return;
    }
    if (uniqueRaw.length + 1 > maxAttendees) {
      setError(t('booking.maxPeople', { max: maxAttendees }));
      return;
    }

    if (selectedRoom.bookingTerms && !termsAccepted) {
      setError(t('booking.termsRequired'));
      return;
    }

    const attendees: Attendee[] = uniqueRaw.map((name: string) => ({
      name: name,
      isCompanion: true,
    }));
    attendees.unshift({ name: 'Me (Booker)', isCompanion: false });

    setIsSubmitting(true);
    try {
      const booking = await api.createBooking({
        roomId: selectedRoom.id,
        startTime: bookingStart,
        endTime: bookingEnd,
        purpose,
        attendees,
        termsAccepted: selectedRoom.bookingTerms ? termsAccepted : undefined,
      });

      if (booking.status === 'PENDING') {
        toast.success(
          t('booking.requestSubmitted', { room: selectedRoom.name }),
        );
      } else {
        toast.success(t('booking.bookingConfirmed', { room: selectedRoom.name }));
      }
      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast.error(t('booking.createFailed', { message: errorMessage }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCountValid =
    attendeeCount + 1 >= selectedRoom.minCapacity &&
    attendeeCount + 1 <= selectedRoom.maxCapacity;
  const durationMinutes =
    (bookingEnd.getTime() - bookingStart.getTime()) / 60000;

  // Format time for input type="time"
  const formatTimeInput = (date: Date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formContent = (
    <div
      className={`flex flex-col bg-white  ${isMobile ? 'fixed inset-0 z-[100] animate-slide-up' : 'h-full border-l border-slate-200'}`}
    >
      <div className="bg-slate-800 text-white p-4 flex items-center justify-between shrink-0">
        <div>
          <h3 className="font-bold text-lg">{t('booking.title')}</h3>
          <p className="text-slate-300 text-sm">{selectedRoom.name}</p>
        </div>
        {isMobile && (
          <button
            onClick={onCancel}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <XIcon className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar"
      >
        {checkingConflict && (
          <div className="bg-primary/10 p-3 text-sm text-primary rounded border border-primary/20 flex items-center gap-2">
            <LoadingSpinner size="sm" color="primary" />
            {t('booking.checkingAvailability')}
          </div>
        )}

        {hasConflict && !checkingConflict && (
          <div className="bg-red-50 p-3 text-sm text-red-700 rounded border border-red-300">
            <div className="font-semibold mb-1 flex items-center gap-2">
              <AlertTriangleIcon className="w-4 h-4" />
              {t('booking.timeConflict')}
            </div>
            <div className="text-xs">{conflictDetails}</div>
            <div className="text-xs mt-2 text-red-600">
              {t('booking.selectDifferentTime')}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 p-2 text-xs text-red-600 rounded border border-red-200">
            {error}
          </div>
        )}

        {selectedRoom.requiresApproval && (
          <div className="bg-amber-50 p-3 text-xs text-amber-800 rounded border border-amber-200">
            <Trans
              i18nKey="booking.approvalNotice"
              components={{ 1: <strong /> }}
            />
          </div>
        )}

        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-indigo-100 pb-2">
            <ClockIcon className="w-5 h-5 text-primary" />
            <span>
              {bookingStart.toLocaleDateString(dateLocale(), {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                {t('booking.startTime')}
              </label>
              <input
                type="time"
                className="w-full p-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-primary"
                value={formatTimeInput(bookingStart)}
                onChange={(e) => handleTimeChange('start', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                {t('booking.endTime')}
              </label>
              <input
                type="time"
                className="w-full p-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-primary"
                value={formatTimeInput(bookingEnd)}
                onChange={(e) => handleTimeChange('end', e.target.value)}
                min={formatTimeInput(bookingStart)}
              />
            </div>
          </div>

          <div className="text-xs text-slate-500 text-right font-medium">
            {t('booking.duration', {
              hours: Math.floor(durationMinutes / 60),
              minutes: durationMinutes % 60,
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('booking.otherAttendees')}
          </label>
          <div className="relative">
            <textarea
              required
              rows={3}
              value={attendeeInput}
              onChange={(e) => setAttendeeInput(e.target.value)}
              placeholder={t('booking.enterNames')}
              className={`w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary ${!isCountValid && attendeeInput.length > 0 ? 'border-orange-300' : 'border-slate-300'}`}
            />
            <UsersIcon className="w-4 h-4 absolute right-2 top-2 text-slate-300" />
          </div>
          <div className="flex justify-between mt-1 text-xs">
            <span
              className={isCountValid ? 'text-green-600' : 'text-orange-500'}
            >
              {t('booking.count', { count: attendeeCount })}
            </span>
            <span className="text-slate-400">
              {t('booking.minMax', {
                min: selectedRoom.minCapacity,
                max: selectedRoom.maxCapacity,
              })}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('booking.purpose')}
          </label>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder={t('booking.purposePlaceholder')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary"
          />
        </div>

        {selectedRoom.bookingTerms && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <AlertTriangleIcon className="w-4 h-4" />
              {t('booking.terms')}
            </div>
            <div className="text-xs text-slate-700 whitespace-pre-wrap max-h-32 overflow-y-auto custom-scrollbar bg-white/60 rounded p-2 border border-amber-100">
              {selectedRoom.bookingTerms}
            </div>
            <label className="flex items-start gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary/20"
              />
              <span>{t('booking.termsAccept')}</span>
            </label>
          </div>
        )}
      </form>

      <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3 shrink-0 pb-safe">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 text-sm font-medium text-slate-600 hover:bg-white border border-transparent hover:border-slate-300 rounded-lg transition-colors"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={
            !isCountValid ||
            isSubmitting ||
            hasConflict ||
            checkingConflict ||
            (!!selectedRoom.bookingTerms && !termsAccepted)
          }
          className="flex-1 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-light rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting && <LoadingSpinner size="sm" color="white" />}
          {isSubmitting
            ? t('booking.booking')
            : hasConflict
              ? t('booking.timeUnavailable')
              : t('common.confirm')}
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return createPortal(formContent, document.body);
  }

  return formContent;
};

export default BookingForm;
