import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Department } from '../types';
import { XIcon } from './Icons';
import { api } from '../services/api';
import { useSettings } from '../contexts/SettingsContext';
import { parseOperatingHoursOrNull } from '../utils/operatingHours';
import { OperatingHoursView } from './OperatingHoursEditor';

interface DepartmentDetailsModalProps {
  department: Department;
  canViewManagers: boolean; // manager list endpoint is global-admin only
  onClose: () => void;
}

const DepartmentDetailsModal: React.FC<DepartmentDetailsModalProps> = ({
  department,
  canViewManagers,
  onClose,
}) => {
  const { t } = useTranslation();
  const { operatingHours: globalHours } = useSettings();
  const customHours = parseOperatingHoursOrNull(department.operatingHours);
  const [managers, setManagers] = useState<
    Array<{ id: string; name: string; email: string }>
  >([]);

  useEffect(() => {
    if (canViewManagers) {
      api
        .getDepartmentAdmins(department.id)
        .then(setManagers)
        .catch(() => {});
    }
  }, [department.id, canViewManagers]);

  const contactEmails = (department.contactEmail || '')
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-fade-in">
      <div className="bg-white rounded-xl max-w-lg w-full animate-scale-in max-h-[90vh] overflow-y-auto border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {department.name}
            </h3>
            <p className="text-sm text-slate-500">
              {t('deptDetails.roomCount', {
                count: department.roomCount ?? 0,
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
              {t('deptDetails.contactEmails')}
            </p>
            {contactEmails.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {contactEmails.map((email) => (
                  <a
                    key={email}
                    href={`mailto:${email}`}
                    className="px-3 py-1 bg-slate-50 border border-slate-200 text-slate-700 rounded-md text-xs font-medium hover:text-primary hover:border-primary/40 transition-colors"
                  >
                    {email}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">
                {t('deptDetails.noneSet')}
              </p>
            )}
          </div>

          {canViewManagers && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
                {t('deptDetails.managers')}
              </p>
              {managers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {managers.map((m) => (
                    <span
                      key={m.id}
                      className="px-3 py-1 bg-indigo-50 border border-indigo-200/50 text-indigo-700 rounded-md text-xs font-medium"
                      title={m.email}
                    >
                      {m.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  {t('deptDetails.noManagers')}
                </p>
              )}
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
              {t('roomDetails.operatingHours')}
              <span className="normal-case font-medium text-slate-400 ml-2">
                (
                {customHours
                  ? t('deptDetails.customSchedule')
                  : t('deptDetails.followsGlobal')}
                )
              </span>
            </p>
            <OperatingHoursView value={customHours || globalHours} />
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-100 transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepartmentDetailsModal;
