import React, { useState, useRef } from 'react';
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

const UserImportModal: React.FC<UserImportModalProps> = ({ onClose, onImportSuccess }) => {
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
          setParseError(error.message || 'Failed to parse CSV file');
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
      setParseError(error.message || 'Failed to import users');
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
            <h2 className="text-2xl font-bold text-slate-800">Import Users</h2>
            <p className="text-sm text-slate-600 mt-1">Upload a CSV file to bulk import users</p>
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
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">Instructions</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>CSV file must contain columns: <code className="bg-blue-100 px-1 rounded">name</code>, <code className="bg-blue-100 px-1 rounded">email</code></li>
              <li>Optional column: <code className="bg-blue-100 px-1 rounded">role</code> (STUDENT or ADMIN, defaults to STUDENT)</li>
              <li>All imported users will have the default password: <strong>{DEFAULT_USER_PASSWORD}</strong></li>
              <li>Users should change their password after first login</li>
            </ul>
            <button
              onClick={downloadSample}
              className="mt-3 flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 font-medium"
            >
              <DownloadIcon className="w-4 h-4" />
              Download Sample CSV
            </button>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select CSV File
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
                Choose File
              </button>
              {file && (
                <span className="text-sm text-slate-600">
                  {file.name} ({parsedUsers.length} users found)
                </span>
              )}
            </div>
          </div>

          {/* Parse Error */}
          {parseError && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 flex items-start gap-3">
              <AlertTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-900">Error Parsing File</h4>
                <p className="text-sm text-red-700 mt-1">{parseError}</p>
              </div>
            </div>
          )}

          {/* Preview */}
          {parsedUsers.length > 0 && !importResult && (
            <div>
              <h3 className="font-semibold text-slate-800 mb-3">
                Preview ({parsedUsers.length} users)
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold text-slate-700">Name</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Email</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedUsers.map((user, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-800">{user.name}</td>
                        <td className="p-3 text-slate-600">{user.email}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.role === 'ADMIN' 
                              ? 'bg-purple-100 text-purple-700' 
                              : 'bg-blue-100 text-blue-700'
                          }`}>
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
                  Import Complete
                </h3>
                <p className="text-sm text-green-800">
                  Successfully imported {importResult.success.length} user(s)
                  {importResult.failed.length > 0 && `, ${importResult.failed.length} failed`}
                </p>
                <p className="text-sm text-green-800 mt-2">
                  Default password for all imported users: <strong>{DEFAULT_USER_PASSWORD}</strong>
                </p>
              </div>

              {importResult.failed.length > 0 && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <h4 className="font-semibold text-yellow-900 mb-2">Failed Imports</h4>
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
            {importResult ? 'Close' : 'Cancel'}
          </button>
          {!importResult && (
            <button
              onClick={handleImport}
              disabled={parsedUsers.length === 0 || importing}
              className="px-6 py-2 bg-primary hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importing && <LoadingSpinner size="sm" color="white" />}
              {importing ? 'Importing...' : 'Import Users'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserImportModal;
