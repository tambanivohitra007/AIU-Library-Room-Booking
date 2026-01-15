import React, { useState } from 'react';

interface CancelBookingModalProps {
  isOpen: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const CancelBookingModal: React.FC<CancelBookingModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(reason);
    setReason(''); // Reset for next time
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Cancel Booking</h3>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <p className="text-slate-600">
              Are you sure you want to cancel this booking? This action cannot be undone.
            </p>
            
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-slate-700 mb-1">
                Reason (Optional)
              </label>
              <textarea
                id="reason"
                className="w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                rows={3}
                placeholder="e.g. Room maintenance, Policy violation..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Cancel Booking
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CancelBookingModal;
