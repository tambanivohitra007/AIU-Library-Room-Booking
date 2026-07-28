import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  ScheduleException,
  Department,
  User,
  isGlobalAdminRole,
} from '../types';
import { parseIcs, ParsedIcsEvent } from '../utils/ics';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { useToast } from '../contexts/ToastContext';
import { XIcon, PlusIcon } from './Icons';

interface ImportEvent extends ParsedIcsEvent {
  duplicate: boolean;
  selected: boolean;
}

interface ImportState {
  events: ImportEvent[];
  skippedRecurring: number;
  skippedInvalid: number;
  skippedPast: number;
  departmentId: string; // '' = service-wide
}

interface ClosureFormState {
  name: string;
  startDate: string;
  endDate: string;
  departmentId: string; // '' = service-wide
  closed: boolean;
  openHour: number;
  closeHour: number;
}

interface ClosuresManagerProps {
  currentUser: User;
}

// Manage date-specific closures (holidays, maintenance) and special hours
const ClosuresManager: React.FC<ClosuresManagerProps> = ({ currentUser }) => {
  const toast = useToast();
  const isAdmin = isGlobalAdminRole(currentUser.role);
  const managedIds = currentUser.managedDepartmentIds || [];

  const [closures, setClosures] = useState<ScheduleException[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ScheduleException | 'new' | null>(
    null,
  );
  const [deleting, setDeleting] = useState<ScheduleException | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importState, setImportState] = useState<ImportState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ClosureFormState>({
    name: '',
    startDate: '',
    endDate: '',
    departmentId: '',
    closed: true,
    openHour: 8,
    closeHour: 22,
  });

  const load = async () => {
    try {
      setLoading(true);
      const [ex, depts] = await Promise.all([
        api.getScheduleExceptions(),
        api.getDepartments(),
      ]);
      setClosures(ex);
      setDepartments(depts);
    } catch {
      toast.error('Failed to load closures');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const canManage = (ex: ScheduleException) =>
    isAdmin || (!!ex.departmentId && managedIds.includes(ex.departmentId));

  const toDateInput = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const openEditor = (ex: ScheduleException | 'new') => {
    if (ex === 'new') {
      setForm({
        name: '',
        startDate: '',
        endDate: '',
        departmentId: isAdmin ? '' : managedIds[0] || '',
        closed: true,
        openHour: 8,
        closeHour: 22,
      });
    } else {
      setForm({
        name: ex.name,
        startDate: toDateInput(ex.startDate),
        endDate: toDateInput(ex.endDate),
        departmentId: ex.departmentId || '',
        closed: ex.closed,
        openHour: ex.openHour ?? 8,
        closeHour: ex.closeHour ?? 22,
      });
    }
    setEditing(ex);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.startDate || !form.endDate)
      return toast.error('Start and end dates are required');
    if (form.endDate < form.startDate)
      return toast.error('End date must not be before the start date');
    if (!form.closed && form.openHour >= form.closeHour)
      return toast.error('Opening time must be before closing time');

    const payload = {
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      departmentId: form.departmentId || null,
      closed: form.closed,
      openHour: form.closed ? null : form.openHour,
      closeHour: form.closed ? null : form.closeHour,
    };

    setIsSubmitting(true);
    try {
      if (editing === 'new') {
        await api.createScheduleException(payload);
        toast.success('Closure created');
      } else if (editing) {
        await api.updateScheduleException(editing.id, payload);
        toast.success('Closure updated');
      }
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setIsSubmitting(true);
    try {
      await api.deleteScheduleException(deleting.id);
      toast.success('Closure deleted');
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- .ics import ----

  const handleIcsFile = async (file: File) => {
    try {
      const parsed = parseIcs(await file.text());
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      let skippedPast = 0;
      const events: ImportEvent[] = [];
      for (const ev of parsed.events) {
        if (ev.endDate < todayStr) {
          skippedPast++;
          continue;
        }
        const duplicate = closures.some(
          (c) => c.name === ev.name && toDateInput(c.startDate) === ev.startDate,
        );
        events.push({ ...ev, duplicate, selected: !duplicate });
      }

      if (
        events.length === 0 &&
        parsed.skippedRecurring + parsed.skippedInvalid + skippedPast === 0
      ) {
        toast.error('No events found in that file');
        return;
      }

      setImportState({
        events,
        skippedRecurring: parsed.skippedRecurring,
        skippedInvalid: parsed.skippedInvalid,
        skippedPast,
        departmentId: isAdmin ? '' : managedIds[0] || '',
      });
    } catch {
      toast.error('Could not read that file as an iCalendar (.ics)');
    }
  };

  const handleImport = async () => {
    if (!importState) return;
    const selected = importState.events.filter((e) => e.selected);
    if (selected.length === 0) {
      toast.error('Nothing selected to import');
      return;
    }
    setIsSubmitting(true);
    let created = 0;
    let failed = 0;
    for (const ev of selected) {
      try {
        await api.createScheduleException({
          name: ev.name,
          startDate: ev.startDate,
          endDate: ev.endDate,
          departmentId: importState.departmentId || null,
          closed: true,
          openHour: null,
          closeHour: null,
        });
        created++;
      } catch {
        failed++;
      }
    }
    setIsSubmitting(false);
    setImportState(null);
    toast.success(
      `Imported ${created} closure${created === 1 ? '' : 's'}${failed ? ` (${failed} failed)` : ''}`,
    );
    await load();
  };

  const formatRange = (ex: ScheduleException) => {
    const opts: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };
    const s = new Date(ex.startDate).toLocaleDateString('en-US', opts);
    const e = new Date(ex.endDate).toLocaleDateString('en-US', opts);
    return s === e ? s : `${s} – ${e}`;
  };

  // Department managers may pick only their own departments; admins anything
  const scopeOptions = isAdmin
    ? departments
    : departments.filter((d) => managedIds.includes(d.id));

  return (
    <div className="max-w-3xl mx-auto animate-slide-up space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold gradient-text">
            Closures &amp; Special Hours
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Holidays, maintenance days, and date-specific opening hours.
            These override the weekly schedule.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics,text/calendar"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleIcsFile(file);
              e.target.value = ''; // allow re-selecting the same file
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-bold rounded-lg transition-colors"
          >
            Import .ics
          </button>
          <button
            onClick={() => openEditor('new')}
            className="px-4 py-2 bg-primary hover:bg-primary-light text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Add Closure
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          Loading…
        </div>
      ) : closures.length === 0 ? (
        <div className="glass rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          No closures yet. The weekly operating hours apply on every date.
        </div>
      ) : (
        <div className="glass rounded-xl border border-slate-200 divide-y divide-slate-100">
          {closures.map((ex) => (
            <div
              key={ex.id}
              className="flex items-center justify-between px-6 py-4 gap-4"
            >
              <div className="min-w-0">
                <p className="font-bold text-slate-800 truncate">{ex.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatRange(ex)} ·{' '}
                  {ex.department?.name || 'Service-wide'} ·{' '}
                  {ex.closed ? (
                    <span className="text-red-600 font-semibold">Closed</span>
                  ) : (
                    <span className="text-green-700 font-semibold">
                      Open {ex.openHour}:00–{ex.closeHour}:00
                    </span>
                  )}
                </p>
              </div>
              {canManage(ex) && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEditor(ex)}
                    className="px-3 py-1.5 text-sm font-medium text-primary bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleting(ex)}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-lg w-full animate-scale-in max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-slate-900">
                {editing === 'new' ? 'Add Closure' : 'Edit Closure'}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                <XIcon className="w-5 h-5 text-slate-600" />
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
                    placeholder="e.g., Christmas Day, Exam Week Extended Hours"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      From <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) =>
                        setForm({ ...form, startDate: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      To <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) =>
                        setForm({ ...form, endDate: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Applies To
                  </label>
                  <select
                    value={form.departmentId}
                    onChange={(e) =>
                      setForm({ ...form, departmentId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={isSubmitting}
                  >
                    {isAdmin && (
                      <option value="">Service-wide (all rooms)</option>
                    )}
                    {scopeOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.closed}
                      onChange={(e) =>
                        setForm({ ...form, closed: e.target.checked })
                      }
                      className="rounded border-slate-300 text-primary focus:ring-primary/20"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Closed all day
                    </span>
                  </label>
                  {!form.closed && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 mt-2 ml-6">
                      <span>Special hours:</span>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={form.openHour}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            openHour: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-16 px-2 py-1 border border-slate-200 rounded focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        disabled={isSubmitting}
                      />
                      <span>:00 to</span>
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={form.closeHour}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            closeHour: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-16 px-2 py-1 border border-slate-200 rounded focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        disabled={isSubmitting}
                      />
                      <span>:00</span>
                    </div>
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
                  className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-light rounded-lg transition-colors disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Saving…'
                    : editing === 'new'
                      ? 'Create Closure'
                      : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* .ics Import Preview */}
      {importState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-lg w-full animate-scale-in max-h-[90vh] flex flex-col border border-slate-200">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Import Calendar Events
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Selected events become all-day closures.
                </p>
              </div>
              <button
                onClick={() => setImportState(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                <XIcon className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Applies To
                </label>
                <select
                  value={importState.departmentId}
                  onChange={(e) =>
                    setImportState({
                      ...importState,
                      departmentId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={isSubmitting}
                >
                  {isAdmin && (
                    <option value="">Service-wide (all rooms)</option>
                  )}
                  {scopeOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {(importState.skippedRecurring > 0 ||
                importState.skippedInvalid > 0 ||
                importState.skippedPast > 0) && (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                  Not shown:
                  {importState.skippedPast > 0 &&
                    ` ${importState.skippedPast} past event${importState.skippedPast === 1 ? '' : 's'}`}
                  {importState.skippedRecurring > 0 &&
                    ` · ${importState.skippedRecurring} recurring`}
                  {importState.skippedInvalid > 0 &&
                    ` · ${importState.skippedInvalid} unreadable`}
                </p>
              )}

              {importState.events.length === 0 ? (
                <p className="text-sm text-slate-400 italic">
                  No upcoming events to import.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {importState.events.map((ev, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${ev.duplicate ? 'opacity-60' : 'hover:bg-slate-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={ev.selected}
                        onChange={(e) =>
                          setImportState({
                            ...importState,
                            events: importState.events.map((x, i) =>
                              i === idx
                                ? { ...x, selected: e.target.checked }
                                : x,
                            ),
                          })
                        }
                        className="rounded border-slate-300 text-primary focus:ring-primary/20"
                        disabled={isSubmitting}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-800 truncate">
                          {ev.name}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {ev.startDate === ev.endDate
                            ? ev.startDate
                            : `${ev.startDate} – ${ev.endDate}`}
                          {ev.duplicate && ' · already exists'}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setImportState(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-light rounded-lg transition-colors disabled:opacity-50"
                disabled={
                  isSubmitting ||
                  importState.events.filter((e) => e.selected).length === 0
                }
              >
                {isSubmitting
                  ? 'Importing…'
                  : `Import ${importState.events.filter((e) => e.selected).length} Closure${importState.events.filter((e) => e.selected).length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleting && (
        <ConfirmDeleteModal
          title="Delete Closure"
          message={`Delete "${deleting.name}"? The weekly operating hours will apply on those dates again.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
};

export default ClosuresManager;
