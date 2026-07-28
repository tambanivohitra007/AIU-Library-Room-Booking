import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

const AuthCallbackPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast: showToast } = useToast();
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent double execution in React Strict Mode which is common in Dev
    if (processedRef.current) return;
    processedRef.current = true;

    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      showToast(
        t('authCallback.microsoftLoginFailed', {
          message: params.get('error_description') || error,
        }),
        'error',
      );
      navigate('/');
      return;
    }

    if (!code) {
      showToast(t('authCallback.noCode'), 'error');
      navigate('/');
      return;
    }

    const processLogin = async () => {
      try {
        await api.loginWithMicrosoft(code);
        showToast(t('authCallback.loginSuccess'), 'success');
        navigate('/'); // Go to dashboard
        // Force a page reload or context update if necessary to update user state in App
        // But usually navigate is enough if App checks token on mount/route change.
        // However, App.tsx likely needs to re-fetch "currentUser".
        // We'll see how App handles auth state.
        window.location.reload();
      } catch (err: any) {
        console.error(err);
        showToast(err.message || t('authCallback.loginError'), 'error');
        navigate('/');
      }
    };

    processLogin();
  }, [location, navigate, showToast, t]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 flex-col gap-4">
      <LoadingSpinner />
      <p className="text-slate-500 font-medium animate-pulse">
        {t('authCallback.authenticating')}
      </p>
    </div>
  );
};

export default AuthCallbackPage;
