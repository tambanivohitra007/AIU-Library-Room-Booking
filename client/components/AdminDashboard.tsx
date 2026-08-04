import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { dateLocale } from '../i18n';
import { User, Room, Booking, UserRole, isGlobalAdminRole } from '../types';
import { api } from '../services/api';
import {
  BarChartIcon,
  CalendarIcon,
  UsersIcon,
  BuildingIcon,
  SettingsIcon,
} from './Icons';
import UserImportModal from './UserImportModal';
import AddUserModal from './AddUserModal';
import EditUserModal from './EditUserModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import AddRoomModal from './AddRoomModal';
import EditRoomModal from './EditRoomModal';
import RoomDetailsModal from './RoomDetailsModal';
import SemestersManager from './SemestersManager';
import DepartmentsManager from './DepartmentsManager';
import ClosuresManager from './ClosuresManager';
import AuditLogViewer from './AuditLogViewer';
import AttendeesModal from './AttendeesModal';
import DataTable from './DataTable';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { ColumnDef } from '@tanstack/react-table';
import { parseOperatingHoursOrNull } from '../utils/operatingHours';

import ExportReportModal from './ExportReportModal';
import SettingsTab from './SettingsTab';

interface AdminDashboardProps {
  currentUser: User;
  bookings: Booking[];
  rooms: Room[];
  onExportCSV: () => void;
  onCancelBooking: (id: string) => void;
  onRefresh: () => void;
}

interface Stats {
  totalBookings: number;
  activeBookings: number;
  totalUsers: number;
  roomUtilization: { [key: string]: number };
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  bookings: allBookings,
  rooms: allRooms,
  onExportCSV,
  onCancelBooking,
  onRefresh,
}) => {
  const toast = useToast();
  const { t } = useTranslation();
  const isAdmin = isGlobalAdminRole(currentUser.role);
  const isSuperAdmin = currentUser.role === UserRole.SUPERADMIN;
  const managedDeptIds = currentUser.managedDepartmentIds || [];
  // A department admin without a global staff role only sees their departments' data
  const isDeptAdminOnly =
    !isAdmin &&
    currentUser.role !== UserRole.STUDENT_WORKER &&
    managedDeptIds.length > 0;

  const rooms = useMemo(
    () =>
      isDeptAdminOnly
        ? allRooms.filter(
            (r) => r.departmentId && managedDeptIds.includes(r.departmentId),
          )
        : allRooms,
    [allRooms, isDeptAdminOnly, currentUser],
  );
  const bookings = useMemo(() => {
    if (!isDeptAdminOnly) return allBookings;
    const roomIds = new Set(rooms.map((r) => r.id));
    return allBookings.filter((b) => roomIds.has(b.roomId));
  }, [allBookings, rooms, isDeptAdminOnly]);

  // Rooms grouped by department for the Rooms tab; unassigned rooms last
  // Rooms tab search: matches name, description, features, department
  const [roomsFilter, setRoomsFilter] = useState('');
  const filteredAdminRooms = useMemo(() => {
    const q = roomsFilter.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.features.some((f) => f.toLowerCase().includes(q)) ||
        (r.department?.name.toLowerCase().includes(q) ?? false),
    );
  }, [rooms, roomsFilter]);

  const roomGroups = useMemo(() => {
    const groups = new Map<string, { name: string; rooms: Room[] }>();
    for (const room of filteredAdminRooms) {
      const key = room.departmentId || 'none';
      const name = room.department?.name || t('roomDetails.noDepartment');
      if (!groups.has(key)) groups.set(key, { name, rooms: [] });
      groups.get(key)!.rooms.push(room);
    }
    return Array.from(groups.entries())
      .map(([key, g]) => ({ key, ...g }))
      .sort((a, b) =>
        a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.name.localeCompare(b.name)
      );
  }, [filteredAdminRooms, t]);
  const hasDepartmentGroups = roomGroups.some((g) => g.key !== 'none');

  // Cards read well for a handful of rooms; the table scans and sorts across all
  // of them and surfaces the policy fields the cards leave out. Remembered per
  // device, like the UI language.
  const [roomsView, setRoomsView] = useState<'cards' | 'table'>(() =>
    localStorage.getItem('adminRoomsView') === 'table' ? 'table' : 'cards',
  );
  const changeRoomsView = (v: 'cards' | 'table') => {
    setRoomsView(v);
    localStorage.setItem('adminRoomsView', v);
  };

  // Which tier of the room -> department -> global schedule chain applies
  const roomScheduleSource = (room: Room): string => {
    if (parseOperatingHoursOrNull(room.operatingHours)) {
      return t('admin.roomsTable.hoursCustom');
    }
    if (parseOperatingHoursOrNull(room.department?.operatingHours)) {
      return t('admin.roomsTable.hoursDepartment');
    }
    return t('admin.roomsTable.hoursGlobal');
  };

  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTab, setSelectedTab] = useState<
    | 'overview'
    | 'bookings'
    | 'users'
    | 'rooms'
    | 'departments'
    | 'semesters'
    | 'closures'
    | 'audit'
    | 'settings'
  >(isDeptAdminOnly ? 'bookings' : 'overview');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRoom, setFilterRoom] = useState<string>('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [usersFilter, setUsersFilter] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Room management state
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);
  const [viewingRoom, setViewingRoom] = useState<Room | null>(null);

  // Attendees modal state
  const [viewingAttendeesBooking, setViewingAttendeesBooking] =
    useState<Booking | null>(null);

  const handleRemind = async (bookingId: string) => {
    try {
      await api.remindBooking(bookingId);
      toast.success(t('admin.toasts.reminderSent'));
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.toasts.reminderFailed');
      toast.error(errorMessage);
    }
  };

  const handleApprove = async (bookingId: string) => {
    try {
      await api.approveBooking(bookingId);
      toast.success(t('admin.toasts.bookingApproved'));
      onRefresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('admin.toasts.approveFailed'),
      );
    }
  };

  const handleReject = async (bookingId: string) => {
    const reason = window.prompt(t('admin.rejectReasonPrompt'));
    if (reason === null) return; // user cancelled the prompt
    try {
      await api.rejectBooking(bookingId, reason.trim() || undefined);
      toast.success(t('admin.toasts.bookingRejected'));
      onRefresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('admin.toasts.rejectFailed'),
      );
    }
  };

  useEffect(() => {
    // Stats and user management endpoints are admin/worker only
    if (!isDeptAdminOnly) {
      loadStats();
      loadUsers();
    }
  }, [bookings]);

  // Column definitions for bookings table
  /**
   * A memoized configuration array for the data table columns used to display booking information.
   *
   * This configuration defines the structure, headers, and rendering logic for each column:
   * - **Room**: Displays the name of the room associated with the booking ID.
   * - **User**: Shows the user's display name and their ID/Email.
   * - **Date & Time**: Formats the start/end times and dates into a readable string.
   * - **Attendees**: Renders an interactive badge showing the count of attendees; clicking opens a details view.
   * - **Status**: Renders a color-coded badge based on the booking status (CONFIRMED, CANCELLED, etc.).
   * - **Actions**: Provides action buttons (Remind, Cancel) for bookings with a 'CONFIRMED' status.
   *
   * @returns {ColumnDef<Booking>[]} An array of column definitions for the tanstack/react-table.
   *
   * @dependencies
   * - `rooms`: Used to look up room names by ID.
   * - `onCancelBooking`: Callback function triggered when the cancel button is clicked.
   * - `handleRemind`: Callback function triggered when the remind button is clicked.
   */
  const bookingColumns = useMemo<ColumnDef<Booking>[]>(
    () => [
      {
        accessorKey: 'roomId',
        header: t('admin.columns.room'),
        cell: ({ row }) => (
          <span className="font-semibold text-slate-800">
            {rooms.find((r) => r.id === row.original.roomId)?.name}
          </span>
        ),
      },
      {
        accessorKey: 'userDisplay',
        header: t('admin.columns.user'),
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-slate-800">
              {row.original.userDisplay}
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {row.original.userEmail || row.original.userId}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'startTime',
        header: t('admin.columns.dateTime'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-slate-800">
              {new Date(row.original.startTime).toLocaleDateString(
                dateLocale(),
                {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                },
              )}
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {new Date(row.original.startTime).toLocaleTimeString(
                dateLocale(),
                {
                  hour: '2-digit',
                  minute: '2-digit',
                },
              )}{' '}
              -
              {new Date(row.original.endTime).toLocaleTimeString(dateLocale(), {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'attendees',
        header: t('admin.columns.attendees'),
        enableSorting: false,
        cell: ({ row }) => (
          <button
            onClick={() => setViewingAttendeesBooking(row.original)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-md transition-colors cursor-pointer group "
            title={t('admin.viewAttendees')}
          >
            <svg
              className="w-4 h-4 text-primary transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <span className="text-sm font-bold text-primary">
              {row.original.attendees.length}
            </span>
          </button>
        ),
      },
      {
        accessorKey: 'status',
        header: t('admin.columns.status'),
        cell: ({ row }) => (
          <span
            className={`px-3 py-1 rounded-lg text-xs font-bold  ${
              row.original.status === 'CONFIRMED'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : row.original.status === 'PENDING'
                  ? 'bg-amber-50 border border-amber-200 text-amber-700'
                  : row.original.status === 'CANCELLED'
                    ? 'bg-red-50 border border-red-200 text-red-700'
                    : 'bg-slate-50 border border-slate-200 text-slate-700'
            }`}
          >
            {t(`status.${row.original.status}`)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('admin.columns.actions'),
        enableSorting: false,
        cell: ({ row }) => {
          if (row.original.status === 'PENDING') {
            return (
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(row.original.id)}
                  className="px-3 py-1.5 bg-green-50 hover:bg-green-500 border border-green-200 hover:border-green-500 text-green-600 hover:text-white font-bold rounded-lg transition-all-smooth shadow-sm "
                >
                  {t('admin.approve')}
                </button>
                <button
                  onClick={() => handleReject(row.original.id)}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-600 hover:text-white font-bold rounded-lg transition-all-smooth shadow-sm "
                >
                  {t('admin.reject')}
                </button>
              </div>
            );
          }
          if (row.original.status === 'CONFIRMED') {
            return (
              <div className="flex gap-2">
                <button
                  onClick={() => handleRemind(row.original.id)}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary border border-primary/20 hover:border-primary text-primary hover:text-white font-bold rounded-lg transition-all-smooth shadow-sm "
                  title={t('admin.remindTooltip')}
                >
                  {t('admin.remind')}
                </button>
                <button
                  onClick={() => onCancelBooking(row.original.id)}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-600 hover:text-white font-bold rounded-lg transition-all-smooth shadow-sm "
                >
                  {t('common.cancel')}
                </button>
              </div>
            );
          }
          return null;
        },
      },
    ],
    [rooms, onCancelBooking, handleRemind, handleApprove, handleReject, t],
  );

  // Column definitions for users table
  const userColumns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('admin.columns.name'),
        cell: ({ row }) => (
          <span className="font-semibold text-slate-800">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: 'email',
        header: t('admin.columns.email'),
        cell: ({ row }) => (
          <span className="text-slate-600 font-medium">
            {row.original.email}
          </span>
        ),
      },
      {
        accessorKey: 'role',
        header: t('admin.columns.role'),
        cell: ({ row }) => {
          // Managing a department is a grant, not a role, so it never shows in
          // `role` - surface it beside the role or it is invisible here.
          const depts = row.original.managedDepartments || [];
          return (
            <div className="flex flex-wrap items-center gap-1">
              <span
                className={`px-3 py-1 rounded-lg text-xs font-bold  ${
                  ['ADMIN', 'SUPERADMIN'].includes(row.original.role)
                    ? 'bg-purple-50 border border-purple-200 text-purple-700'
                    : 'bg-primary/10 border border-primary/20 text-primary'
                }`}
              >
                {t(`admin.roles.${row.original.role}`)}
              </span>
              {depts.length > 0 && (
                <span
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-teal-50 border border-teal-200 text-teal-700"
                  title={t('admin.deptAdminManages', {
                    names: depts.map((d) => d.name).join(', '),
                  })}
                >
                  {t('admin.deptAdminBadge')}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: t('admin.columns.status'),
        cell: ({ row }) => (
          <span
            className={`px-3 py-1 rounded-lg text-xs font-bold  ${
              row.original.status === 'ACTIVE'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : row.original.status === 'PENDING'
                  ? 'bg-amber-50 border border-amber-200 text-amber-700'
                  : 'bg-slate-50 border border-slate-200 text-slate-700'
            }`}
          >
            {t(`admin.userStatus.${row.original.status || 'ACTIVE'}`)}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: t('admin.columns.joined'),
        cell: ({ row }) => (
          <span className="text-slate-600 font-medium">
            {new Date(row.original.createdAt).toLocaleDateString(dateLocale(), {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('admin.columns.actions'),
        enableSorting: false,
        cell: ({ row }) =>
          isAdmin ? (
            <div className="flex gap-2">
              {row.original.status === 'PENDING' && (
                <button
                  onClick={() => handleApproveUser(row.original)}
                  className="px-3 py-1.5 bg-green-50 hover:bg-green-500 border border-green-200 hover:border-green-500 text-green-600 hover:text-white font-bold rounded-lg transition-all-smooth shadow-sm "
                >
                  {t('admin.approve')}
                </button>
              )}
              <button
                onClick={() => setEditingUser(row.original)}
                className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-lg font-bold text-sm transition-all-smooth "
              >
                {t('admin.edit')}
              </button>
              <button
                onClick={() => setDeletingUser(row.original)}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-600 hover:text-white font-bold rounded-lg transition-all-smooth shadow-sm "
              >
                {t('admin.delete')}
              </button>
            </div>
          ) : null,
      },
    ],
    [isAdmin, t],
  );

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    setIsDeleting(true);
    try {
      await api.deleteUser(deletingUser.id);
      setDeletingUser(null);
      loadUsers();
      onRefresh();
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert(t('admin.toasts.deleteUserFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApproveUser = async (user: User) => {
    try {
      await api.updateUser(user.id, { status: 'ACTIVE' });
      toast.success(t('admin.toasts.userApproved', { name: user.name }));
      loadUsers();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.toasts.approveUserFailed');
      toast.error(errorMessage);
    }
  };

  const handleDeleteRoom = async () => {
    if (!deletingRoom) return;

    setIsDeleting(true);
    try {
      await api.deleteRoom(deletingRoom.id);
      toast.success(t('admin.toasts.roomDeleted'));
      setDeletingRoom(null);
      onRefresh();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('admin.toasts.deleteRoomFailed');
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const loadStats = () => {
    const now = new Date();
    const activeBookings = bookings.filter(
      (b) =>
        b.status === 'CONFIRMED' &&
        new Date(b.endTime) > now &&
        new Date(b.startTime) <= now,
    );

    const roomUtilization: { [key: string]: number } = {};
    rooms.forEach((room) => {
      const roomBookings = bookings.filter(
        (b) => b.roomId === room.id && b.status === 'CONFIRMED',
      );
      roomUtilization[room.id] = roomBookings.length;
    });

    setStats({
      totalBookings: bookings.length,
      activeBookings: activeBookings.length,
      totalUsers: 0, // Will be updated when users load
      roomUtilization,
    });
  };

  const loadUsers = async () => {
    try {
      const allUsers = await api.getUsers();
      // Sort users: PENDING first, then by createdAt desc
      const sortedUsers = [...allUsers].sort((a, b) => {
        if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
        if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
      setUsers(sortedUsers);
      setStats((prev) =>
        prev ? { ...prev, totalUsers: allUsers.length } : null,
      );
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  // A PENDING request auto-cancels once its start time passes, so the approval
  // queue is the one thing here with a deadline. Count it separately to drive
  // the banner and the tab badge.
  const pendingCount = useMemo(
    () => bookings.filter((b) => b.status === 'PENDING').length,
    [bookings],
  );

  const filteredBookings = useMemo(() => {
    const visible = bookings.filter((b) => {
      if (filterStatus !== 'all' && b.status !== filterStatus) return false;
      if (filterRoom !== 'all' && b.roomId !== filterRoom) return false;
      return true;
    });
    // The API returns every booking by startTime ascending, which buries a new
    // request behind months of finished ones. Float pending to the top - soonest
    // first, since that one runs out of time first - and leave the rest as-is.
    return visible.sort((a, b) => {
      const aPending = a.status === 'PENDING' ? 0 : 1;
      const bPending = b.status === 'PENDING' ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return (
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    });
  }, [bookings, filterStatus, filterRoom]);

  const renderOverview = () => (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass rounded-lg border border-slate-200 p-5 sm:p-6 transition-all-smooth hover-lift animate-slide-up">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs sm:text-sm font-semibold text-slate-500">
                {t('admin.stats.totalBookings')}
              </p>
              <p className="text-2xl sm:text-3xl font-bold gradient-text mt-2">
                {stats?.totalBookings || 0}
              </p>
            </div>
            <svg
              className="w-10 h-10 sm:w-12 sm:h-12 text-primary shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>

        <div
          className="glass rounded-lg border border-slate-200 p-5 sm:p-6 transition-all-smooth hover-lift animate-slide-up"
          style={{ animationDelay: '0.05s' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs sm:text-sm font-semibold text-slate-500">
                {t('admin.stats.activeNow')}
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-2 flex items-center gap-2">
                {stats?.activeBookings || 0}
                {(stats?.activeBookings || 0) > 0 && (
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                )}
              </p>
            </div>
            <svg
              className="w-10 h-10 sm:w-12 sm:h-12 text-green-600 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        <div
          className="glass rounded-lg border border-slate-200 p-5 sm:p-6 transition-all-smooth hover-lift animate-slide-up"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs sm:text-sm font-semibold text-slate-500">
                {t('admin.stats.totalUsers')}
              </p>
              <p className="text-2xl sm:text-3xl font-bold gradient-text mt-2">
                {stats?.totalUsers || 0}
              </p>
            </div>
            <svg
              className="w-10 h-10 sm:w-12 sm:h-12 text-primary shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
        </div>

        <div
          className="glass rounded-lg border border-slate-200 p-5 sm:p-6 transition-all-smooth hover-lift animate-slide-up"
          style={{ animationDelay: '0.15s' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs sm:text-sm font-semibold text-slate-500">
                {t('admin.stats.totalRooms')}
              </p>
              <p className="text-2xl sm:text-3xl font-bold gradient-text mt-2">
                {rooms.length}
              </p>
            </div>
            <svg
              className="w-10 h-10 sm:w-12 sm:h-12 text-purple-600 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Room Utilization */}
      <div className="glass rounded-lg border border-slate-200 p-5 sm:p-6 animate-slide-up">
        <h3 className="text-base sm:text-lg font-bold gradient-text mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          {t('admin.roomUtilization')}
        </h3>
        <div className="space-y-3 sm:space-y-4">
          {rooms.map((room) => {
            const utilization = stats?.roomUtilization[room.id] || 0;
            const percentage = Math.min((utilization / 20) * 100, 100); // Assuming 20 is max
            return (
              <div key={room.id}>
                <div className="flex justify-between text-xs sm:text-sm mb-2">
                  <span className="font-semibold text-slate-700">
                    {room.name}
                  </span>
                  <span className="px-2 py-0.5 bg-primary/10 rounded-lg text-primary text-xs font-bold">
                    {t('admin.bookingsCount', { count: utilization })}
                  </span>
                </div>
                <div className="w-full bg-slate-200/50 rounded-full h-2.5 overflow-hidden shadow-inner">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all-smooth "
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass rounded-lg border border-slate-200 p-5 sm:p-6 animate-slide-up">
        <h3 className="text-base sm:text-lg font-bold gradient-text mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {t('admin.recentBookings')}
        </h3>
        <div className="space-y-2 sm:space-y-3">
          {bookings.slice(0, 5).map((booking, idx) => (
            <div
              key={booking.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 py-3 border-b border-slate-200 last:border-0 hover:bg-primary/5 rounded-lg px-2 transition-colors"
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">
                  {booking.userDisplay}
                </p>
                <p className="text-xs sm:text-sm text-slate-500 font-medium flex items-center gap-1 flex-wrap mt-1">
                  <span className="flex items-center gap-1">
                    <svg
                      className="w-3 h-3 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                    {rooms.find((r) => r.id === booking.roomId)?.name}
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span className="flex items-center gap-1">
                    <svg
                      className="w-3 h-3 text-accent"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {new Date(booking.startTime).toLocaleDateString(
                      dateLocale(),
                      {
                        month: 'short',
                        day: 'numeric',
                      },
                    )}
                  </span>
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-bold self-start sm:self-auto ${
                  booking.status === 'CONFIRMED'
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                {t(`status.${booking.status}`)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderBookings = () => (
    <div className="space-y-3 sm:space-y-4 animate-fade-in">
      {/* Approval queue: only rendered when something is actually waiting, so it
          stays a signal rather than permanent furniture */}
      {pendingCount > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between animate-slide-up">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <div>
              <p className="font-bold text-amber-900">
                {t('admin.pendingBanner.title', { count: pendingCount })}
              </p>
              <p className="text-sm text-amber-800">
                {t('admin.pendingBanner.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={() =>
              setFilterStatus(filterStatus === 'PENDING' ? 'all' : 'PENDING')
            }
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-bold text-sm transition-all-smooth shadow-sm shrink-0"
          >
            {filterStatus === 'PENDING'
              ? t('admin.pendingBanner.showAll')
              : t('admin.pendingBanner.reviewNow')}
          </button>
        </div>
      )}

      {/* Additional Filters */}
      <div className="glass rounded-lg border border-slate-200 p-4 ">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <div className="flex flex-wrap gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all-smooth font-medium "
            >
              <option value="all">{t('admin.filters.allStatus')}</option>
              <option value="PENDING">{t('status.PENDING')}</option>
              <option value="CONFIRMED">{t('status.CONFIRMED')}</option>
              <option value="CANCELLED">{t('status.CANCELLED')}</option>
              <option value="COMPLETED">{t('status.COMPLETED')}</option>
            </select>
            <select
              value={filterRoom}
              onChange={(e) => setFilterRoom(e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all-smooth font-medium "
            >
              <option value="all">{t('admin.filters.allRooms')}</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={onExportCSV}
            className="px-4 py-2.5 bg-primary hover:bg-primary-light text-white rounded-md font-bold transition-all-smooth shadow-sm flex items-center justify-center gap-2 group"
          >
            <svg
              className="w-4 h-4 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {t('admin.exportCSV')}
          </button>
        </div>
      </div>

      {/* Desktop Table with DataTable */}
      <div className="hidden lg:block">
        <DataTable
          data={filteredBookings}
          columns={bookingColumns}
          searchPlaceholder={t('admin.searchBookings')}
          emptyMessage={t('admin.noBookingsFound')}
          emptyIcon={
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          }
        />
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {filteredBookings.length === 0 ? (
          <div className="glass rounded-lg border border-slate-200 p-12 text-center ">
            <svg
              className="w-14 h-14 mx-auto mb-4 text-slate-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-slate-500 font-semibold">
              {t('admin.noBookingsFound')}
            </p>
          </div>
        ) : (
          filteredBookings.map((booking, idx) => (
            <div
              key={booking.id}
              className={`glass rounded-lg border p-4 transition-all-smooth animate-slide-up ${
                booking.status === 'PENDING'
                  ? 'border-amber-300 ring-1 ring-amber-200'
                  : 'border-slate-200'
              }`}
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      className="w-8 h-8 text-primary flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 truncate">
                        {rooms.find((r) => r.id === booking.roomId)?.name}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium truncate">
                        {booking.userDisplay}
                      </p>
                    </div>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex-shrink-0 ${
                    booking.status === 'CONFIRMED'
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : booking.status === 'PENDING'
                        ? 'bg-amber-50 border border-amber-200 text-amber-700'
                        : booking.status === 'CANCELLED'
                          ? 'bg-red-50 border border-red-200 text-red-700'
                          : 'bg-slate-50 border border-slate-200 text-slate-700'
                  }`}
                >
                  {t(`status.${booking.status}`)}
                </span>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-sm">
                  <svg
                    className="w-4 h-4 text-accent flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="font-semibold text-slate-700">
                    {new Date(booking.startTime).toLocaleDateString(
                      dateLocale(),
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg
                    className="w-4 h-4 text-primary flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-slate-600 font-medium">
                    {new Date(booking.startTime).toLocaleTimeString(
                      dateLocale(),
                      {
                        hour: '2-digit',
                        minute: '2-digit',
                      },
                    )}{' '}
                    -
                    {new Date(booking.endTime).toLocaleTimeString(
                      dateLocale(),
                      {
                        hour: '2-digit',
                        minute: '2-digit',
                      },
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
                <button
                  onClick={() => setViewingAttendeesBooking(booking)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-md transition-colors group "
                >
                  <svg
                    className="w-4 h-4 text-primary transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  <span className="text-sm font-bold text-primary">
                    {t('admin.attendeesCount', {
                      count: booking.attendees.length,
                    })}
                  </span>
                </button>
                {booking.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleApprove(booking.id)}
                      className="flex-1 px-3 py-2 bg-green-50 hover:bg-green-500 border border-green-200 hover:border-green-500 text-green-600 hover:text-white font-bold rounded-md transition-all-smooth shadow-sm "
                    >
                      {t('admin.approve')}
                    </button>
                    <button
                      onClick={() => handleReject(booking.id)}
                      className="flex-1 px-3 py-2 bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-600 hover:text-white font-bold rounded-md transition-all-smooth shadow-sm "
                    >
                      {t('admin.reject')}
                    </button>
                  </>
                )}
                {booking.status === 'CONFIRMED' && (
                  <button
                    onClick={() => onCancelBooking(booking.id)}
                    className="flex-1 px-3 py-2 bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-600 hover:text-white font-bold rounded-md transition-all-smooth shadow-sm "
                  >
                    {t('common.cancel')}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Attendees Modal */}
      {viewingAttendeesBooking && (
        <AttendeesModal
          booking={viewingAttendeesBooking}
          onClose={() => setViewingAttendeesBooking(null)}
        />
      )}
    </div>
  );

  const renderUsers = () => (
    <>
      <div className="space-y-4 animate-fade-in">
        {/* Header with Action Buttons */}
        <div className="glass rounded-lg border border-slate-200 p-4 ">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-base sm:text-lg font-bold gradient-text flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              {t('admin.userManagement')}
            </h3>
            {isAdmin && (
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex-1 sm:flex-none px-3 py-2 glass hover:bg-white/80 border border-slate-200 text-slate-700 rounded-md font-bold text-sm transition-all-smooth flex items-center justify-center gap-2 group"
                >
                  <svg
                    className="w-4 h-4 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <span className="hidden sm:inline">{t('admin.import')}</span>
                </button>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="flex-1 sm:flex-none px-3 py-2 bg-primary-dark hover:bg-primary text-white rounded-md font-bold text-sm transition-all-smooth shadow-sm flex items-center justify-center gap-2 group"
                >
                  <svg
                    className="w-4 h-4 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  {t('admin.addUser')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Table with DataTable */}
        <div className="hidden lg:block">
          <DataTable
            data={users}
            columns={userColumns}
            searchPlaceholder={t('admin.searchUsers')}
            initialFilter={usersFilter}
            emptyMessage={t('admin.noUsersFound')}
            emptyIcon={
              <svg
                className="w-8 h-8 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            }
          />
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-3">
          {users.length === 0 ? (
            <div className="glass rounded-lg border border-slate-200 p-12 text-center ">
              <svg
                className="w-14 h-14 mx-auto mb-4 text-slate-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <p className="text-slate-500 font-semibold">
                {t('admin.noUsersFound')}
              </p>
            </div>
          ) : (
            users.map((user, idx) => (
              <div
                key={user.id}
                className="glass rounded-lg border border-slate-200 p-4 transition-all-smooth animate-slide-up"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <svg
                      className="w-9 h-9 text-primary flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 truncate">
                        {user.name}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold flex-shrink-0 ${
                        user.role === 'ADMIN'
                          ? 'bg-purple-50 border border-purple-200 text-purple-700'
                          : 'bg-primary/10 border border-primary/20 text-primary'
                      }`}
                    >
                      {t(`admin.roles.${user.role}`)}
                    </span>
                    {(user.managedDepartments?.length || 0) > 0 && (
                      <span
                        className="px-3 py-1 rounded-lg text-xs font-bold flex-shrink-0 bg-teal-50 border border-teal-200 text-teal-700"
                        title={t('admin.deptAdminManages', {
                          names: (user.managedDepartments || [])
                            .map((d) => d.name)
                            .join(', '),
                        })}
                      >
                        {t('admin.deptAdminBadge')}
                      </span>
                    )}
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold flex-shrink-0 ${
                        user.status === 'ACTIVE'
                          ? 'bg-green-50 border border-green-200 text-green-700'
                          : user.status === 'PENDING'
                            ? 'bg-amber-50 border border-amber-200 text-amber-700'
                            : 'bg-slate-50 border border-slate-200 text-slate-700'
                      }`}
                    >
                      {t(`admin.userStatus.${user.status || 'ACTIVE'}`)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm mb-3">
                  <svg
                    className="w-4 h-4 text-accent flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-slate-600 font-semibold">
                    {t('admin.joinedOn', {
                      date: new Date(user.createdAt).toLocaleDateString(
                        dateLocale(),
                      ),
                    })}
                  </span>
                </div>

                {isAdmin && (
                  <div className="flex gap-2 pt-3 border-t border-slate-200">
                    {user.status === 'PENDING' && (
                      <button
                        onClick={() => handleApproveUser(user)}
                        className="flex-1 px-4 py-2.5 bg-green-50 hover:bg-green-500 border border-green-200 hover:border-green-500 text-green-600 hover:text-white rounded-md font-bold text-sm transition-all-smooth flex items-center justify-center gap-2 group"
                      >
                        <svg
                          className="w-4 h-4 transition-transform"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {t('admin.approve')}
                      </button>
                    )}
                    <button
                      onClick={() => setEditingUser(user)}
                      className="flex-1 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-md font-bold text-sm transition-all-smooth flex items-center justify-center gap-2 group"
                    >
                      <svg
                        className="w-4 h-4 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      {t('admin.edit')}
                    </button>
                    <button
                      onClick={() => setDeletingUser(user)}
                      className="flex-1 px-4 py-2.5 bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-600 hover:text-white font-bold rounded-md transition-all-smooth flex items-center justify-center gap-2 group"
                    >
                      <svg
                        className="w-4 h-4 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      {t('admin.delete')}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      {showImportModal && (
        <UserImportModal
          onClose={() => setShowImportModal(false)}
          onImportSuccess={() => {
            loadUsers();
            onRefresh();
          }}
        />
      )}
      {showAddUserModal && (
        <AddUserModal
          onClose={() => setShowAddUserModal(false)}
          onSuccess={() => {
            loadUsers();
            onRefresh();
          }}
        />
      )}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            loadUsers();
            onRefresh();
          }}
        />
      )}
      {deletingUser && (
        <ConfirmDeleteModal
          title={t('admin.deleteUser')}
          message={t('admin.deleteUserConfirm', { name: deletingUser.name })}
          confirmText={t('admin.delete')}
          onConfirm={handleDeleteUser}
          onCancel={() => setDeletingUser(null)}
          isLoading={isDeleting}
        />
      )}
    </>
  );

  const renderRoomCard = (room: Room, idx: number) => (
    <div
      key={room.id}
      className="glass rounded-lg border border-slate-200 p-4 sm:p-5 transition-all-smooth hover-lift animate-slide-up"
      style={{ animationDelay: `${idx * 0.05}s` }}
    >
      <div className="flex justify-between items-start mb-3 gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <svg
            className="w-9 h-9 text-primary flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-slate-800 text-base sm:text-lg truncate">
              {room.name}
            </h4>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium line-clamp-2">
              {room.description}
            </p>
          </div>
        </div>
        <span className="px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-md text-xs font-bold text-primary flex-shrink-0 flex items-center gap-1">
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          {room.minCapacity}-{room.maxCapacity}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {room.features.map((feature, fIdx) => (
          <span
            key={fIdx}
            className="px-3 py-1 bg-indigo-50 border border-indigo-200/50 text-indigo-700 rounded-md text-xs font-bold"
          >
            {feature}
          </span>
        ))}
      </div>
      <div className="flex gap-2 pt-3 border-t border-slate-200">
        <button
          onClick={() => setViewingRoom(room)}
          className="flex-1 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-md font-bold text-sm transition-all-smooth flex items-center justify-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          {t('admin.view')}
        </button>
        {(isAdmin || isDeptAdminOnly) && (
          <>
          <button
            onClick={() => setEditingRoom(room)}
            className="flex-1 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-md font-bold text-sm transition-all-smooth flex items-center justify-center gap-2 group"
          >
            <svg
              className="w-4 h-4 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            {t('admin.edit')}
          </button>
          <button
            onClick={() => setDeletingRoom(room)}
            className="flex-1 px-4 py-2.5 bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-600 hover:text-white font-bold rounded-md transition-all-smooth flex items-center justify-center gap-2 group"
          >
            <svg
              className="w-4 h-4 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            {t('admin.delete')}
          </button>
          </>
        )}
      </div>
    </div>
  );

  const roomTableColumns = useMemo<ColumnDef<Room, any>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('admin.columns.room'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-bold text-slate-800 truncate">
              {row.original.name}
            </p>
            <p className="text-xs text-slate-500 truncate max-w-xs">
              {row.original.description}
            </p>
          </div>
        ),
      },
      {
        id: 'department',
        accessorFn: (r) => r.department?.name ?? '',
        header: t('roomForm.department'),
        cell: ({ row }) =>
          row.original.department?.name ? (
            <span className="text-sm text-slate-700">
              {row.original.department.name}
            </span>
          ) : (
            <span className="text-xs text-slate-400 italic">
              {t('roomDetails.noDepartment')}
            </span>
          ),
      },
      {
        id: 'capacity',
        // Sort by the lower bound rather than the rendered string
        accessorFn: (r) => r.minCapacity,
        header: t('roomDetails.capacity'),
        cell: ({ row }) => (
          <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
            {row.original.minCapacity}–{row.original.maxCapacity}
          </span>
        ),
      },
      {
        id: 'hours',
        accessorFn: (r) => roomScheduleSource(r),
        header: t('admin.roomsTable.hours'),
        cell: ({ row }) => {
          const custom = !!parseOperatingHoursOrNull(row.original.operatingHours);
          return (
            <span
              className={`px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap ${
                custom
                  ? 'bg-teal-50 border border-teal-200 text-teal-700'
                  : 'text-slate-500'
              }`}
            >
              {roomScheduleSource(row.original)}
            </span>
          );
        },
      },
      {
        id: 'policy',
        accessorFn: (r) =>
          `${r.requiresApproval ? 'approval' : ''} ${r.bookingTerms ? 'terms' : ''}`,
        header: t('admin.roomsTable.policy'),
        cell: ({ row }) => {
          const { requiresApproval, bookingTerms } = row.original;
          if (!requiresApproval && !bookingTerms) {
            return <span className="text-xs text-slate-400">—</span>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {requiresApproval && (
                <span
                  className="px-2 py-1 rounded-md text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700 whitespace-nowrap"
                  title={t('roomForm.requireApprovalHint')}
                >
                  {t('admin.roomsTable.approval')}
                </span>
              )}
              {bookingTerms && (
                <span
                  className="px-2 py-1 rounded-md text-xs font-bold bg-slate-100 border border-slate-200 text-slate-600 whitespace-nowrap"
                  title={bookingTerms}
                >
                  {t('admin.roomsTable.terms')}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'features',
        accessorFn: (r) => r.features.join(', '),
        header: t('roomDetails.features'),
        cell: ({ row }) =>
          row.original.features.length === 0 ? (
            <span className="text-xs text-slate-400">—</span>
          ) : (
            <span
              className="text-xs text-slate-600"
              title={row.original.features.join(', ')}
            >
              {row.original.features.slice(0, 2).join(', ')}
              {row.original.features.length > 2 &&
                ` +${row.original.features.length - 2}`}
            </span>
          ),
      },
      {
        id: 'actions',
        header: t('admin.columns.actions'),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button
              onClick={() => setViewingRoom(row.original)}
              className="px-2 py-1 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded"
            >
              {t('admin.view')}
            </button>
            {(isAdmin || isDeptAdminOnly) && (
              <>
                <button
                  onClick={() => setEditingRoom(row.original)}
                  className="px-2 py-1 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded"
                >
                  {t('admin.edit')}
                </button>
                <button
                  onClick={() => setDeletingRoom(row.original)}
                  className="px-2 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded"
                >
                  {t('admin.delete')}
                </button>
              </>
            )}
          </div>
        ),
      },
    ],
    [t, isAdmin, isDeptAdminOnly],
  );

  const renderRooms = () => (
    <>
      <div className="glass rounded-lg border border-slate-200 overflow-hidden animate-fade-in">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-base sm:text-lg font-bold gradient-text flex items-center gap-2">
            <svg
              className="w-5 h-5 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            {t('admin.roomManagement')}
          </h3>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:items-center">
          <div
            className="flex rounded-md border border-slate-200 overflow-hidden self-start"
            role="group"
            aria-label={t('admin.roomsTable.viewLabel')}
          >
            {(['cards', 'table'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => changeRoomsView(mode)}
                aria-pressed={roomsView === mode}
                className={`px-3 py-2 text-xs font-bold transition-colors ${
                  roomsView === mode
                    ? 'bg-primary text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t(`admin.roomsTable.view${mode === 'cards' ? 'Cards' : 'Table'}`)}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={roomsFilter}
            onChange={(e) => setRoomsFilter(e.target.value)}
            placeholder={t('calendar.searchRooms')}
            className="w-full sm:w-56 px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
          {(isAdmin || isDeptAdminOnly) && (
            <button
              onClick={() => setShowAddRoomModal(true)}
              className="w-full sm:w-auto px-3 py-2 bg-primary-dark hover:bg-primary text-white rounded-md font-bold text-sm transition-all-smooth shadow-sm flex items-center justify-center gap-2 group"
            >
              <svg
                className="w-4 h-4 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {t('admin.addRoom')}
            </button>
          )}
          </div>
        </div>
        {roomsView === 'table' ? (
          // Department is a sortable column here rather than a grouping header:
          // the point of the table is scanning and sorting ACROSS departments.
          // Search stays on the toolbar input above, so there is only one box.
          <div className="p-4 sm:p-5">
            <DataTable
              data={filteredAdminRooms}
              columns={roomTableColumns}
              globalFilter={false}
              pageSize={15}
              emptyMessage={t('calendar.noRoomsMatch')}
            />
          </div>
        ) : hasDepartmentGroups ? (
          <div className="p-4 sm:p-5 space-y-6">
            {roomGroups.map((group) => (
              <div key={group.key}>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    {group.name}
                  </h4>
                  <span className="text-xs font-bold text-slate-400">
                    {t('admin.roomCount', { count: group.rooms.length })}
                  </span>
                  <div className="flex-1 border-t border-slate-200"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {group.rooms.map((room, idx) => renderRoomCard(room, idx))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredAdminRooms.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            {t('calendar.noRoomsMatch')}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-5">
            {filteredAdminRooms.map((room, idx) => renderRoomCard(room, idx))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddRoomModal && (
        <AddRoomModal
          onClose={() => setShowAddRoomModal(false)}
          onSuccess={onRefresh}
          allowedDepartmentIds={isDeptAdminOnly ? managedDeptIds : undefined}
        />
      )}
      {editingRoom && (
        <EditRoomModal
          room={editingRoom}
          onClose={() => setEditingRoom(null)}
          onSuccess={onRefresh}
          allowedDepartmentIds={isDeptAdminOnly ? managedDeptIds : undefined}
        />
      )}
      {viewingRoom && (
        <RoomDetailsModal
          room={viewingRoom}
          onClose={() => setViewingRoom(null)}
        />
      )}
      {deletingRoom && (
        <ConfirmDeleteModal
          title={t('admin.deleteRoom')}
          message={t('admin.deleteRoomConfirm', { name: deletingRoom.name })}
          confirmText={t('admin.delete')}
          onConfirm={handleDeleteRoom}
          onCancel={() => setDeletingRoom(null)}
          isLoading={isDeleting}
        />
      )}
    </>
  );

  const tabs: {
    id: string;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'overview', label: t('admin.tabs.overview'), Icon: BarChartIcon },
    {
      id: 'bookings',
      label: t('admin.tabs.bookings'),
      Icon: CalendarIcon,
      // Approvals are time-limited, so the count has to be visible from any tab
      badge: pendingCount,
    },
    { id: 'users', label: t('admin.tabs.users'), Icon: UsersIcon },
    { id: 'rooms', label: t('admin.tabs.rooms'), Icon: BuildingIcon },
    {
      id: 'departments',
      label: t('admin.tabs.departments'),
      Icon: BuildingIcon,
    },
    { id: 'semesters', label: t('admin.tabs.semesters'), Icon: CalendarIcon },
    { id: 'closures', label: t('admin.tabs.closures'), Icon: CalendarIcon },
    { id: 'audit', label: t('admin.tabs.audit'), Icon: BarChartIcon },
    { id: 'settings', label: t('admin.tabs.settings'), Icon: SettingsIcon },
  ].filter((tab) => {
    if (tab.id === 'settings') return isSuperAdmin; // platform config is super admin only
    if (isAdmin) return true;
    if (isDeptAdminOnly)
      // Department admins see the trail for their own departments only (scoped server-side)
      return ['bookings', 'rooms', 'departments', 'closures', 'audit'].includes(
        tab.id,
      );
    // Staff without a department grant have no audit access (the API denies it too)
    return !['departments', 'semesters', 'closures', 'audit'].includes(tab.id);
  });

  const activeTab = tabs.find((t) => t.id === selectedTab);

  // Global search navigates here with ?tab=<id> (and optionally ?q=<text>
  // to pre-filter the users table) to open a specific tab
  useEffect(() => {
    const tab = searchParams.get('tab');
    const q = searchParams.get('q');
    if (tab && tabs.some((t) => t.id === tab)) {
      setSelectedTab(tab as any);
      if (tab === 'users') setUsersFilter(q || '');
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold gradient-text">
            {t('admin.title')}
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {t('admin.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowExportModal(true)}
          className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold shadow-sm transition-all-smooth flex items-center gap-2 group"
        >
          <svg
            className="w-5 h-5 text-slate-500 group-hover:text-primary transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
          {t('admin.exportReport')}
        </button>
      </div>

      {/* Menu + Content: vertical sidebar on desktop, bottom nav on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
        <div className="hidden sm:block glass rounded-lg border border-slate-200 p-2 sticky top-16 z-10 backdrop-blur-md w-52 shrink-0">
          <nav
            className="flex flex-col items-stretch gap-1.5"
            aria-label={t('admin.tabsAria')}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`
 px-4 py-2.5 rounded-md font-bold text-sm transition-all-smooth flex items-center w-full justify-start gap-3 whitespace-nowrap
                ${
                  selectedTab === tab.id
                    ? 'bg-primary text-white '
                    : 'text-slate-600 hover:bg-primary/5 hover:text-primary'
                }
              `}
              >
                <tab.Icon
                  className={`w-5 h-5 ${selectedTab === tab.id ? '' : ''} transition-transform flex-shrink-0`}
                />
                <span className="leading-tight">{tab.label}</span>
                {!!tab.badge && (
                  <span
                    className="ml-auto min-w-[20px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold text-center"
                    title={t('admin.pendingBanner.title', {
                      count: tab.badge,
                    })}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          {selectedTab === 'overview' && renderOverview()}
          {selectedTab === 'bookings' && renderBookings()}
          {selectedTab === 'users' && renderUsers()}
          {selectedTab === 'rooms' && renderRooms()}
          {selectedTab === 'departments' && (
            <DepartmentsManager
              currentUser={currentUser}
              onRefresh={onRefresh}
            />
          )}
          {selectedTab === 'semesters' && <SemestersManager />}
          {selectedTab === 'audit' && (
            <AuditLogViewer currentUser={currentUser} />
          )}
          {selectedTab === 'closures' && (
            <ClosuresManager currentUser={currentUser} />
          )}
          {selectedTab === 'settings' && <SettingsTab />}
        </div>
      </div>

      {/* Mobile: floating admin-menu trigger, sits above the app bottom nav */}
      <button
        onClick={() => setShowMoreSheet(true)}
        className="sm:hidden fixed bottom-24 right-4 z-40 px-4 py-3 rounded-lg bg-primary text-white font-bold text-sm flex items-center gap-2 transition-transform"
        aria-label={t('admin.openMenu')}
      >
        {activeTab && <activeTab.Icon className="w-5 h-5" />}
        <span>{activeTab?.label || t('admin.menu')}</span>
        {pendingCount > 0 && selectedTab !== 'bookings' && (
          <span className="min-w-[20px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold text-center">
            {pendingCount}
          </span>
        )}
        <svg
          className="w-4 h-4 opacity-80"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 15l7-7 7 7"
          />
        </svg>
      </button>

      {/* Mobile Admin Menu Bottom Sheet */}
      {showMoreSheet && (
        <div className="sm:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 animate-fade-in"
            onClick={() => setShowMoreSheet(false)}
          />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-4 pb-8 animate-slide-up ">
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4" />
            <nav
              className="flex flex-col gap-1"
              aria-label={t('admin.sectionsAria')}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSelectedTab(tab.id as any);
                    setShowMoreSheet(false);
                  }}
                  className={`px-4 py-3 rounded-lg font-bold text-sm flex items-center gap-3 transition-colors ${selectedTab === tab.id ? 'bg-primary text-white' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  <tab.Icon className="w-5 h-5" />
                  {tab.label}
                  {!!tab.badge && (
                    <span className="ml-auto min-w-[20px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold text-center">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      <ExportReportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        bookings={bookings}
        users={users}
        rooms={rooms}
      />
    </div>
  );
};

export default AdminDashboard;
