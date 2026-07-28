import React from 'react';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from './LoadingSpinner';

interface LoadingOverlayProps {
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
      <div className="text-center">
        <LoadingSpinner size="lg" color="primary" className="mx-auto mb-4" />
        <p className="text-slate-600 font-medium">
          {message ?? t('common.loading')}
        </p>
      </div>
    </div>
  );
};

export default LoadingOverlay;
