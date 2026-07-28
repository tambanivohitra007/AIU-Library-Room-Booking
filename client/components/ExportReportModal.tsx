import React, { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { dateLocale } from '../i18n';
import { Booking, User, Room } from '../types';
import { useReactToPrint } from 'react-to-print';
import { useSettings } from '../contexts/SettingsContext';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[];
  users: User[];
  rooms: Room[];
}

type ReportType = 'bookings' | 'users' | 'rooms';

const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  bookings,
  users,
  rooms,
}) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [reportType, setReportType] = useState<ReportType>('bookings');
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0],
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );

  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `${(settings?.serviceName || 'Booking').replace(/\s+/g, '_')}_${reportType}_Report`,
  });

  // --- Filtering Logic ---
  const filteredBookings = useMemo(() => {
    if (reportType !== 'bookings') return [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return bookings
      .filter((b) => {
        const bDate = new Date(b.startTime);
        return bDate >= start && bDate <= end;
      })
      .sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
      );
  }, [bookings, startDate, endDate, reportType]);

  const filteredUsers = useMemo(() => {
    if (reportType !== 'users') return [];
    return users.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [users, reportType]);

  const filteredRooms = useMemo(() => {
    if (reportType !== 'rooms') return [];
    return rooms;
  }, [rooms, reportType]);

  // --- Statistics Calculation ---
  const stats = useMemo(() => {
    if (reportType === 'bookings') {
      const total = filteredBookings.length;
      const confirmed = filteredBookings.filter(
        (b) => b.status === 'CONFIRMED',
      ).length;
      const cancelled = filteredBookings.filter(
        (b) => b.status === 'CANCELLED',
      ).length;
      const uniqueUsers = new Set(filteredBookings.map((b) => b.userId)).size;
      return [
        {
          label: t('reports.totalBookings'),
          value: total,
          color: 'text-primary',
          bg: 'bg-primary/10',
        },
        {
          label: t('reports.confirmed'),
          value: confirmed,
          color: 'text-green-600',
          bg: 'bg-green-50',
        },
        {
          label: t('reports.cancelled'),
          value: cancelled,
          color: 'text-red-600',
          bg: 'bg-red-50',
        },
        {
          label: t('reports.activeUsers'),
          value: uniqueUsers,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
        },
      ];
    } else if (reportType === 'users') {
      const total = filteredUsers.length;
      const active = filteredUsers.filter((u) => u.status === 'ACTIVE').length;
      const pending = filteredUsers.filter(
        (u) => u.status === 'PENDING',
      ).length;
      const admins = filteredUsers.filter((u) => u.role === 'ADMIN').length;
      return [
        {
          label: t('reports.totalUsers'),
          value: total,
          color: 'text-primary',
          bg: 'bg-primary/10',
        },
        {
          label: t('reports.active'),
          value: active,
          color: 'text-green-600',
          bg: 'bg-green-50',
        },
        {
          label: t('reports.pending'),
          value: pending,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
        },
        {
          label: t('reports.admins'),
          value: admins,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
        },
      ];
    } else {
      const total = filteredRooms.length;
      const totalCapacity = filteredRooms.reduce(
        (acc, r) => acc + r.maxCapacity,
        0,
      );
      return [
        {
          label: t('reports.totalRooms'),
          value: total,
          color: 'text-primary',
          bg: 'bg-primary/10',
        },
        {
          label: t('reports.totalCapacity'),
          value: totalCapacity,
          color: 'text-green-600',
          bg: 'bg-green-50',
        },
      ];
    }
  }, [reportType, filteredBookings, filteredUsers, filteredRooms, t]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm print:p-0 print:static print:bg-white print:z-auto">
      {/* Modal Container */}
      <div className="bg-slate-50 w-full h-[95vh] max-w-7xl rounded-xl flex flex-col overflow-hidden animate-slide-up print:shadow-none print:h-auto print:w-full print:max-w-none print:rounded-none">
        {/* === Header (Screen Only) === */}
        <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {t('reports.title')}
              </h2>
              <p className="text-sm text-slate-500">{t('reports.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handlePrint}
              className="px-6 py-2 bg-primary hover:bg-primary-light text-white font-bold rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
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
              {t('reports.printSavePdf')}
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden print:overflow-visible print:block">
          {/* === Sidebar (Screen Only) === */}
          <div className="w-80 bg-white border-r border-slate-200 p-6 space-y-8 overflow-y-auto print:hidden">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                {t('reports.reportType')}
              </label>
              <div className="space-y-2">
                {(['bookings', 'users', 'rooms'] as ReportType[]).map(
                  (type) => (
                    <button
                      key={type}
                      onClick={() => setReportType(type)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                        reportType === type
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-transparent hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${reportType === type ? 'border-primary' : 'border-slate-300'}`}
                      >
                        {reportType === type && (
                          <div className="w-2.5 h-2.5 bg-primary rounded-full" />
                        )}
                      </div>
                      <span className="font-bold capitalize">
                        {t(`reports.types.${type}`)}
                      </span>
                    </button>
                  ),
                )}
              </div>
            </div>

            {reportType === 'bookings' && (
              <div className="animate-fade-in">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  {t('reports.dateRange')}
                </label>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {t('reports.from')}
                    </span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium text-slate-700"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {t('reports.to')}
                    </span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium text-slate-700"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
              <h4 className="font-bold text-primary-dark mb-1 flex items-center gap-2">
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
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {t('reports.tips')}
              </h4>
              <p className="text-sm text-primary leading-relaxed">
                {t('reports.tipsText')}
              </p>
            </div>
          </div>

          {/* === Preview Area (Screen & Print) === */}
          <div className="flex-1 bg-slate-100/50 p-8 overflow-y-auto print:p-0 print:bg-white print:overflow-visible">
            {/* The Print Sheet */}
            <div
              ref={componentRef}
              className="bg-white mx-auto max-w-[210mm] min-h-[297mm] p-[15mm] print:shadow-none print:p-12 print:max-w-none print:mx-0"
            >
              {/* Report Header */}
              <div className="border-b-2 border-primary/20 pb-6 mb-8 flex justify-between items-end">
                <div>
                  <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
                    {settings?.serviceName || t('reports.defaultServiceName')}
                  </h1>
                  <p className="text-primary font-bold text-lg mt-1">
                    {settings?.description || t('reports.title')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="px-3 py-1 bg-slate-100 rounded-md inline-block mb-2 print:bg-transparent print:p-0">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {t('reports.reportType')}
                    </span>
                    <p className="font-bold text-slate-800 capitalize">
                      {t('reports.reportTitle', {
                        type: t(`reports.types.${reportType}`),
                      })}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">
                    {t('reports.generatedAt', {
                      date: new Date().toLocaleDateString(dateLocale()),
                      time: new Date().toLocaleTimeString(dateLocale()),
                    })}
                  </p>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                {stats.map((stat, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border ${stat.bg} ${stat.color} border-current/10 print:border print:border-slate-200 print:bg-white print:text-slate-800`}
                  >
                    <p className="text-xs font-bold opacity-80 uppercase tracking-wider">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-black mt-1">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Date Filters Display (Bookings only) */}
              {reportType === 'bookings' && (
                <div className="mb-6 p-3 bg-slate-50 rounded-lg border border-slate-200 flex gap-6 text-sm print:bg-transparent print:border-0 print:p-0 print:mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500">
                      {t('reports.from')}:
                    </span>
                    <span className="font-bold text-slate-800">
                      {new Date(startDate).toLocaleDateString(dateLocale())}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500">
                      {t('reports.to')}:
                    </span>
                    <span className="font-bold text-slate-800">
                      {new Date(endDate).toLocaleDateString(dateLocale())}
                    </span>
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="overflow-hidden rounded-lg border border-slate-200 print:border-0">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 print:bg-slate-100 print:text-black">
                      {reportType === 'bookings' && (
                        <>
                          <th className="px-4 py-3 font-bold text-slate-700">
                            {t('reports.colDateTime')}
                          </th>
                          <th className="px-4 py-3 font-bold text-slate-700">
                            {t('reports.colRoom')}
                          </th>
                          <th className="px-4 py-3 font-bold text-slate-700">
                            {t('reports.colUser')}
                          </th>
                          <th className="px-4 py-3 font-bold text-slate-700 text-center">
                            {t('reports.colGuests')}
                          </th>
                          <th className="px-4 py-3 font-bold text-slate-700 text-right">
                            {t('reports.colStatus')}
                          </th>
                        </>
                      )}
                      {reportType === 'users' && (
                        <>
                          <th className="px-4 py-3 font-bold text-slate-700">
                            {t('reports.colName')}
                          </th>
                          <th className="px-4 py-3 font-bold text-slate-700">
                            {t('reports.colEmail')}
                          </th>
                          <th className="px-4 py-3 font-bold text-slate-700">
                            {t('reports.colRole')}
                          </th>
                          <th className="px-4 py-3 font-bold text-slate-700">
                            {t('reports.colJoined')}
                          </th>
                          <th className="px-4 py-3 font-bold text-slate-700 text-right">
                            {t('reports.colStatus')}
                          </th>
                        </>
                      )}
                      {reportType === 'rooms' && (
                        <>
                          <th className="px-4 py-3 font-bold text-slate-700">
                            {t('reports.colRoomName')}
                          </th>
                          <th className="px-4 py-3 font-bold text-slate-700">
                            {t('reports.colCapacity')}
                          </th>
                          <th className="px-4 py-3 font-bold text-slate-700">
                            {t('reports.colFeatures')}
                          </th>
                          <th className="px-4 py-3 font-bold text-slate-700 text-right">
                            {t('reports.colDescription')}
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportType === 'bookings' &&
                      filteredBookings.map((booking, idx) => (
                        <tr
                          key={booking.id}
                          className={
                            idx % 2 === 0
                              ? 'bg-white'
                              : 'bg-slate-50/50 print:bg-transparent'
                          }
                        >
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-800">
                              {new Date(booking.startTime).toLocaleDateString(
                                dateLocale(),
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              {new Date(booking.startTime).toLocaleTimeString(
                                dateLocale(),
                                { hour: '2-digit', minute: '2-digit' },
                              )}{' '}
                              -
                              {new Date(booking.endTime).toLocaleTimeString(
                                dateLocale(),
                                { hour: '2-digit', minute: '2-digit' },
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {rooms.find((r) => r.id === booking.roomId)?.name ||
                              t('myBookings.unknownRoom')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-800">
                              {booking.userDisplay}
                            </div>
                            <div className="text-xs text-slate-500">
                              {booking.userEmail}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-slate-600">
                            {booking.attendees.length}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${
                                booking.status === 'CONFIRMED'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : booking.status === 'CANCELLED'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                              } print:border-slate-300 print:text-black print:bg-transparent`}
                            >
                              {t(`status.${booking.status}`)}
                            </span>
                          </td>
                        </tr>
                      ))}

                    {reportType === 'users' &&
                      filteredUsers.map((user, idx) => (
                        <tr
                          key={user.id}
                          className={
                            idx % 2 === 0
                              ? 'bg-white'
                              : 'bg-slate-50/50 print:bg-transparent'
                          }
                        >
                          <td className="px-4 py-3 font-bold text-slate-800">
                            {user.name}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-600">
                            {user.email}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${
                                user.role === 'ADMIN'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-primary/10 text-primary border-primary/20'
                              } print:border-slate-300 print:text-black print:bg-transparent`}
                            >
                              {t(`reports.userRole.${user.role}`, {
                                defaultValue: user.role,
                              })}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 tabular-nums">
                            {new Date(user.createdAt).toLocaleDateString(
                              dateLocale(),
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${
                                user.status === 'ACTIVE'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              } print:border-slate-300 print:text-black print:bg-transparent`}
                            >
                              {t(`reports.userStatus.${user.status || 'ACTIVE'}`, {
                                defaultValue: user.status || 'ACTIVE',
                              })}
                            </span>
                          </td>
                        </tr>
                      ))}

                    {reportType === 'rooms' &&
                      filteredRooms.map((room, idx) => (
                        <tr
                          key={room.id}
                          className={
                            idx % 2 === 0
                              ? 'bg-white'
                              : 'bg-slate-50/50 print:bg-transparent'
                          }
                        >
                          <td className="px-4 py-3 font-bold text-slate-800">
                            {room.name}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-600">
                            {room.minCapacity} - {room.maxCapacity}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {room.features.slice(0, 3).map((f, i) => (
                                <span
                                  key={i}
                                  className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded print:bg-transparent print:border print:border-slate-300"
                                >
                                  {f}
                                </span>
                              ))}
                              {room.features.length > 3 && (
                                <span className="text-xs text-slate-400">
                                  +{room.features.length - 3}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-slate-500 max-w-xs truncate print:whitespace-normal">
                            {room.description}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-8 border-t border-slate-200 flex justify-between text-xs text-slate-400 font-medium print:hidden">
                <p>{settings?.serviceName || t('reports.defaultServiceName')}</p>
                <p>{t('reports.internalUseOnly')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles Injection */}
      <style>{`
        @media print {
          @page {
 size: auto;
 margin: 0mm;
          }
 body {
 background: white !important;
 print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ExportReportModal;
