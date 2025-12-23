import React, { useState, useEffect } from 'react';
import { Room, Attendee } from '../types';
import { api } from '../services/api';
import { MAX_ATTENDEES, MIN_ATTENDEES } from '../constants';
import { UsersIcon, ClockIcon } from './Icons';
import { useToast } from '../contexts/ToastContext';

interface BookingFormProps {
  selectedRoom: Room;
  startTime: Date;
  endTime: Date;
  onSuccess: () => void;
  onCancel: () => void;
}

const BookingForm: React.FC<BookingFormProps> = ({ selectedRoom, startTime, endTime, onSuccess, onCancel }) => {
  const toast = useToast();
  const [purpose, setPurpose] = useState('');
  const [attendeeInput, setAttendeeInput] = useState('');
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset form when times change
    setError(null);
  }, [startTime, endTime]);

  // Parse attendees
  useEffect(() => {
    const rawLines = attendeeInput.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    const unique = new Set(rawLines);
    setAttendeeCount(unique.size);
  }, [attendeeInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rawLines = attendeeInput.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    const uniqueRaw = Array.from(new Set(rawLines));

    if (uniqueRaw.length + 1 < MIN_ATTENDEES) {
       setError(`Min ${MIN_ATTENDEES} people (You + ${MIN_ATTENDEES - 1} others).`);
       return;
    }
    if (uniqueRaw.length + 1 > MAX_ATTENDEES) {
        setError(`Max ${MAX_ATTENDEES} people.`);
        return;
    }

    const attendees: Attendee[] = uniqueRaw.map((name: string) => ({
        name: name,
        isCompanion: true
    }));
    attendees.unshift({ name: 'Me (Booker)', isCompanion: false });

    try {
      await api.createBooking({
        roomId: selectedRoom.id,
        startTime,
        endTime,
        purpose,
        attendees
      });

      toast.success(`Booking confirmed for ${selectedRoom.name}!`);
      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast.error(`Failed to create booking: ${errorMessage}`);
    }
  };

  const isCountValid = (attendeeCount + 1) >= MIN_ATTENDEES && (attendeeCount + 1) <= MAX_ATTENDEES;
  const durationMinutes = (endTime.getTime() - startTime.getTime()) / 60000;

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200 shadow-xl">
        <div className="bg-slate-800 text-white p-4">
            <h3 className="font-bold text-lg">New Booking</h3>
            <p className="text-slate-300 text-sm">{selectedRoom.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-5">
            {error && (
                <div className="bg-red-50 p-2 text-xs text-red-600 rounded border border-red-200">
                    {error}
                </div>
            )}

            <div className="bg-indigo-50 p-3 rounded-lg flex items-start gap-3 border border-indigo-100">
                <ClockIcon className="w-5 h-5 text-primary mt-0.5" />
                <div>
                    <div className="text-sm font-semibold text-slate-800">
                        {startTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric'})}
                    </div>
                    <div className="text-lg font-bold text-primary">
                        {startTime.getHours()}:{startTime.getMinutes().toString().padStart(2,'0')} - {endTime.getHours()}:{endTime.getMinutes().toString().padStart(2,'0')}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Duration: {durationMinutes / 60}h</div>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Other Attendees
                </label>
                <div className="relative">
                    <textarea
                        required
                        rows={3}
                        value={attendeeInput}
                        onChange={e => setAttendeeInput(e.target.value)}
                        placeholder="Enter names..."
                        className={`w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary ${!isCountValid && attendeeInput.length > 0 ? 'border-orange-300' : 'border-slate-300'}`}
                    />
                    <UsersIcon className="w-4 h-4 absolute right-2 top-2 text-slate-300" />
                </div>
                <div className="flex justify-between mt-1 text-xs">
                    <span className={isCountValid ? 'text-green-600' : 'text-orange-500'}>
                        Count: {attendeeCount} (+ You)
                    </span>
                    <span className="text-slate-400">Min {MIN_ATTENDEES}, Max {MAX_ATTENDEES}</span>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
                <input 
                    type="text" 
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                    placeholder="Brief description..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                />
            </div>
        </form>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
             <button 
                type="button"
                onClick={onCancel}
                className="flex-1 py-2 text-sm font-medium text-slate-600 hover:bg-white border border-transparent hover:border-slate-300 rounded-lg transition-colors"
             >
                Cancel
             </button>
             <button 
                onClick={handleSubmit}
                disabled={!isCountValid}
                className="flex-1 py-2 text-sm font-medium text-white bg-primary hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
             >
                Confirm
             </button>
        </div>
    </div>
  );
};

export default BookingForm;