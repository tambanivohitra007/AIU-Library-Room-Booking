import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { OperatingHours } from '../types';
import { parseOperatingHours } from '../utils/operatingHours';
import OperatingHoursEditor, {
  validateOperatingHours,
} from './OperatingHoursEditor';

const SettingsTab: React.FC = () => {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const toast = useToast();
  const [formData, setFormData] = useState({
    serviceName: settings?.serviceName || '',
    description: settings?.description || '',
    contactEmail: settings?.contactEmail || '',
    websiteUrl: settings?.websiteUrl || '',
    logoUrl: settings?.logoUrl || '',
    allowedEmailDomains: settings?.allowedEmailDomains || '',
  });
  const [allowSelfRegistration, setAllowSelfRegistration] = useState(
    !!settings?.allowSelfRegistration,
  );
  // Kept as a string so the field can be cleared while typing without snapping to 0
  const [approvalLeadTime, setApprovalLeadTime] = useState(
    String(settings?.approvalLeadTimeMinutes ?? 60),
  );
  const [hours, setHours] = useState<OperatingHours>(
    parseOperatingHours(settings?.operatingHours),
  );

  useEffect(() => {
    if (settings) {
      setFormData({
        serviceName: settings.serviceName || '',
        description: settings.description || '',
        contactEmail: settings.contactEmail || '',
        websiteUrl: settings.websiteUrl || '',
        logoUrl: settings.logoUrl || '',
        allowedEmailDomains: settings.allowedEmailDomains || '',
      });
      setHours(parseOperatingHours(settings.operatingHours));
      setAllowSelfRegistration(!!settings.allowSelfRegistration);
      setApprovalLeadTime(String(settings.approvalLeadTimeMinutes ?? 60));
    }
  }, [settings]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hoursError = validateOperatingHours(hours);
    if (hoursError) {
      toast.error(hoursError);
      return;
    }
    // Mirrors the server bound (0..7 days) so a typo is caught before the round trip
    const leadMinutes = Number(approvalLeadTime);
    if (
      approvalLeadTime.trim() === '' || // Number('') is 0, which would silently disable the rule
      !Number.isInteger(leadMinutes) ||
      leadMinutes < 0 ||
      leadMinutes > 10080
    ) {
      toast.error(t('settingsTab.approvalLeadTimeInvalid'));
      return;
    }
    try {
      await updateSettings({
        ...formData,
        operatingHours: JSON.stringify(hours),
        allowSelfRegistration,
        approvalLeadTimeMinutes: leadMinutes,
      });
      toast.success(t('settingsTab.updated'));
    } catch (error) {
      toast.error(t('settingsTab.updateFailed'));
    }
  };

  return (
    <div className="max-w-2xl mx-auto glass rounded-xl border border-slate-200 p-8 animate-slide-up">
      <h3 className="text-xl font-bold gradient-text mb-6 flex items-center gap-2">
        <svg
          className="w-6 h-6 text-primary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        {t('settingsTab.title')}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            {t('settingsTab.serviceName')}
          </label>
          <input
            type="text"
            name="serviceName"
            value={formData.serviceName}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder={t('settingsTab.serviceNamePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            {t('settingsTab.description')}
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder={t('settingsTab.descriptionPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            {t('settingsTab.contactEmails')}
          </label>
          <input
            type="text"
            name="contactEmail"
            value={formData.contactEmail}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder={t('settingsTab.contactEmailsPlaceholder')}
          />
          <p className="text-xs text-slate-500 mt-1">
            {t('settingsTab.contactEmailsHint')}
          </p>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            {t('settingsTab.websiteUrl')}
          </label>
          <input
            type="url"
            name="websiteUrl"
            value={formData.websiteUrl}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder={t('settingsTab.websiteUrlPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            {t('settingsTab.allowedDomains')}
          </label>
          <input
            type="text"
            name="allowedEmailDomains"
            value={formData.allowedEmailDomains}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder={t('settingsTab.allowedDomainsPlaceholder')}
          />
          <p className="text-xs text-slate-500 mt-1">
            {t('settingsTab.allowedDomainsHint')}
          </p>
        </div>
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowSelfRegistration}
              onChange={(e) => setAllowSelfRegistration(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-primary/20"
            />
            <span className="text-sm font-bold text-slate-700">
              {t('settingsTab.allowSelfRegistration')}
            </span>
          </label>
          <p className="text-xs text-slate-500 mt-1 ml-6">
            {t('settingsTab.allowSelfRegistrationHint')}
          </p>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            {t('settingsTab.approvalLeadTime')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={10080}
              step={5}
              value={approvalLeadTime}
              onChange={(e) => setApprovalLeadTime(e.target.value)}
              className="w-32 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <span className="text-sm text-slate-600 font-medium">
              {t('settingsTab.minutes')}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t('settingsTab.approvalLeadTimeHint')}
          </p>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            {t('roomDetails.operatingHours')}
          </label>
          <OperatingHoursEditor value={hours} onChange={setHours} />
          <p className="text-xs text-slate-500 mt-1">
            {t('settingsTab.operatingHoursHint')}
          </p>
        </div>
        <div className="pt-4">
          <button
            type="submit"
            className="w-full px-6 py-3 bg-primary hover:bg-primary-light text-white font-bold rounded-lg transition-all-smooth flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {t('settingsTab.saveChanges')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsTab;
