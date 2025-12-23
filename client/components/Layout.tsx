import React from 'react';
import { HomeIcon, CalendarIcon, SettingsIcon, UserCircleIcon } from './Icons';
import { User, UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onNavigate: (page: string) => void;
  currentPage: string;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onNavigate, currentPage, onLogout }) => {
  const navItems = [
    { id: 'home', label: 'Rooms', icon: HomeIcon },
    { id: 'my-bookings', label: 'My Bookings', icon: CalendarIcon },
  ];

  if (user.role === UserRole.ADMIN) {
    navItems.push({ id: 'admin', label: 'Admin', icon: SettingsIcon });
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg">L</div>
           <h1 className="font-bold text-xl text-slate-800 tracking-tight">LibBook</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.role}</p>
          </div>
          <UserCircleIcon className="w-8 h-8 text-slate-400" />
          <button
            onClick={onLogout}
            className="ml-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Logout
          </button>
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
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center gap-1 ${isActive ? 'text-primary' : 'text-slate-400'}`}
            >
              <item.icon className={`w-6 h-6 ${isActive ? 'stroke-2' : ''}`} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Desktop Navigation (Sidebar-ish but simpler for this demo) */}
      <div className="hidden sm:flex fixed left-0 top-16 bottom-0 w-16 flex-col items-center py-4 bg-white border-r border-slate-200 z-10">
        {navItems.map((item) => {
           const isActive = currentPage === item.id;
           return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`p-3 mb-2 rounded-xl transition-colors ${isActive ? 'bg-indigo-50 text-primary' : 'text-slate-400 hover:bg-slate-50'}`}
              title={item.label}
            >
              <item.icon className="w-6 h-6" />
            </button>
           )
        })}
      </div>
    </div>
  );
};

export default Layout;
