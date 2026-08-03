import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dateLocale } from '../i18n';
import { api } from '../services/api';
import { AuditEntry, Department, User, isGlobalAdminRole } from '../types';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from './LoadingSpinner';

interface AuditLogViewerProps {
  currentUser: User;
}

const PAGE_SIZE = 50;

// Grouped so the filter reads as categories rather than one long list
const ACTION_GROUPS: { key: string; actions: string[] }[] = [
  {
    key: 'bookings',
    actions: [
      'BOOKING_APPROVE',
      'BOOKING_REJECT',
      'BOOKING_CANCEL',
      'BOOKING_REMIND',
      'BOOKING_AUTO_CANCEL',
      'BOOKING_AUTO_COMPLETE',
    ],
  },
  { key: 'rooms', actions: ['ROOM_CREATE', 'ROOM_UPDATE', 'ROOM_DELETE'] },
  {
    key: 'departments',
    actions: [
      'DEPARTMENT_CREATE',
      'DEPARTMENT_UPDATE',
      'DEPARTMENT_DELETE',
      'DEPARTMENT_MANAGERS_UPDATE',
    ],
  },
  { key: 'closures', actions: ['CLOSURE_CREATE', 'CLOSURE_UPDATE', 'CLOSURE_DELETE'] },
  { key: 'semesters', actions: ['SEMESTER_CREATE', 'SEMESTER_UPDATE', 'SEMESTER_DELETE'] },
  {
    key: 'users',
    actions: [
      'USER_CREATE',
      'USER_UPDATE',
      'USER_DELETE',
      'USER_IMPORT',
      'USER_ROLE_CHANGE',
      'USER_STATUS_CHANGE',
    ],
  },
  { key: 'platform', actions: ['SETTINGS_UPDATE'] },
];

// Destructive or privilege-changing actions are tinted so they stand out when scanning
const HIGH_IMPACT = new Set([
  'ROOM_DELETE',
  'DEPARTMENT_DELETE',
  'SEMESTER_DELETE',
  'CLOSURE_DELETE',
  'USER_DELETE',
  'USER_ROLE_CHANGE',
  'DEPARTMENT_MANAGERS_UPDATE',
  'SETTINGS_UPDATE',
]);

const actionTone = (action: string): string => {
  if (HIGH_IMPACT.has(action)) return 'bg-red-50 border-red-200 text-red-700';
  if (action.startsWith('BOOKING_AUTO')) return 'bg-slate-50 border-slate-200 text-slate-600';
  if (action.endsWith('_CREATE')) return 'bg-green-50 border-green-200 text-green-700';
  return 'bg-primary/10 border-primary/20 text-primary';
};

const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const isAdmin = isGlobalAdminRole(currentUser.role);

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [action, setAction] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await api.getAuditLog({
        limit: PAGE_SIZE,
        offset,
        action: action || undefined,
        departmentId: departmentId || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setEntries(page.entries);
      setTotal(page.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('audit.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [offset, action, departmentId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  // Only global admins can filter by department; others are already scoped server-side
  useEffect(() => {
    if (!isAdmin) return;
    api.getDepartments().then(setDepartments).catch(() => {});
  }, [isAdmin]);

  const resetFilters = () => {
    setAction('');
    setDepartmentId('');
    setFrom('');
    setTo('');
    setOffset(0);
  };

  const hasFilters = !!(action || departmentId || from || to);
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const formatWhen = useMemo(
    () => (iso: string) =>
      new Date(iso).toLocaleString(dateLocale(), {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-800">{t('audit.title')}</h3>
        <p className="text-sm text-slate-500">
          {isAdmin ? t('audit.subtitleAdmin') : t('audit.subtitleDept')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end bg-slate-50 border border-slate-200 rounded-lg p-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">
            {t('audit.filterAction')}
          </label>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setOffset(0);
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">{t('audit.allActions')}</option>
            {ACTION_GROUPS.map((g) => (
              <optgroup key={g.key} label={t(`audit.groups.${g.key}`)}>
                {g.actions.map((a) => (
                  <option key={a} value={a}>
                    {t(`audit.actions.${a}`)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {isAdmin && departments.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              {t('audit.filterDepartment')}
            </label>
            <select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setOffset(0);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="">{t('audit.allDepartments')}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">
            {t('audit.filterFrom')}
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setOffset(0);
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">
            {t('audit.filterTo')}
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setOffset(0);
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          />
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            {t('audit.clearFilters')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12">
          {hasFilters ? t('audit.emptyFiltered') : t('audit.empty')}
        </p>
      ) : (
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
          {entries.map((e) => {
            const isOpen = expanded === e.id;
            const isSystem = e.actorId === null;
            return (
              <div key={e.id} className="px-4 py-3 hover:bg-slate-50">
                <div className="flex flex-wrap items-start gap-2">
                  <span
                    className={`px-2 py-1 rounded-md text-xs font-bold border shrink-0 ${actionTone(e.action)}`}
                  >
                    {t(`audit.actions.${e.action}`, { defaultValue: e.action })}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800">
                      {e.summary || e.targetLabel || e.targetType}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span className="font-medium">
                        {isSystem ? t('audit.systemActor') : e.actorName}
                      </span>
                      {!isSystem && ` (${e.actorEmail})`}
                      {' · '}
                      {formatWhen(e.createdAt)}
                      {e.departmentName ? ` · ${e.departmentName}` : ''}
                    </p>
                  </div>
                  {e.metadata && (
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : e.id)}
                      className="text-xs font-medium text-primary hover:underline shrink-0"
                    >
                      {isOpen ? t('audit.hideDetails') : t('audit.showDetails')}
                    </button>
                  )}
                </div>
                {isOpen && e.metadata && (
                  <pre className="mt-2 p-2 bg-slate-100 rounded text-xs text-slate-700 overflow-x-auto">
                    {typeof e.metadata === 'string'
                      ? e.metadata
                      : JSON.stringify(e.metadata, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {t('audit.pageOf', { page, pages, total })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50"
            >
              {t('audit.previous')}
            </button>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50"
            >
              {t('audit.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogViewer;
