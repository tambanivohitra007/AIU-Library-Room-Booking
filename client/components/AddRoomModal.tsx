import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { Department } from '../types';
import { XIcon, PlusIcon } from './Icons';
import { useToast } from '../contexts/ToastContext';

interface AddRoomModalProps {
  onClose: () => void;
  onSuccess: () => void;
  allowedDepartmentIds?: string[]; // department admins may only pick their own departments
}

const AddRoomModal: React.FC<AddRoomModalProps> = ({
  onClose,
  onSuccess,
  allowedDepartmentIds,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minCapacity, setMinCapacity] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [bookingTerms, setBookingTerms] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDepartments()
      .then((all) => {
        const selectable = allowedDepartmentIds
          ? all.filter((d) => allowedDepartmentIds.includes(d.id))
          : all;
        setDepartments(selectable);
        // Department admins must assign the room to one of their departments
        if (allowedDepartmentIds && selectable.length > 0) {
          setDepartmentId(selectable[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleAddFeature = () => {
    if (newFeature.trim() && !features.includes(newFeature.trim())) {
      setFeatures([...features, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const handleRemoveFeature = (feature: string) => {
    setFeatures(features.filter((f) => f !== feature));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !description.trim() || !minCapacity || !maxCapacity) {
      setError(t('roomForm.errorRequired'));
      return;
    }

    const minCapacityNum = parseInt(minCapacity);
    const maxCapacityNum = parseInt(maxCapacity);

    if (isNaN(minCapacityNum) || minCapacityNum < 1) {
      setError(t('roomForm.errorMinCapacity'));
      return;
    }

    if (isNaN(maxCapacityNum) || maxCapacityNum < 1) {
      setError(t('roomForm.errorMaxCapacity'));
      return;
    }

    if (minCapacityNum > maxCapacityNum) {
      setError(t('roomForm.errorMinMax'));
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createRoom({
        name: name.trim(),
        description: description.trim(),
        minCapacity: minCapacityNum,
        maxCapacity: maxCapacityNum,
        features,
        departmentId: departmentId || null,
        bookingTerms: bookingTerms.trim() || null,
        requiresApproval,
      });
      toast.success(t('roomForm.created'));
      onSuccess();
      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t('roomForm.createFailed');
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-fade-in">
      <div className="bg-white rounded-xl max-w-lg w-full animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-white/15 flex items-center justify-between sticky top-0 bg-primary-dark">
          <h3 className="text-lg font-semibold text-white">
            {t('roomForm.addTitle')}
          </h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
            disabled={isSubmitting}
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('roomForm.roomName')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder={t('roomForm.roomNamePlaceholder')}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('roomForm.description')}{' '}
                <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={3}
                placeholder={t('roomForm.descriptionPlaceholder')}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('roomForm.minCapacity')}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={minCapacity}
                  onChange={(e) => setMinCapacity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder={t('roomForm.minCapacityPlaceholder')}
                  min="1"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('roomForm.maxCapacity')}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder={t('roomForm.maxCapacityPlaceholder')}
                  min="1"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {departments.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('roomForm.department')}
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                  disabled={isSubmitting}
                >
                  {!allowedDepartmentIds && (
                    <option value="">{t('roomForm.noDepartmentOption')}</option>
                  )}
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary/20"
                  disabled={isSubmitting}
                />
                <span className="text-sm font-medium text-slate-700">
                  {t('roomForm.requireApproval')}
                </span>
              </label>
              <p className="text-xs text-slate-500 mt-1 ml-6">
                {t('roomForm.requireApprovalHint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('roomForm.terms')}
              </label>
              <textarea
                value={bookingTerms}
                onChange={(e) => setBookingTerms(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={4}
                placeholder={t('roomForm.termsPlaceholder')}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('roomDetails.features')}
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === 'Enter' &&
                    (e.preventDefault(), handleAddFeature())
                  }
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder={t('roomForm.featuresPlaceholder')}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={handleAddFeature}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  disabled={isSubmitting}
                >
                  <PlusIcon className="w-5 h-5 text-slate-600" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {features.map((feature, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-md text-sm font-medium flex items-center gap-1"
                  >
                    {feature}
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(feature)}
                      className="hover:text-indigo-900"
                      disabled={isSubmitting}
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-primary-dark hover:bg-primary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('roomForm.creating') : t('roomForm.createRoom')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddRoomModal;
