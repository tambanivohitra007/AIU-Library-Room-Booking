import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, CalendarIcon, SettingsIcon, UserCircleIcon, LogOutIcon, LockIcon } from './Icons';
import { User, UserRole } from '../types';
import logo from '../assets/logo_small.jpg';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  onChangePassword: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, onChangePassword }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { path: '/', label: 'Rooms', icon: HomeIcon },
    { path: '/my-bookings', label: 'My Bookings', icon: CalendarIcon },
  ];

  if (user.role === UserRole.ADMIN) {
    navItems.push({ path: '/admin', label: 'Admin', icon: SettingsIcon });
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-md" style={{ backgroundColor: '#17365f' }}>
        <div className="flex items-center gap-3">
           <img src={logo} alt="AIU Logo" className="w-10 h-10 rounded-lg" />
           <h1 className="font-bold text-xl text-white tracking-tight">AIU Library Room Booking</h1>
        </div>
        <div className="flex items-center gap-3 relative">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-slate-300">{user.role}</p>
          </div>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="hover:bg-white/10 rounded-full p-1 transition-colors"
          >
            <UserCircleIcon className="w-8 h-8 text-white" />
          </button>

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-12 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[200px] z-40">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onChangePassword();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <LockIcon className="w-4 h-4" />
                  Change Password
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOutIcon className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto pb-20 sm:pb-8">
        <div className="max-w-4xl mx-auto p-4">
          {children}
        </div>
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around py-3 pb-safe z-30 shadow-lg">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 ${isActive ? 'text-primary' : 'text-slate-400'}`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-6 h-6 ${isActive ? 'stroke-2' : ''}`} />
                <span className="text-xs font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={onLogout}
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-red-500"
        >
          <LogOutIcon className="w-6 h-6" />
          <span className="text-xs font-medium">Logout</span>
        </button>
      </nav>

      {/* Desktop Navigation (Sidebar-ish but simpler for this demo) */}
      <div className="hidden sm:flex fixed left-0 top-16 bottom-0 w-16 flex-col items-center py-4 bg-white border-r border-slate-200 z-10">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `p-3 mb-2 rounded-xl transition-colors ${isActive ? 'bg-indigo-50 text-primary' : 'text-slate-400 hover:bg-slate-50'}`
            }
            title={item.label}
          >
            <item.icon className="w-6 h-6" />
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export default Layout;
