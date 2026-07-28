import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { dateLocale } from '../i18n';
import { Semester } from '../types';
import { api } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from './LoadingSpinner';
import { PlusIcon, XIcon } from './Icons';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface SemesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  formData: {
    name: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  };
  setFormData: React.Dispatch<
    React.SetStateAction<{
      name: string;
      startDate: string;
      endDate: string;
      isActive: boolean;
    }>
  >;
  isEditing: boolean;
  isLoading?: boolean;
}

const SemesterModal: React.FC<SemesterModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  isEditing,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          aria-hidden="true"
          onClick={isLoading ? undefined : onClose}
        ></div>
        <span
          className="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true"
        >
          &#8203;
        </span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
          <div className="bg-primary-dark border-b border-white/15 px-4 pt-5 pb-4 sm:px-6 sm:py-5">
            <div className="flex justify-between items-center">
              <h3
                className="text-lg leading-6 font-medium text-white"
                id="modal-title"
              >
                {isEditing
                  ? t('semesters.modalEditTitle')
                  : t('semesters.modalAddTitle')}
              </h3>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white disabled:opacity-50"
                disabled={isLoading}
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  {t('semesters.nameLabel')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder={t('semesters.namePlaceholder')}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-50 disabled:text-slate-500"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="w-5 h-5 text-primary rounded focus:ring-primary disabled:opacity-50"
                  disabled={isLoading}
                />
                <label
                  htmlFor="isActive"
                  className="text-sm font-medium text-slate-700"
                >
                  {t('semesters.setActive')}
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">
                    {t('semesters.startDate')}
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-50 disabled:text-slate-500"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">
                    {t('semesters.endDate')}
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-50 disabled:text-slate-500"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="submit"
                  className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-dark text-base font-medium text-white hover:bg-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:col-start-2 sm:text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      {isEditing
                        ? t('semesters.updating')
                        : t('semesters.creating')}
                    </>
                  ) : isEditing ? (
                    t('semesters.update')
                  ) : (
                    t('semesters.create')
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:col-start-1 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

const SemestersManager: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [semesterToDelete, setSemesterToDelete] = useState<Semester | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    isActive: false,
  });

  useEffect(() => {
    loadSemesters(true);
  }, []);

  const loadSemesters = async (isInitial = false) => {
    try {
      // Only set loading true on initial load to avoid flash
      if (isInitial) setLoading(true);

      const data = await api.getSemesters();
      setSemesters(data);
    } catch (error) {
      toast.error(t('semesters.loadFailed'));
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const openAddModal = () => {
    setFormData({ name: '', startDate: '', endDate: '', isActive: false });
    setIsEditing(false);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleEdit = (semester: Semester) => {
    setFormData({
      name: semester.name,
      startDate: new Date(semester.startDate).toISOString().split('T')[0],
      endDate: new Date(semester.endDate).toISOString().split('T')[0],
      isActive: semester.isActive,
    });
    setEditingId(semester.id);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const requestDelete = (semester: Semester) => {
    if (semester.isActive) {
      toast.error(t('semesters.cannotDeleteActiveDetail'));
      return;
    }
    setSemesterToDelete(semester);
  };

  const confirmDelete = async () => {
    if (!semesterToDelete) return;

    if (semesterToDelete.isActive) {
      toast.error(t('semesters.cannotDeleteActive'));
      setSemesterToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteSemester(semesterToDelete.id);
      toast.success(t('semesters.deleted'));
      loadSemesters();
      setSemesterToDelete(null);
    } catch (error) {
      toast.error(t('semesters.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);

    // Set times to start/end of day for accurate comparison
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (end < start) {
      toast.error(t('semesters.endAfterStart'));
      return;
    }

    const hasOverlap = semesters.some((sem) => {
      if (isEditing && sem.id === editingId) return false;

      const semStart = new Date(sem.startDate);
      const semEnd = new Date(sem.endDate);

      // Normalize existing dates too
      semStart.setHours(0, 0, 0, 0);
      semEnd.setHours(23, 59, 59, 999);

      return start <= semEnd && end >= semStart;
    });

    if (hasOverlap) {
      toast.error(t('semesters.overlap'));
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && editingId) {
        await api.updateSemester(editingId, {
          ...formData,
          startDate: new Date(formData.startDate).toISOString(),
          endDate: new Date(formData.endDate).toISOString(),
        });
        toast.success(t('semesters.updated'));
      } else {
        await api.createSemester({
          ...formData,
          startDate: new Date(formData.startDate).toISOString(),
          endDate: new Date(formData.endDate).toISOString(),
        });
        toast.success(t('semesters.created'));
      }
      setIsModalOpen(false);
      loadSemesters();
    } catch (error) {
      toast.error(t('semesters.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl font-bold gradient-text">
          {t('semesters.title')}
        </h2>
        <button
          onClick={openAddModal}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary-dark hover:bg-primary text-white rounded-lg font-bold transition-all"
        >
          <PlusIcon className="w-5 h-5" />
          {t('semesters.add')}
        </button>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block glass rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                {t('semesters.colName')}
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                {t('semesters.colDates')}
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                {t('semesters.colStatus')}
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                {t('semesters.colActions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {semesters.map((semester) => (
              <tr
                key={semester.id}
                className="even:bg-slate-50 hover:bg-primary/5 transition-colors"
              >
                <td className="px-6 py-4 font-semibold text-slate-800">
                  {semester.name}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {new Date(semester.startDate).toLocaleDateString(
                    dateLocale(),
                  )}{' '}
                  -{' '}
                  {new Date(semester.endDate).toLocaleDateString(dateLocale())}
                </td>
                <td className="px-6 py-4">
                  {semester.isActive ? (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold border border-green-200">
                      {t('semesters.active')}
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-md text-xs font-bold border border-slate-200">
                      {t('semesters.inactive')}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button
                    onClick={() => handleEdit(semester)}
                    className="text-primary hover:text-primary-dark font-medium text-sm"
                  >
                    {t('semesters.edit')}
                  </button>
                  <button
                    onClick={() => requestDelete(semester)}
                    disabled={semester.isActive}
                    className={`font-medium text-sm transition-colors ${
                      semester.isActive
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-red-500 hover:text-red-700'
                    }`}
                    title={
                      semester.isActive
                        ? t('semesters.deleteTooltipActive')
                        : t('semesters.deleteTooltip')
                    }
                  >
                    {t('semesters.delete')}
                  </button>
                </td>
              </tr>
            ))}

            {semesters.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-8 text-center text-slate-500 font-medium"
                >
                  {t('semesters.noneConfiguredAdd')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {semesters.length === 0 ? (
          <div className="glass rounded-lg border border-slate-200 p-12 text-center ">
            <p className="text-slate-500 font-semibold">
              {t('semesters.noneConfigured')}
            </p>
          </div>
        ) : (
          semesters.map((semester) => (
            <div
              key={semester.id}
              className="glass rounded-lg border border-slate-200 p-4 "
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">
                    {semester.name}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {new Date(semester.startDate).toLocaleDateString(
                      dateLocale(),
                    )}{' '}
                    -{' '}
                    {new Date(semester.endDate).toLocaleDateString(
                      dateLocale(),
                    )}
                  </p>
                </div>
                {semester.isActive ? (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold border border-green-200">
                    {t('semesters.active')}
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-md text-xs font-bold border border-slate-200">
                    {t('semesters.inactive')}
                  </span>
                )}
              </div>

              <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200">
                <button
                  onClick={() => handleEdit(semester)}
                  className="flex-1 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-md font-bold text-sm transition-all"
                >
                  {t('semesters.edit')}
                </button>
                <button
                  onClick={() => requestDelete(semester)}
                  disabled={semester.isActive}
                  className={`flex-1 px-4 py-2.5 border rounded-md font-bold text-sm transition-all ${
                    semester.isActive
                      ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                      : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-600'
                  }`}
                >
                  {t('semesters.delete')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <SemesterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        isEditing={isEditing}
        isLoading={submitting}
      />

      {semesterToDelete && (
        <ConfirmDeleteModal
          title={t('semesters.deleteTitle')}
          message={t('semesters.deleteMessage', {
            name: semesterToDelete.name,
          })}
          onConfirm={confirmDelete}
          onCancel={() => setSemesterToDelete(null)}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
};

export default SemestersManager;
