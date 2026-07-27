import React from 'react';

export type CalendarView = 'day' | 'week' | 'month';

interface ViewSwitcherProps {
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  currentView,
  onViewChange,
}) => {
  const views: { id: CalendarView; label: string }[] = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
  ];

  return (
    <div className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 p-1 rounded-lg">
      {views.map((view) => (
        <button
          key={view.id}
          onClick={() => onViewChange(view.id)}
          className={`px-3 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm rounded transition-all ${
            currentView === view.id
              ? 'bg-white border border-slate-200 text-primary font-bold'
              : 'text-slate-600 font-medium hover:bg-slate-200/60'
          }`}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
};

export default ViewSwitcher;
