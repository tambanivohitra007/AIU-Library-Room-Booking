import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import logo from '../assets/logo.webp';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSwitchToRegister: () => void;
  error: string | null;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, onSwitchToRegister, error }) => {
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

  // Quick login buttons for demo
  const quickLogin = async (userEmail: string, userPassword: string) => {
    setEmail(userEmail);
    setPassword(userPassword);
    setLoading(true);
    try {
      await onLogin(userEmail, userPassword);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Curves */}
      <div className="absolute inset-0 overflow-hidden">
        <svg className="absolute w-full h-full" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path d="M0 0L1440 0L1440 400C1440 400 1200 500 720 400C240 300 0 500 0 500L0 0Z" fill="#4F46E5" fillOpacity="0.05"/>
          <path d="M0 100L1440 100L1440 500C1440 500 1000 600 600 500C200 400 0 600 0 600L0 100Z" fill="#4F46E5" fillOpacity="0.03"/>
        </svg>
      </div>

      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 border border-slate-200 overflow-hidden">
        <div className="text-center py-8 px-8 rounded-t-2xl" style={{ backgroundColor: '#024c6f' }}>
          <div className="flex items-center justify-center mb-4">
            <img src={logo} alt="AIU Logo" className="w-48 h-40 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-slate-200">Sign in to AIU Library Room Booking</p>
        </div>
        <div className="p-8">

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="your.email@uni.edu"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <LoadingSpinner size="sm" color="white" />}
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-slate-600 text-sm">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToRegister}
              className="text-primary font-semibold hover:underline"
            >
              Register
            </button>
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-500 text-center mb-3">Demo Accounts:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => quickLogin('alice@uni.edu', 'student123')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded text-sm font-medium text-slate-700 transition-colors"
            >
              Student Login
            </button>
            <button
              type="button"
              onClick={() => quickLogin('bob@uni.edu', 'admin123')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded text-sm font-medium text-slate-700 transition-colors"
            >
              Admin Login
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
