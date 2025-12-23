import React from 'react';
import { Booking } from '../types';
import { XIcon, UsersIcon } from './Icons';

interface AttendeesModalProps {
  booking: Booking;
  onClose: () => void;
}

const AttendeesModal: React.FC<AttendeesModalProps> = ({ booking, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-slate-900">Attendees</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="mb-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600 mb-1">
              <span className="font-medium text-slate-700">Booking ID:</span> {booking.id}
            </p>
            <p className="text-sm text-slate-600 mb-1">
              <span className="font-medium text-slate-700">Organizer:</span> {booking.userDisplay}
            </p>
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Time:</span>{' '}
              {new Date(booking.startTime).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })} - {new Date(booking.endTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700 mb-3">
              Attendees ({booking.attendees.length})
            </p>
            {booking.attendees.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No attendees listed</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {booking.attendees.map((attendee, idx) => (
                  <div
                    key={idx}
                    className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">{attendee.name}</p>
                        {attendee.studentId && (
                          <p className="text-xs text-slate-500 mt-1">ID: {attendee.studentId}</p>
                        )}
                      </div>
                      {attendee.isCompanion && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          Companion
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendeesModal;
