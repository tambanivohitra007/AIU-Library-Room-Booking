import React from 'react';
import { Room } from '../types';
import { XIcon } from './Icons';
import { useSettings } from '../contexts/SettingsContext';
import {
  getEffectiveOperatingHours,
  parseOperatingHoursOrNull,
} from '../utils/operatingHours';
import { OperatingHoursView } from './OperatingHoursEditor';

interface RoomDetailsModalProps {
  room: Room;
  onClose: () => void;
}

const RoomDetailsModal: React.FC<RoomDetailsModalProps> = ({
  room,
  onClose,
}) => {
  const { operatingHours: globalHours } = useSettings();
  const hours = getEffectiveOperatingHours(room.department, globalHours);
  const usesDepartmentSchedule =
    parseOperatingHoursOrNull(room.department?.operatingHours) !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-fade-in">
      <div className="bg-white rounded-xl max-w-lg w-full animate-scale-in max-h-[90vh] overflow-y-auto border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {room.name}
            </h3>
            <p className="text-sm text-slate-500">
              {room.department?.name || 'No department'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {room.description && (
            <p className="text-sm text-slate-600">{room.description}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="border border-slate-200 rounded-lg px-4 py-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                Capacity
              </p>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {room.minCapacity}–{room.maxCapacity} people
              </p>
            </div>
            <div className="border border-slate-200 rounded-lg px-4 py-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                Approval
              </p>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {room.requiresApproval ? 'Required before booking' : 'Not required'}
              </p>
            </div>
          </div>

          {room.features.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
                Features
              </p>
              <div className="flex flex-wrap gap-2">
                {room.features.map((feature, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-indigo-50 border border-indigo-200/50 text-indigo-700 rounded-md text-xs font-bold"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
              Operating Hours
              <span className="normal-case font-medium text-slate-400 ml-2">
                (
                {usesDepartmentSchedule
                  ? `${room.department?.name} schedule`
                  : 'global schedule'}
                )
              </span>
            </p>
            <OperatingHoursView value={hours} />
          </div>

          {room.bookingTerms && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
                Terms &amp; Conditions
              </p>
              <div className="text-xs text-slate-700 whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar bg-amber-50 rounded-lg p-3 border border-amber-200">
                {room.bookingTerms}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoomDetailsModal;
