
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { ServiceSettings } from '../types';

interface SettingsContextType {
    settings: ServiceSettings | null;
    updateSettings: (newSettings: Partial<ServiceSettings>) => Promise<void>;
    loading: boolean;
    error: string | null;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = (): SettingsContextType => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};

// Default settings if API fails or initially
const DEFAULT_SETTINGS: ServiceSettings = {
    id: 'default',
    serviceName: 'AIU Library Room Booking',
    description: 'Room Booking System',
};

interface SettingsProviderProps {
    children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
    const [settings, setSettings] = useState<ServiceSettings | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:5000/api/settings'); // Adjust URL if needed
            if (!response.ok) {
                throw new Error('Failed to fetch settings');
            }
            const data = await response.json();
            setSettings(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching settings:', err);
            setError('Failed to load settings');
            // Fallback to defaults if fetch fails (e.g., first run or network error)
            setSettings(DEFAULT_SETTINGS);
        } finally {
            setLoading(false);
        }
    };

    const updateSettings = async (newSettings: Partial<ServiceSettings>) => {
        try {
            const response = await fetch('http://localhost:5000/api/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newSettings),
            });

            if (!response.ok) {
                throw new Error('Failed to update settings');
            }

            const updated = await response.json();
            setSettings(updated);
        } catch (err) {
            console.error('Error updating settings:', err);
            throw err;
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const value = {
        settings,
        updateSettings,
        loading,
        error
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};
