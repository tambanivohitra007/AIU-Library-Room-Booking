import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, CalendarIcon, SettingsIcon, UserCircleIcon, LogOutIcon, LockIcon } from './Icons';
import { User, UserRole } from '../types';
import logo from '../assets/logo_small.jpg';
import { useSettings } from '../contexts/SettingsContext';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  onChangePassword: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, onChangePassword }) => {
  const { settings } = useSettings();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { path: '/', label: 'Rooms', icon: HomeIcon },
    { path: '/my-bookings', label: 'My Bookings', icon: CalendarIcon },
  ];

  if (user.role === UserRole.ADMIN) {
    navItems.push({ path: '/admin', label: 'Admin', icon: SettingsIcon });
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-20 glass-dark shadow-strong  border-b border-white/10">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative hover-lift">
            <img src={settings?.logoUrl || logo} alt={settings?.serviceName || "Service Logo"} className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg object-contain mix-blend-luminosity opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-br from-accent/30 to-white/20 rounded-md mix-blend-overlay"></div>
          </div>
          <div>
            <h1 className="font-bold text-lg sm:text-xl text-white tracking-tight">{settings?.serviceName || 'AIU Library'}</h1>
            <p className="text-xs text-blue-200 hidden sm:block font-medium">{settings?.description || 'Room Booking System'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 relative">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-white">{user.name}</p>
            <p className="text-xs text-blue-200 font-medium flex items-center gap-1 justify-end">
              <span className={`w-2 h-2 rounded-full ${user.role === 'ADMIN' ? 'bg-accent' : 'bg-green-400'} animate-pulse`}></span>
              {user.role}
            </p>
          </div>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="group relative bg-white/10 hover:bg-white/20 rounded-md p-2 transition-all-smooth hover:shadow-glow-accent"
          >
            <UserCircleIcon className="w-7 h-7 sm:w-8 sm:h-8 text-white group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full border-2 border-primary-dark"></span>
          </button>

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-14 glass border border-white/20 rounded-lg shadow-strong py-2 min-w-[220px] z-40 animate-slide-down">
                <div className="px-4 py-3 border-b border-slate-200/50">
                  <p className="text-sm font-bold text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-500 font-medium">{user.email || `${user.role.toLowerCase()}@apiu.edu`}</p>
                </div>
                {(!user.provider || user.provider === 'LOCAL') && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onChangePassword();
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-primary/5 flex items-center gap-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <LockIcon className="w-4 h-4 text-primary" />
                    </div>
                    <span>Change Password</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                    <LogOutIcon className="w-4 h-4 text-red-600" />
                  </div>
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto pb-20 sm:pb-8 sm:ml-20 custom-scrollbar">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 min-h-full flex flex-col">
          <div className="flex-1">
            {children}
          </div>

          {/* Developer Signature */}
          <div className="mt-12 flex justify-center items-center border-t border-slate-200/30">
            <a
              href="https://rindra.org"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-primary transition-colors"
            >
              <svg className="w-3 h-3 text-slate-300 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span>Developed by <span className="font-bold group-hover:underline decoration-2 underline-offset-2">Rindra Razafinjatovo</span>. AIU 2026</span>
            </a>
          </div>
        </div>
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/20 flex justify-around py-3 pb-safe z-30 shadow-strong ">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1.5 px-4 py-2 rounded-md transition-all-smooth ${isActive
                ? 'text-primary bg-primary/10 shadow-soft'
                : 'text-slate-500 hover:text-primary hover:bg-primary/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`${isActive ? 'scale-110' : ''} transition-transform`}>
                  <item.icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : ''}`} />
                </div>
                <span className={`text-xs font-semibold ${isActive ? 'text-primary' : ''}`}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Desktop Navigation (Sidebar) */}
      <div className="hidden sm:flex fixed left-0 top-[72px] bottom-0 w-20 flex-col items-center py-6 glass border-r border-white/20 z-10 ">
        <div className="flex flex-col gap-3 w-full px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `relative p-3.5 rounded-lg transition-all-smooth group ${isActive
                  ? 'bg-primary text-white shadow-md'
                  : 'text-slate-500 hover:bg-primary/5 hover:text-primary'
                }`
              }
              title={item.label}
            >
              {({ isActive }) => (
                <>
                  <div className={`${isActive ? 'scale-110' : 'group-hover:scale-105'} transition-transform`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  {isActive && (
                    <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-l-full shadow-lg"></div>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Layout;
