import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from './LoadingSpinner';
import logo from '../assets/logo.webp';
import { useSettings } from '../contexts/SettingsContext';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  error: string | null;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, error }) => {
  const { settings } = useSettings();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(email, password);
    } finally {
      setLoading(false);
    }
  };

  const tips = [1, 2, 3, 4].map((n) => ({
    title: t(`login.tips.step${n}Title`),
    text: t(`login.tips.step${n}Text`),
  }));

  const serviceName = settings?.serviceName || 'Room Booking';
  const supportEmail = settings?.contactEmail?.split(/[,;]/)[0]?.trim();

  return (
    <div className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      <main className="flex h-full flex-col overflow-hidden lg:flex-row">
        <section className="relative flex w-full items-center justify-center bg-white px-6 py-6 lg:w-3/5 lg:px-12 lg:py-8">
          <div className="relative z-10 w-full max-w-md animate-slide-up space-y-6">
            <div className="space-y-3">
              <span className="block text-xl font-bold text-primary">{serviceName}</span>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl">
                  {t('login.welcomeBack')}
                </h1>
                <p className="mt-1.5 text-sm text-slate-500">{t('login.tips.subtitle')}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  className="animate-slide-down rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                  role="alert"
                >
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {error}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="login-email" className="block text-sm font-semibold text-slate-700">
                  {t('login.emailAddress')}
                </label>
                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <svg
                      className="h-5 w-5 text-slate-400 transition-colors group-focus-within:text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                      />
                    </svg>
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full rounded-md border border-slate-300 bg-white py-3 pl-12 pr-4 text-slate-900 transition-all-smooth focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                    placeholder="name@company.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700">
                  {t('login.password')}
                </label>
                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <svg
                      className="h-5 w-5 text-slate-400 transition-colors group-focus-within:text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full rounded-md border border-slate-300 bg-white py-3 pl-12 pr-14 text-slate-900 transition-all-smooth focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:text-primary"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-500">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
                Remember me for 30 days
              </label>

              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-bold text-white transition-all-smooth hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="relative flex items-center gap-2">
                  {loading && <LoadingSpinner size="sm" color="white" />}
                  {loading ? t('login.signingIn') : t('login.signIn')}
                  {!loading && (
                    <svg
                      className="h-5 w-5 transition-transform group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  )}
                </span>
              </button>
            </form>

            <div className="space-y-4 text-center">
              <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                <span>or continue with</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const { api } = await import('../services/api');
                    const url = await api.getMicrosoftLoginUrl();
                    window.location.href = url;
                  } catch (err: any) {
                    console.error(err);
                    alert(
                      'Failed to initialize Microsoft Login: ' +
                        (err.message || 'Unknown error'),
                    );
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-md border border-slate-300 bg-white py-2.5 font-semibold text-slate-700 transition-all-smooth hover:border-slate-400 hover:bg-slate-50"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 23 23"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path fill="#f35325" d="M1 1h10v10H1z" />
                  <path fill="#81bc06" d="M12 1h10v10H12z" />
                  <path fill="#05a6f0" d="M1 12h10v10H1z" />
                  <path fill="#ffba08" d="M12 12h10v10H12z" />
                </svg>
                {t('login.microsoftSignIn')}
              </button>

              {settings?.allowSelfRegistration && (
                <Link
                  to="/register"
                  className="inline-block w-full rounded-md border-2 border-primary/20 px-4 py-2.5 text-center font-bold text-primary transition-all-smooth hover:border-primary/40 hover:bg-primary/5"
                >
                  {t('login.createAccount')}
                </Link>
              )}

              {supportEmail && (
                <p className="text-xs text-slate-500">
                  {t('login.questionsContact')}{' '}
                  <a href={`mailto:${supportEmail}`} className="font-semibold text-primary hover:underline">
                    {supportEmail}
                  </a>
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="relative hidden overflow-hidden bg-primary-dark lg:flex lg:w-2/5 lg:items-center lg:justify-center lg:px-8 lg:py-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -left-12 bottom-16 h-52 w-52 rounded-full bg-primary-light/40 blur-2xl" />
          </div>

          <div className="relative z-10 w-full max-w-sm space-y-6 animate-fade-in">
            <div className="space-y-2 text-center">
              <img
                src={settings?.logoUrl || logo}
                alt={settings?.serviceName || 'Service Logo'}
                className="mx-auto h-20 w-auto max-w-[220px] object-contain"
              />
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/80">
                {serviceName}
              </p>
            </div>

            <div className="rounded-xl border border-white/25 bg-white/10 p-4 backdrop-blur-md">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-white/50" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
                  </div>
                  <span className="h-3 w-20 rounded-full bg-white/30" />
                </div>
                <div className="flex h-24 items-end gap-2">
                  <span className="h-14 flex-1 rounded bg-white/20" />
                  <span className="h-24 flex-1 rounded bg-white/40" />
                  <span className="h-10 flex-1 rounded bg-white/20" />
                  <span className="h-20 flex-1 rounded bg-white/30" />
                </div>
              </div>
            </div>

            <div className="space-y-3 text-white">
              <h2 className="text-xl font-bold">{t('login.tips.title')}</h2>
              <ol className="space-y-2.5">
                {tips.map((tip, idx) => (
                  <li key={idx} className="rounded-md border border-white/20 bg-white/10 px-3.5 py-2.5 backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{tip.title}</span>
                        <span className="mt-0.5 block text-sm text-white/80">{tip.text}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LoginForm;
