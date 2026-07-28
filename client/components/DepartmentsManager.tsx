import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { Department, OperatingHours, User, isGlobalAdminRole } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { parseOperatingHoursOrNull } from '../utils/operatingHours';
import OperatingHoursEditor, {
  validateOperatingHours,
} from './OperatingHoursEditor';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import DepartmentDetailsModal from './DepartmentDetailsModal';
import { useToast } from '../contexts/ToastContext';
import { XIcon, PlusIcon } from './Icons';

interface DepartmentFormState {
  name: string;
  contactEmail: string;
  useCustomHours: boolean;
  hours: OperatingHours;
}

interface DepartmentsManagerProps {
  currentUser: User;
  onRefresh?: () => void;
}

const DepartmentsManager: React.FC<DepartmentsManagerProps> = ({
  currentUser,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { operatingHours: globalHours } = useSettings();
  const isAdmin = isGlobalAdminRole(currentUser.role);
  const managedIds = currentUser.managedDepartmentIds || [];
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Department | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);
  const [viewing, setViewing] = useState<Department | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Manager assignment (global admin only)
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [managerSearch, setManagerSearch] = useState('');

  // Type-to-search over all users, excluding those already assigned
  const managerSearchResults = useMemo(() => {
    const q = managerSearch.trim().toLowerCase();
    if (!q) return [];
    return allUsers
      .filter((u) => !managerIds.includes(u.id))
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [managerSearch, allUsers, managerIds]);

  const addManager = (userId: string) => {
    setManagerIds((prev) => [...prev, userId]);
    setManagerSearch('');
  };
  const [form, setForm] = useState<DepartmentFormState>({
    name: '',
    contactEmail: '',
    useCustomHours: false,
    hours: globalHours,
  });

  const loadDepartments = async () => {
    try {
      setLoading(true);
      setDepartments(await api.getDepartments());
    } catch {
      toast.error(t('departments.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const openEditor = async (dept: Department | 'new') => {
    if (dept === 'new') {
      setForm({
        name: '',
        contactEmail: '',
        useCustomHours: false,
        hours: globalHours,
      });
    } else {
      const customHours = parseOperatingHoursOrNull(dept.operatingHours);
      setForm({
        name: dept.name,
        contactEmail: dept.contactEmail || '',
        useCustomHours: customHours !== null,
        hours: customHours || globalHours,
      });
    }
    setManagerIds([]);
    setManagerSearch('');
    setEditing(dept);
    if (isAdmin && dept !== 'new') {
      try {
        const [admins, users] = await Promise.all([
          api.getDepartmentAdmins(dept.id),
          api.getUsers(),
        ]);
        setManagerIds(admins.map((a) => a.id));
        setAllUsers(users);
      } catch {
        toast.error(t('departments.loadManagersFailed'));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t('departments.nameRequired'));
      return;
    }
    if (form.useCustomHours) {
      const hoursError = validateOperatingHours(form.hours);
      if (hoursError) {
        toast.error(hoursError);
        return;
      }
    }

    const payload = {
      name: form.name.trim(),
      contactEmail: form.contactEmail.trim() || null,
      operatingHours: form.useCustomHours ? JSON.stringify(form.hours) : null,
      ...(isAdmin && editing !== 'new' ? { adminUserIds: managerIds } : {}),
    };

    setIsSubmitting(true);
    try {
      if (editing === 'new') {
        await api.createDepartment(payload);
        toast.success(t('departments.created'));
      } else if (editing) {
        await api.updateDepartment(editing.id, payload);
        toast.success(t('departments.updated'));
      }
      setEditing(null);
      await loadDepartments();
      onRefresh?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('departments.saveFailed'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setIsSubmitting(true);
    try {
      await api.deleteDepartment(deleting.id);
      toast.success(t('departments.deleted'));
      setDeleting(null);
      await loadDepartments();
      onRefresh?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('departments.deleteFailed'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const hoursSummary = (dept: Department) => {
    return parseOperatingHoursOrNull(dept.operatingHours)
      ? t('departments.customSchedule')
      : t('departments.defaultSchedule');
  };

  const [deptSearch, setDeptSearch] = useState('');

  // Department admins only see and edit their own departments
  const visibleDepartments = (
    isAdmin ? departments : departments.filter((d) => managedIds.includes(d.id))
  ).filter((d) => {
    const q = deptSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      d.name.toLowerCase().includes(q) ||
      (d.contactEmail?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="max-w-3xl mx-auto animate-slide-up space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold gradient-text">
            {t('departments.title')}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin
              ? t('departments.subtitleAdmin')
              : t('departments.subtitleManager')}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => openEditor('new')}
            className="px-4 py-2 bg-primary-dark hover:bg-primary text-white text-sm font-bold rounded-lg shadow-sm transition-all-smooth flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            {t('departments.add')}
          </button>
        )}
      </div>

      {departments.length > 3 && (
        <input
          type="text"
          value={deptSearch}
          onChange={(e) => setDeptSearch(e.target.value)}
          placeholder={t('departments.searchPlaceholder')}
          className="w-full sm:w-72 px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
        />
      )}

      {loading ? (
        <div className="glass rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          {t('common.loading')}
        </div>
      ) : visibleDepartments.length === 0 ? (
        <div className="glass rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          {deptSearch.trim()
            ? t('departments.noSearchMatch')
            : t('departments.noDepartments')}
        </div>
      ) : (
        <div className="glass rounded-xl border border-slate-200 divide-y divide-slate-100 ">
          {visibleDepartments.map((dept) => (
            <div
              key={dept.id}
              className="flex items-center justify-between px-6 py-4 gap-4"
            >
              <div className="min-w-0">
                <p className="font-bold text-slate-800 truncate">{dept.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('departments.roomCount', { count: dept.roomCount ?? 0 })}{' '}
                  · {hoursSummary(dept)}
                  {dept.contactEmail ? ` · ${dept.contactEmail}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setViewing(dept)}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t('departments.view')}
                </button>
                <button
                  onClick={() => openEditor(dept)}
                  className="px-3 py-1.5 text-sm font-medium text-primary bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  {t('departments.edit')}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setDeleting(dept)}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    {t('departments.delete')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-lg w-full animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/15 flex items-center justify-between sticky top-0 bg-primary-dark z-10">
              <h3 className="text-lg font-semibold text-white">
                {editing === 'new'
                  ? t('departments.modalAddTitle')
                  : t('departments.modalEditTitle')}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="text-white/80 hover:text-white transition-colors"
                disabled={isSubmitting}
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('departments.nameLabel')}{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder={t('departments.namePlaceholder')}
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('departments.contactEmailsLabel')}
                  </label>
                  <input
                    type="text"
                    value={form.contactEmail}
                    onChange={(e) =>
                      setForm({ ...form, contactEmail: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder={t('departments.contactEmailsPlaceholder')}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {t('departments.contactEmailsHint')}
                  </p>
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={form.useCustomHours}
                      onChange={(e) =>
                        setForm({ ...form, useCustomHours: e.target.checked })
                      }
                      className="rounded border-slate-300 text-primary focus:ring-primary/20"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {t('departments.useCustomHours')}
                    </span>
                  </label>
                  {form.useCustomHours ? (
                    <OperatingHoursEditor
                      value={form.hours}
                      onChange={(hours) => setForm({ ...form, hours })}
                    />
                  ) : (
                    <p className="text-xs text-slate-500">
                      {t('departments.followsGlobalSchedule')}
                    </p>
                  )}
                </div>
                {isAdmin && editing !== 'new' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {t('departments.managersLabel')}
                    </label>
                    <p className="text-xs text-slate-500 mb-2">
                      {t('departments.managersHint')}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {managerIds.map((id) => {
                        const u = allUsers.find((user) => user.id === id);
                        return (
                          <span
                            key={id}
                            className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-md text-sm font-medium flex items-center gap-1"
                          >
                            {u ? u.name : id}
                            <button
                              type="button"
                              onClick={() =>
                                setManagerIds(
                                  managerIds.filter((m) => m !== id),
                                )
                              }
                              className="hover:text-indigo-900"
                              disabled={isSubmitting}
                            >
                              <XIcon className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                      {managerIds.length === 0 && (
                        <span className="text-xs text-slate-400 italic">
                          {t('departments.noManagers')}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={managerSearch}
                        onChange={(e) => setManagerSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (managerSearchResults.length > 0) {
                              addManager(managerSearchResults[0].id);
                            }
                          }
                          if (e.key === 'Escape') setManagerSearch('');
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder={t('departments.searchUsersPlaceholder')}
                        disabled={isSubmitting}
                      />
                      {managerSearch.trim() && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg max-h-56 overflow-y-auto">
                          {managerSearchResults.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-slate-400">
                              {t('departments.noMatchingUsers')}
                            </div>
                          ) : (
                            managerSearchResults.map((u) => (
                              <button
                                type="button"
                                key={u.id}
                                onClick={() => addManager(u.id)}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-b-0"
                              >
                                <span className="font-medium text-slate-800">
                                  {u.name}
                                </span>
                                <span className="text-slate-500 ml-2 text-xs">
                                  {u.email}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  disabled={isSubmitting}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-dark hover:bg-primary rounded-lg transition-colors disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? t('departments.saving')
                    : editing === 'new'
                      ? t('departments.createDepartment')
                      : t('departments.saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Read-only Details */}
      {viewing && (
        <DepartmentDetailsModal
          department={viewing}
          canViewManagers={isAdmin}
          onClose={() => setViewing(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleting && (
        <ConfirmDeleteModal
          title={t('departments.deleteTitle')}
          message={t('departments.deleteMessage', {
            name: deleting.name,
            count: deleting.roomCount ?? 0,
          })}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
};

export default DepartmentsManager;
