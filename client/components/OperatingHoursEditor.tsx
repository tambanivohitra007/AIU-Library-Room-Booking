import React from 'react';
import { OperatingHours } from '../types';
import { DEFAULT_OPERATING_HOURS } from '../utils/operatingHours';

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

interface OperatingHoursEditorProps {
  value: OperatingHours;
  onChange: (hours: OperatingHours) => void;
}

export const validateOperatingHours = (
  hours: OperatingHours,
): string | null => {
  for (const d of hours) {
    if (d !== null && (d.open < 0 || d.close > 24 || d.open >= d.close)) {
      return 'Opening time must be before closing time (0-24)';
    }
  }
  return null;
};

// Read-only weekly schedule display
export const OperatingHoursView: React.FC<{ value: OperatingHours }> = ({
  value,
}) => (
  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
    {WEEKDAY_NAMES.map((name, day) => {
      const d = value[day];
      return (
        <div
          key={name}
          className="flex items-center justify-between px-4 py-1.5 text-sm"
        >
          <span className="font-medium text-slate-700">{name}</span>
          {d ? (
            <span className="text-slate-600">
              {d.open}:00 – {d.close}:00
            </span>
          ) : (
            <span className="text-slate-400 italic">Closed</span>
          )}
        </div>
      );
    })}
  </div>
);

const OperatingHoursEditor: React.FC<OperatingHoursEditorProps> = ({
  value,
  onChange,
}) => {
  const toggleDayOpen = (day: number) => {
    onChange(
      value.map((d, i) => {
        if (i !== day) return d;
        return d === null
          ? { ...(DEFAULT_OPERATING_HOURS[day] || { open: 8, close: 22 }) }
          : null;
      }),
    );
  };

  const setDayHour = (day: number, field: 'open' | 'close', v: number) => {
    if (Number.isNaN(v)) return;
    onChange(
      value.map((d, i) => (i === day && d !== null ? { ...d, [field]: v } : d)),
    );
  };

  return (
    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
      {WEEKDAY_NAMES.map((name, day) => {
        const dayHours = value[day];
        return (
          <div key={name} className="flex items-center gap-3 px-4 py-2">
            <label className="flex items-center gap-2 w-32 cursor-pointer">
              <input
                type="checkbox"
                checked={dayHours !== null}
                onChange={() => toggleDayOpen(day)}
                className="rounded border-slate-300 text-primary focus:ring-primary/20"
              />
              <span className="text-sm font-medium text-slate-700">{name}</span>
            </label>
            {dayHours !== null ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={dayHours.open}
                  onChange={(e) =>
                    setDayHour(day, 'open', parseInt(e.target.value, 10))
                  }
                  className="w-16 px-2 py-1 border border-slate-200 rounded focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <span>:00 to</span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={dayHours.close}
                  onChange={(e) =>
                    setDayHour(day, 'close', parseInt(e.target.value, 10))
                  }
                  className="w-16 px-2 py-1 border border-slate-200 rounded focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <span>:00</span>
              </div>
            ) : (
              <span className="text-sm text-slate-400 italic">Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default OperatingHoursEditor;
