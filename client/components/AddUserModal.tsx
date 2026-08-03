import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon, AlertTriangleIcon } from './Icons';
import { UserRole } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { api } from '../services/api';

interface AddUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const AddUserModal: React.FC<AddUserModalProps> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'STUDENT' as UserRole,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      setError(t('userForm.errorRequiredFields'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('userForm.passwordsNoMatch'));
      return;
    }

    if (formData.password.length < 8) {
      setError(t('userForm.passwordMinLength'));
      return;
    }

    setLoading(true);
    try {
      await api.createUser({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || t('userForm.createFailed'));
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
              {t('userForm.addTitle')}
            </h2>
            <p className="text-sm text-white/80 mt-1">
              {t('userForm.addSubtitle')}
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

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('userForm.password')} <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder={t('userForm.passwordPlaceholder')}
              required
              minLength={8}
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('userForm.confirmPassword')}{' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData({ ...formData, confirmPassword: e.target.value })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder={t('userForm.confirmPasswordPlaceholder')}
              required
              minLength={8}
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
              className="px-6 py-2 bg-primary-dark hover:bg-primary text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <LoadingSpinner size="sm" color="white" />}
              {loading ? t('userForm.creating') : t('userForm.createUser')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;
