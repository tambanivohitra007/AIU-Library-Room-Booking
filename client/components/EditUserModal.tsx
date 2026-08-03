import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon, AlertTriangleIcon } from './Icons';
import { User, UserRole } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { api } from '../services/api';

interface EditUserModalProps {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    role: user.role,
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name || !formData.email) {
      setError(t('userForm.errorNameEmailRequired'));
      return;
    }

    // If password is being changed, validate it
    if (formData.password) {
      if (formData.password !== formData.confirmPassword) {
        setError(t('userForm.passwordsNoMatch'));
        return;
      }

      if (formData.password.length < 8) {
        setError(t('userForm.passwordMinLength'));
        return;
      }
    }

    setLoading(true);
    try {
      const updateData: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
      };

      // Only include password if it's being changed
      if (formData.password) {
        updateData.password = formData.password;
      }

      await api.updateUser(user.id, updateData);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || t('userForm.updateFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        {/* Header */}
        <div className="border-b border-white/15 bg-primary-dark p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {t('userForm.editTitle')}
            </h2>
            <p className="text-sm text-white/80 mt-1">
              {t('userForm.editSubtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5 text-white/80" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 p-3 rounded-lg border border-red-200 flex items-start gap-2">
              <AlertTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('userForm.fullName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder={t('userForm.fullNamePlaceholder')}
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('userForm.email')} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder={t('userForm.emailPlaceholder')}
              required
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('userForm.role')} <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as UserRole })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="STUDENT">{t('userForm.roleStudent')}</option>
              <option value="FACULTY">{t('userForm.roleFaculty')}</option>
              <option value="STUDENT_WORKER">
                {t('userForm.roleStudentWorker')}
              </option>
              <option value="ADMIN">{t('userForm.roleAdmin')}</option>
              <option value="SUPERADMIN">
                {t('userForm.roleSuperAdmin')}
              </option>
            </select>
          </div>

          {/* Password Section */}
          <div className="pt-4 border-t border-slate-200">
            <p className="text-sm font-medium text-slate-700 mb-3">
              {t('userForm.changePasswordSection')}{' '}
              {!user.provider || user.provider === 'LOCAL'
                ? t('userForm.keepCurrentHint')
                : ''}
            </p>

            {user.provider === 'MICROSOFT' ? (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm text-primary-dark flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p>
                  {t('userForm.msNotice1')}
                  <br />
                  {t('userForm.msNotice2')}
                </p>
              </div>
            ) : (
              <>
                {/* New Password */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {t('userForm.newPassword')}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder={t('userForm.passwordPlaceholder')}
                    minLength={8}
                  />
                </div>

                {/* Confirm Password */}
                {formData.password && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {t('userForm.confirmNewPassword')}
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirmPassword: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder={t('userForm.confirmPasswordPlaceholder')}
                      minLength={8}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-100 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary hover:bg-primary-light text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <LoadingSpinner size="sm" color="white" />}
              {loading ? t('userForm.updating') : t('userForm.updateUser')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;
