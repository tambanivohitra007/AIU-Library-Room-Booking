import React from 'react';

export type CalendarView = 'day' | 'week' | 'month';

interface ViewSwitcherProps {
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ currentView, onViewChange }) => {
  const views: { id: CalendarView; label: string }[] = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
  ];

  return (
    <div className="inline-flex bg-slate-200 p-0.5 sm:p-1 rounded-lg">
      {views.map((view) => (
        <button
          key={view.id}
          onClick={() => onViewChange(view.id)}
          className={`px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${
            currentView === view.id
              ? 'bg-white text-primary shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
};

export default ViewSwitcher;
