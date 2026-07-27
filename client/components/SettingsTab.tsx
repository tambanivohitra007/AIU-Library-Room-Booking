
import React, { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { OperatingHours } from '../types';
import { parseOperatingHours, DEFAULT_OPERATING_HOURS } from '../utils/operatingHours';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SettingsTab: React.FC = () => {
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
    const [hours, setHours] = useState<OperatingHours>(parseOperatingHours(settings?.operatingHours));

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
        }
    }, [settings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const toggleDayOpen = (day: number) => {
        setHours(prev => prev.map((d, i) => {
            if (i !== day) return d;
            return d === null ? { ...(DEFAULT_OPERATING_HOURS[day] || { open: 8, close: 22 }) } : null;
        }));
    };

    const setDayHour = (day: number, field: 'open' | 'close', value: number) => {
        if (Number.isNaN(value)) return;
        setHours(prev => prev.map((d, i) => (i === day && d !== null ? { ...d, [field]: value } : d)));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        for (const d of hours) {
            if (d !== null && (d.open < 0 || d.close > 24 || d.open >= d.close)) {
                toast.error('Opening time must be before closing time (0-24)');
                return;
            }
        }
        try {
            await updateSettings({ ...formData, operatingHours: JSON.stringify(hours) });
            toast.success('Settings updated successfully');
        } catch (error) {
            toast.error('Failed to update settings');
        }
    };

    return (
        <div className="max-w-2xl mx-auto glass rounded-xl border border-white/20 p-8 shadow-medium animate-slide-up">
            <h3 className="text-xl font-bold gradient-text mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Service Configuration
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Service Name</label>
                    <input
                        type="text"
                        name="serviceName"
                        value={formData.serviceName}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="e.g. Campus Room Booking"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={3}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="Short description of the service"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Contact Email</label>
                    <input
                        type="email"
                        name="contactEmail"
                        value={formData.contactEmail}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="admin@example.com"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Website URL (Optional)</label>
                    <input
                        type="url"
                        name="websiteUrl"
                        value={formData.websiteUrl}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="https://example.com"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Allowed Email Domains</label>
                    <input
                        type="text"
                        name="allowedEmailDomains"
                        value={formData.allowedEmailDomains}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="e.g. example.edu, staff.example.edu"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        Comma-separated list. Only emails from these domains can register or sign in. Leave empty to allow any domain.
                    </p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Operating Hours</label>
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                        {WEEKDAY_NAMES.map((name, day) => {
                            const dayHours = hours[day];
                            return (
                                <div key={name} className="flex items-center gap-3 px-4 py-2">
                                    <label className="flex items-center gap-2 w-32 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={dayHours !== null}
                                            onChange={() => toggleDayOpen(day)}
                                            className="rounded border-slate-300 text-primary focus:ring-primary/20"
                                        />
                                        <span className="text-sm font-medium text-slate-700">{name}</span>
                                    </label>
                                    {dayHours !== null ? (
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <input
                                                type="number"
                                                min={0}
                                                max={23}
                                                value={dayHours.open}
                                                onChange={(e) => setDayHour(day, 'open', parseInt(e.target.value, 10))}
                                                className="w-16 px-2 py-1 border border-slate-200 rounded focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                            />
                                            <span>:00 to</span>
                                            <input
                                                type="number"
                                                min={1}
                                                max={24}
                                                value={dayHours.close}
                                                onChange={(e) => setDayHour(day, 'close', parseInt(e.target.value, 10))}
                                                className="w-16 px-2 py-1 border border-slate-200 rounded focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                            />
                                            <span>:00</span>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-slate-400 italic">Closed</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Bookings are only allowed within these hours (enforced by the server).
                    </p>
                </div>
                <div className="pt-4">
                    <button
                        type="submit"
                        className="w-full px-6 py-3 bg-primary hover:bg-primary-light text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all-smooth transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SettingsTab;
