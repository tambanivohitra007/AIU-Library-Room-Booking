
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Department, OperatingHours } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { parseOperatingHoursOrNull } from '../utils/operatingHours';
import OperatingHoursEditor, { validateOperatingHours } from './OperatingHoursEditor';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { useToast } from '../contexts/ToastContext';
import { XIcon, PlusIcon } from './Icons';

interface DepartmentFormState {
    name: string;
    contactEmail: string;
    useCustomHours: boolean;
    hours: OperatingHours;
}

interface DepartmentsManagerProps {
    onRefresh?: () => void;
}

const DepartmentsManager: React.FC<DepartmentsManagerProps> = ({ onRefresh }) => {
    const toast = useToast();
    const { operatingHours: globalHours } = useSettings();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Department | 'new' | null>(null);
    const [deleting, setDeleting] = useState<Department | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
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
            toast.error('Failed to load departments');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDepartments();
    }, []);

    const openEditor = (dept: Department | 'new') => {
        if (dept === 'new') {
            setForm({ name: '', contactEmail: '', useCustomHours: false, hours: globalHours });
        } else {
            const customHours = parseOperatingHoursOrNull(dept.operatingHours);
            setForm({
                name: dept.name,
                contactEmail: dept.contactEmail || '',
                useCustomHours: customHours !== null,
                hours: customHours || globalHours,
            });
        }
        setEditing(dept);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) {
            toast.error('Department name is required');
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
        };

        setIsSubmitting(true);
        try {
            if (editing === 'new') {
                await api.createDepartment(payload);
                toast.success('Department created');
            } else if (editing) {
                await api.updateDepartment(editing.id, payload);
                toast.success('Department updated');
            }
            setEditing(null);
            await loadDepartments();
            onRefresh?.();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to save department');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleting) return;
        setIsSubmitting(true);
        try {
            await api.deleteDepartment(deleting.id);
            toast.success('Department deleted. Its rooms are now unassigned.');
            setDeleting(null);
            await loadDepartments();
            onRefresh?.();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete department');
        } finally {
            setIsSubmitting(false);
        }
    };

    const hoursSummary = (dept: Department) => {
        return parseOperatingHoursOrNull(dept.operatingHours) ? 'Custom schedule' : 'Default schedule';
    };

    return (
        <div className="max-w-3xl mx-auto animate-slide-up space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold gradient-text">Departments</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Group rooms by department, each with its own contact and operating hours.
                    </p>
                </div>
                <button
                    onClick={() => openEditor('new')}
                    className="px-4 py-2 bg-primary hover:bg-primary-light text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md transition-all-smooth flex items-center gap-2"
                >
                    <PlusIcon className="w-4 h-4" />
                    Add Department
                </button>
            </div>

            {loading ? (
                <div className="glass rounded-xl border border-white/20 p-8 text-center text-slate-500">Loading…</div>
            ) : departments.length === 0 ? (
                <div className="glass rounded-xl border border-white/20 p-8 text-center text-slate-500">
                    No departments yet. Rooms without a department follow the global operating hours.
                </div>
            ) : (
                <div className="glass rounded-xl border border-white/20 divide-y divide-slate-100 shadow-medium">
                    {departments.map((dept) => (
                        <div key={dept.id} className="flex items-center justify-between px-6 py-4 gap-4">
                            <div className="min-w-0">
                                <p className="font-bold text-slate-800 truncate">{dept.name}</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {dept.roomCount ?? 0} room{(dept.roomCount ?? 0) === 1 ? '' : 's'} · {hoursSummary(dept)}
                                    {dept.contactEmail ? ` · ${dept.contactEmail}` : ''}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => openEditor(dept)}
                                    className="px-3 py-1.5 text-sm font-medium text-primary bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => setDeleting(dept)}
                                    className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
                            <h3 className="text-lg font-semibold text-slate-900">
                                {editing === 'new' ? 'Add Department' : 'Edit Department'}
                            </h3>
                            <button
                                onClick={() => setEditing(null)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                                disabled={isSubmitting}
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                        placeholder="e.g., Library, Music Department"
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Contact Email</label>
                                    <input
                                        type="email"
                                        value={form.contactEmail}
                                        onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                        placeholder="dept@example.com"
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                                        <input
                                            type="checkbox"
                                            checked={form.useCustomHours}
                                            onChange={(e) => setForm({ ...form, useCustomHours: e.target.checked })}
                                            className="rounded border-slate-300 text-primary focus:ring-primary/20"
                                            disabled={isSubmitting}
                                        />
                                        <span className="text-sm font-medium text-slate-700">Use custom operating hours</span>
                                    </label>
                                    {form.useCustomHours ? (
                                        <OperatingHoursEditor
                                            value={form.hours}
                                            onChange={(hours) => setForm({ ...form, hours })}
                                        />
                                    ) : (
                                        <p className="text-xs text-slate-500">
                                            This department follows the global schedule from Settings.
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white">
                                <button
                                    type="button"
                                    onClick={() => setEditing(null)}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Saving…' : editing === 'new' ? 'Create Department' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {deleting && (
                <ConfirmDeleteModal
                    title="Delete Department"
                    message={`Delete "${deleting.name}"? Its ${deleting.roomCount ?? 0} room(s) will be kept but unassigned, and will follow the global operating hours.`}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleting(null)}
                    isLoading={isSubmitting}
                />
            )}
        </div>
    );
};

export default DepartmentsManager;
