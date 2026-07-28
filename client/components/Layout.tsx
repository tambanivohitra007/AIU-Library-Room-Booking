import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  CalendarIcon,
  SettingsIcon,
  LogOutIcon,
  LockIcon,
} from './Icons';
import { User, UserRole, Room, Booking, isGlobalAdminRole } from '../types';
import logo from '../assets/logo_small.jpg';
import { useSettings } from '../contexts/SettingsContext';
import GlobalSearch from './GlobalSearch';
import { useTranslation } from 'react-i18next';
import { setLanguage, AppLanguage } from '../i18n';
import { api } from '../services/api';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  rooms: Room[];
  bookings: Booking[];
  onLogout: () => void;
  onChangePassword: () => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  user,
  rooms,
  bookings,
  onLogout,
  onChangePassword,
}) => {
  const { settings } = useSettings();
  const { t, i18n } = useTranslation();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { path: '/', label: t('nav.rooms'), icon: HomeIcon },
    { path: '/my-bookings', label: t('nav.myBookings'), icon: CalendarIcon },
  ];

  const isDeptAdmin = (user.managedDepartmentIds?.length || 0) > 0;
  if (
    isGlobalAdminRole(user.role) ||
    user.role === UserRole.STUDENT_WORKER ||
    isDeptAdmin
  ) {
    navItems.push({ path: '/admin', label: t('nav.admin'), icon: SettingsIcon });
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="px-3 sm:px-4 py-2 flex items-center justify-between sticky top-0 z-50 glass-dark border-b border-white/10">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative hover-lift">
            <img
              src={settings?.logoUrl || logo}
              alt={settings?.serviceName || 'Service Logo'}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-contain mix-blend-luminosity opacity-90"
            />
          </div>
          <div>
            <h1 className="font-bold text-base sm:text-lg text-white tracking-tight">
              {settings?.serviceName || 'Room Booking'}
            </h1>
            <p className="text-xs text-white/80 hidden sm:block font-medium">
              {settings?.description || 'Room Booking System'}
            </p>
          </div>
        </div>

        {/* Global Search (desktop) */}
        <div className="flex-1 px-4 sm:px-8 hidden md:flex justify-center">
          <GlobalSearch user={user} rooms={rooms} bookings={bookings} />
        </div>

        <div className="flex items-center gap-2 sm:gap-4 relative">
          {/* Language switcher: shows the language you would switch TO */}
          <button
            onClick={() => {
              const next: AppLanguage = i18n.language === 'th' ? 'en' : 'th';
              setLanguage(next);
              // Save server-side so notification emails use this language too
              api.updateMyLanguage(next).catch(() => {});
            }}
            className="px-2 py-1 text-xs font-bold text-white/80 hover:text-white border border-white/30 rounded-md hover:bg-white/10 transition-colors"
            title={i18n.language === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
          >
            {i18n.language === 'th' ? 'EN' : 'ไทย'}
          </button>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-white">{user.name}</p>
            <p className="text-xs text-white/80 font-medium flex items-center gap-1 justify-end">
              <span
                className={`w-2 h-2 rounded-full ${isGlobalAdminRole(user.role) ? 'bg-accent' : 'bg-green-400'} animate-pulse`}
              ></span>
              {user.role}
            </p>
          </div>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="group relative bg-white/10 hover:bg-white/20 rounded-md p-2 transition-all-smooth "
          >
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 border border-white/30 text-white flex items-center justify-center text-xs sm:text-sm font-bold">
              {user.name
                .split(' ')
                .filter(Boolean)
                .map((p) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </span>
          </button>

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-14 glass border border-slate-200 rounded-lg py-2 min-w-[220px] z-40 animate-slide-down">
                <div className="px-4 py-3 border-b border-slate-200">
                  <p className="text-sm font-bold text-slate-800">
                    {user.name}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    {user.email || user.role.toLowerCase()}
                  </p>
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
                    <span>{t('nav.changePassword')}</span>
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
                  <span>{t('nav.signOut')}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto pb-20 sm:pb-8 sm:ml-20 custom-scrollbar">
        <div className="w-full p-3 sm:p-4 min-h-full flex flex-col">
          <div className="flex-1">{children}</div>

          {/* Developer signature - intentionally unobtrusive */}
          <div className="mt-6 py-2 flex justify-center">
            <a
              href="https://rindra.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-slate-300 hover:text-slate-500 transition-colors"
            >
              Developed by Rindra Razafinjatovo · 2026
            </a>
          </div>
        </div>
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 glass border-t border-slate-200 flex justify-around py-3 pb-safe z-30  ">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1.5 px-4 py-2 rounded-md transition-all-smooth ${
                isActive
                  ? 'text-primary bg-primary/10 '
                  : 'text-slate-500 hover:text-primary hover:bg-primary/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`${isActive ? '' : ''} transition-transform`}>
                  <item.icon
                    className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : ''}`}
                  />
                </div>
                <span
                  className={`text-xs font-semibold ${isActive ? 'text-primary' : ''}`}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Desktop Navigation (Sidebar) */}
      <div className="hidden sm:flex fixed left-0 top-[56px] bottom-0 w-20 flex-col items-center py-6 glass border-r border-slate-200 z-10 ">
        <div className="flex flex-col gap-3 w-full px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `relative p-3.5 rounded-lg transition-all-smooth group ${
                  isActive
                    ? 'bg-primary text-white '
                    : 'text-slate-500 hover:bg-primary/5 hover:text-primary'
                }`
              }
              title={item.label}
            >
              {({ isActive }) => (
                <>
                  <div className={`${isActive ? '' : ''} transition-transform`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  {isActive && (
                    <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-l-full "></div>
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
