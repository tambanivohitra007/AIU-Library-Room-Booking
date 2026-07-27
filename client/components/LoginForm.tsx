import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import logo from '../assets/logo.webp';
import { useSettings } from '../contexts/SettingsContext';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  error: string | null;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, error }) => {
  const { settings } = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="bg-white rounded-lg w-full max-w-md overflow-hidden border border-slate-200 animate-slide-up">
        <div className="text-center py-10 px-8 bg-primary">
          <div className="flex items-center justify-center mb-6">
            <img
              src={settings?.logoUrl || logo}
              alt={settings?.serviceName || 'Service Logo'}
              className="w-40 h-32 object-contain"
            />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
            Welcome Back
          </h1>
          <p className="text-blue-100 text-sm font-medium">
            {settings?.serviceName || 'Room Booking'}
          </p>
        </div>
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm font-medium animate-slide-down">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
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
              <label className="block text-sm font-semibold text-slate-700">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="w-5 h-5 text-slate-400"
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
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all-smooth text-slate-900 placeholder-slate-400 font-medium "
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="w-5 h-5 text-slate-400"
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
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all-smooth text-slate-900 placeholder-slate-400 font-medium "
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-light text-white font-bold py-2.5 rounded-md shadow-sm transition-all-smooth disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
            >
              <span className="relative flex items-center gap-2">
                {loading && <LoadingSpinner size="sm" color="white" />}
                {loading ? 'Signing in...' : 'Sign In'}
                {!loading && (
                  <svg
                    className="w-5 h-5 group-hover:translate-x-1 transition-transform"
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

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                try {
                  // Dynamically import API to avoid circular deps if any (though unlikely here)
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
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold py-2.5 rounded-md hover:bg-slate-50 transition-all shadow-sm mb-6"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 23 23"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
              Sign in with School Account
            </button>

            {settings?.allowSelfRegistration && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white/70 text-slate-500 font-medium">
                      New to {settings?.serviceName || 'Room Booking'}?
                    </span>
                  </div>
                </div>
                <Link
                  to="/register"
                  className="mt-4 w-full inline-block text-center py-3 px-4 border-2 border-primary/20 hover:border-primary/40 text-primary font-bold rounded-md hover:bg-primary/5 transition-all-smooth "
                >
                  Create an Account
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
