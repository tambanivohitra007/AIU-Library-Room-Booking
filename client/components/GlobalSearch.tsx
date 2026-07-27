import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Room, Booking, UserRole, isGlobalAdminRole } from '../types';
import { api } from '../services/api';

interface GlobalSearchProps {
  user: User;
  rooms: Room[];
  bookings: Booking[];
}

interface SearchResult {
  key: string;
  group: string;
  label: string;
  sub?: string;
  action: () => void;
}

// Header search across rooms, own bookings and (for staff) users/departments.
// Entirely client-side: rooms/bookings are already in memory from polling.
const GlobalSearch: React.FC<GlobalSearchProps> = ({
  user,
  rooms,
  bookings,
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [allUsers, setAllUsers] = useState<User[] | null>(null);

  const isStaff =
    isGlobalAdminRole(user.role) || user.role === UserRole.STUDENT_WORKER;

  // Staff: lazily load the user list the first time the search opens
  useEffect(() => {
    if (open && isStaff && allUsers === null) {
      api
        .getUsers()
        .then(setAllUsers)
        .catch(() => setAllUsers([]));
    }
  }, [open, isStaff, allUsers]);

  // Ctrl+K / Cmd+K focuses the search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchResult[] = [];

    rooms
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.features.some((f) => f.toLowerCase().includes(q)) ||
          (r.department?.name.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 5)
      .forEach((r) =>
        out.push({
          key: `room-${r.id}`,
          group: 'Rooms',
          label: r.name,
          sub: `${r.department?.name || 'No department'} · ${r.minCapacity}–${r.maxCapacity} people`,
          action: () => navigate(`/?room=${r.id}`),
        }),
      );

    bookings
      .filter((b) => b.userId === user.id && b.status !== 'CANCELLED')
      .filter((b) => {
        const room = rooms.find((r) => r.id === b.roomId);
        const dateStr = new Date(b.startTime)
          .toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })
          .toLowerCase();
        return (
          (room?.name.toLowerCase().includes(q) ?? false) ||
          (b.purpose?.toLowerCase().includes(q) ?? false) ||
          dateStr.includes(q)
        );
      })
      .slice(0, 5)
      .forEach((b) => {
        const room = rooms.find((r) => r.id === b.roomId);
        const start = new Date(b.startTime);
        out.push({
          key: `booking-${b.id}`,
          group: 'My Bookings',
          label: `${room?.name || 'Room'} — ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          sub: b.status === 'PENDING' ? 'Pending approval' : b.purpose || undefined,
          action: () => navigate(`/my-bookings?highlight=${b.id}`),
        });
      });

    if (isStaff && allUsers) {
      allUsers
        .filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q),
        )
        .slice(0, 5)
        .forEach((u) =>
          out.push({
            key: `user-${u.id}`,
            group: 'Users',
            label: u.name,
            sub: u.email,
            action: () =>
              navigate(`/admin?tab=users&q=${encodeURIComponent(u.email)}`),
          }),
        );
    }

    if (isStaff) {
      const seen = new Set<string>();
      rooms.forEach((r) => {
        if (
          r.department &&
          !seen.has(r.department.id) &&
          r.department.name.toLowerCase().includes(q)
        ) {
          seen.add(r.department.id);
          out.push({
            key: `dept-${r.department.id}`,
            group: 'Departments',
            label: r.department.name,
            action: () => navigate('/admin?tab=departments'),
          });
        }
      });
    }

    return out;
  }, [query, rooms, bookings, allUsers, isStaff, user.id, navigate]);

  useEffect(() => setActiveIndex(0), [query]);

  const pick = (r: SearchResult) => {
    r.action();
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      pick(results[activeIndex]);
    }
  };

  // Group results for display while keeping flat indexes for keyboard nav
  const groups: { name: string; items: { r: SearchResult; index: number }[] }[] =
    [];
  results.forEach((r, index) => {
    const g = groups.find((g) => g.name === r.group);
    if (g) g.items.push({ r, index });
    else groups.push({ name: r.group, items: [{ r, index }] });
  });

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <svg
        className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onInputKeyDown}
        placeholder="Search rooms, bookings…  (Ctrl+K)"
        className="w-full h-8 bg-white/10 border border-white/20 rounded-lg pl-9 pr-3 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-1 focus:ring-white/70 focus:bg-white/15 transition-all"
      />
      {open && query.trim() && (
        <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-lg max-h-96 overflow-y-auto custom-scrollbar z-50 text-left">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">No results</div>
          ) : (
            groups.map((g) => (
              <div key={g.name}>
                <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {g.name}
                </p>
                {g.items.map(({ r, index }) => (
                  <button
                    key={r.key}
                    onClick={() => pick(r)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-slate-100 last:border-b-0 transition-colors ${
                      index === activeIndex ? 'bg-primary/5' : ''
                    }`}
                  >
                    <span className="font-medium text-slate-800">{r.label}</span>
                    {r.sub && (
                      <span className="block text-xs text-slate-500">
                        {r.sub}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
