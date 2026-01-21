
import React, { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';

const SettingsTab: React.FC = () => {
    const { settings, updateSettings } = useSettings();
    const toast = useToast();
    const [formData, setFormData] = useState({
        serviceName: settings?.serviceName || '',
        description: settings?.description || '',
        contactEmail: settings?.contactEmail || '',
        websiteUrl: settings?.websiteUrl || '',
        logoUrl: settings?.logoUrl || '',
    });

    useEffect(() => {
        if (settings) {
            setFormData({
                serviceName: settings.serviceName || '',
                description: settings.description || '',
                contactEmail: settings.contactEmail || '',
                websiteUrl: settings.websiteUrl || '',
                logoUrl: settings.logoUrl || '',
            });
        }
    }, [settings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateSettings(formData);
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
                        placeholder="e.g. AIU Library Room Booking"
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
