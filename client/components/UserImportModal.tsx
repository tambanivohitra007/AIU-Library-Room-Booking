import React, { useState, useRef } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { UploadIcon, DownloadIcon, XIcon, AlertTriangleIcon } from './Icons';
import { parseCSV, generateSampleCSV, ParsedUser } from '../utils/csvParser';
import { DEFAULT_USER_PASSWORD } from '../constants';
import { api } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

interface UserImportModalProps {
  onClose: () => void;
  onImportSuccess: () => void;
}

interface ImportResult {
  success: Array<{ id: string; email: string; name: string }>;
  failed: Array<{ email: string; reason: string }>;
  defaultPassword: string;
}

const UserImportModal: React.FC<UserImportModalProps> = ({
  onClose,
  onImportSuccess,
}) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParseError('');
      setImportResult(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const csvText = event.target?.result as string;
          const users = parseCSV(csvText);
          setParsedUsers(users);
        } catch (error: any) {
          setParseError(error.message || t('userImport.parseFailed'));
          setParsedUsers([]);
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleImport = async () => {
    if (parsedUsers.length === 0) return;

    setImporting(true);
    try {
      const result = await api.importUsers(parsedUsers);
      setImportResult(result.results);

      if (result.results.success.length > 0) {
        onImportSuccess();
      }
    } catch (error: any) {
      setParseError(error.message || t('userImport.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const downloadSample = () => {
    const csv = generateSampleCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-users.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {t('userImport.title')}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {t('userImport.subtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
            <h3 className="font-semibold text-primary-dark mb-2">
              {t('userImport.instructions')}
            </h3>
            <ul className="text-sm text-primary-dark space-y-1 list-disc list-inside">
              <li>
                <Trans
                  i18nKey="userImport.columnsRequired"
                  components={{
                    1: <code className="bg-primary/20 px-1 rounded" />,
                    2: <code className="bg-primary/20 px-1 rounded" />,
                  }}
                />
              </li>
              <li>
                <Trans
                  i18nKey="userImport.optionalColumn"
                  components={{
                    1: <code className="bg-primary/20 px-1 rounded" />,
                  }}
                />
              </li>
              <li>
                <Trans
                  i18nKey="userImport.defaultPasswordInfo"
                  values={{ password: DEFAULT_USER_PASSWORD }}
                  components={{ 1: <strong /> }}
                />
              </li>
              <li>{t('userImport.changePasswordAdvice')}</li>
            </ul>
            <button
              onClick={downloadSample}
              className="mt-3 flex items-center gap-2 text-sm text-primary hover:text-primary-dark font-medium"
            >
              <DownloadIcon className="w-4 h-4" />
              {t('userImport.downloadSample')}
            </button>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('userImport.selectFile')}
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
              >
                <UploadIcon className="w-4 h-4" />
                {t('userImport.chooseFile')}
              </button>
              {file && (
                <span className="text-sm text-slate-600">
                  {t('userImport.fileSummary', {
                    name: file.name,
                    count: parsedUsers.length,
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Parse Error */}
          {parseError && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 flex items-start gap-3">
              <AlertTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-900">
                  {t('userImport.errorParsing')}
                </h4>
                <p className="text-sm text-red-700 mt-1">{parseError}</p>
              </div>
            </div>
          )}

          {/* Preview */}
          {parsedUsers.length > 0 && !importResult && (
            <div>
              <h3 className="font-semibold text-slate-800 mb-3">
                {t('userImport.preview', { count: parsedUsers.length })}
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold text-slate-700">
                        {t('userImport.colName')}
                      </th>
                      <th className="text-left p-3 font-semibold text-slate-700">
                        {t('userImport.colEmail')}
                      </th>
                      <th className="text-left p-3 font-semibold text-slate-700">
                        {t('userImport.colRole')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedUsers.map((user, idx) => (
                      <tr key={idx} className="even:bg-slate-50 hover:bg-primary/5">
                        <td className="p-3 text-slate-800">{user.name}</td>
                        <td className="p-3 text-slate-600">{user.email}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded-md text-xs font-medium ${
                              user.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-primary/20 text-primary'
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-900 mb-2">
                  {t('userImport.importComplete')}
                </h3>
                <p className="text-sm text-green-800">
                  {t('userImport.successCount', {
                    count: importResult.success.length,
                  })}
                  {importResult.failed.length > 0 &&
                    t('userImport.failedCount', {
                      count: importResult.failed.length,
                    })}
                </p>
                <p className="text-sm text-green-800 mt-2">
                  <Trans
                    i18nKey="userImport.defaultPasswordResult"
                    values={{ password: DEFAULT_USER_PASSWORD }}
                    components={{ 1: <strong /> }}
                  />
                </p>
              </div>

              {importResult.failed.length > 0 && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <h4 className="font-semibold text-yellow-900 mb-2">
                    {t('userImport.failedImports')}
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {importResult.failed.map((fail, idx) => (
                      <div key={idx} className="text-sm text-yellow-800">
                        <strong>{fail.email}</strong>: {fail.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-100 transition-colors"
          >
            {importResult ? t('common.close') : t('common.cancel')}
          </button>
          {!importResult && (
            <button
              onClick={handleImport}
              disabled={parsedUsers.length === 0 || importing}
              className="px-6 py-2 bg-primary hover:bg-primary-light text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importing && <LoadingSpinner size="sm" color="white" />}
              {importing ? t('userImport.importing') : t('userImport.title')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserImportModal;
