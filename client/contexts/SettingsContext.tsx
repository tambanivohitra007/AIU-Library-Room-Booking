import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useMemo,
} from 'react';
import { ServiceSettings, OperatingHours } from '../types';
import { api } from '../services/api';
import { parseOperatingHours } from '../utils/operatingHours';

interface SettingsContextType {
  settings: ServiceSettings | null;
  operatingHours: OperatingHours;
  updateSettings: (newSettings: Partial<ServiceSettings>) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

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
  serviceName: 'Room Booking',
  description: 'Room Booking System',
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({
  children,
}) => {
  const [settings, setSettings] = useState<ServiceSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getSettings();
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
      const updated = await api.updateSettings(newSettings);
      setSettings(updated);
    } catch (err) {
      console.error('Error updating settings:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const operatingHours = useMemo(
    () => parseOperatingHours(settings?.operatingHours),
    [settings?.operatingHours],
  );

  const value = {
    settings,
    operatingHours,
    updateSettings,
    loading,
    error,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
