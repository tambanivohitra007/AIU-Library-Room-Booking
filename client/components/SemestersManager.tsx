import React, { useState, useEffect } from 'react';
import { Semester } from '../types';
import { api } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from './LoadingSpinner';
import { PlusIcon, XIcon } from './Icons';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface SemesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  formData: {
    name: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  };
  setFormData: React.Dispatch<React.SetStateAction<{
    name: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  }>>;
  isEditing: boolean;
  isLoading?: boolean;
}

const SemesterModal: React.FC<SemesterModalProps> = ({ 
  isOpen, onClose, onSubmit, formData, setFormData, isEditing, isLoading = false 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={isLoading ? undefined : onClose}></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                {isEditing ? 'Edit Semester' : 'Add New Semester'}
              </h3>
              <button 
                onClick={onClose} 
                className="text-gray-400 hover:text-gray-500 disabled:opacity-50"
                disabled={isLoading}
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Semester Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Fall 2025"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-50 disabled:text-slate-500"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-5 h-5 text-primary rounded focus:ring-primary disabled:opacity-50"
                  disabled={isLoading}
                />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
                  Set as Active Semester
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-50 disabled:text-slate-500"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-50 disabled:text-slate-500"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="submit"
                  className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:col-start-2 sm:text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {isEditing ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    isEditing ? 'Update' : 'Create'
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:col-start-1 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

const SemestersManager: React.FC = () => {
  const toast = useToast();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [semesterToDelete, setSemesterToDelete] = useState<Semester | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    isActive: false,
  });

  useEffect(() => {
    loadSemesters(true);
  }, []);

  const loadSemesters = async (isInitial = false) => {
    try {
      // Only set loading true on initial load to avoid flash
      if (isInitial) setLoading(true);
      
      const data = await api.getSemesters();
      setSemesters(data);
    } catch (error) {
      toast.error('Failed to load semesters');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const openAddModal = () => {
    setFormData({ name: '', startDate: '', endDate: '', isActive: false });
    setIsEditing(false);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleEdit = (semester: Semester) => {
    setFormData({
      name: semester.name,
      startDate: new Date(semester.startDate).toISOString().split('T')[0],
      endDate: new Date(semester.endDate).toISOString().split('T')[0],
      isActive: semester.isActive,
    });
    setEditingId(semester.id);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!semesterToDelete) return;
    
    setIsDeleting(true);
    try {
      await api.deleteSemester(semesterToDelete.id);
      toast.success('Semester deleted successfully');
      loadSemesters();
      setSemesterToDelete(null);
    } catch (error) {
       toast.error('Failed to delete semester');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    
    // Set times to start/end of day for accurate comparison
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (end < start) {
      toast.error('End date must be after start date');
      return;
    }

    const hasOverlap = semesters.some(sem => {
      if (isEditing && sem.id === editingId) return false;
      
      const semStart = new Date(sem.startDate);
      const semEnd = new Date(sem.endDate);
      
      // Normalize existing dates too
      semStart.setHours(0, 0, 0, 0);
      semEnd.setHours(23, 59, 59, 999);

      return start <= semEnd && end >= semStart;
    });

    if (hasOverlap) {
      toast.error('Date range overlaps with an existing semester');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && editingId) {
        await api.updateSemester(editingId, {
            ...formData,
            startDate: new Date(formData.startDate).toISOString(),
            endDate: new Date(formData.endDate).toISOString()
        });
        toast.success('Semester updated successfully');
      } else {
        await api.createSemester({
            ...formData,
            startDate: new Date(formData.startDate).toISOString(),
            endDate: new Date(formData.endDate).toISOString()
        });
        toast.success('Semester created successfully');
      }
      setIsModalOpen(false);
      loadSemesters();
    } catch (error) {
      toast.error('Failed to save semester');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl font-bold gradient-text">Semester Management</h2>
        <button
          onClick={openAddModal}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg font-bold shadow-md hover:shadow-lg transition-all"
        >
          <PlusIcon className="w-5 h-5" />
          Add Semester
        </button>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block glass rounded-lg border border-white/20 shadow-medium overflow-hidden">
        <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Dates</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {semesters.map((semester) => (
                    <tr key={semester.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-800">{semester.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                            {new Date(semester.startDate).toLocaleDateString()} - {new Date(semester.endDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                            {semester.isActive ? (
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200">
                                    Active
                                </span>
                            ) : (
                                <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold border border-slate-200">
                                    Inactive
                                </span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                             <button
                                onClick={() => handleEdit(semester)}
                                className="text-primary hover:text-primary-dark font-medium text-sm"
                            >
                                Edit
                            </button>
                            <button
                                onClick={() => setSemesterToDelete(semester)}
                                className="text-red-500 hover:text-red-700 font-medium text-sm"
                            >
                                Delete
                            </button>
                        </td>
                    </tr>
                ))}
                
                {semesters.length === 0 && (
                    <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500 font-medium">
                            No semesters configured yet. Add one above.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {semesters.length === 0 ? (
          <div className="glass rounded-lg border border-white/20 p-12 text-center shadow-medium">
            <p className="text-slate-500 font-semibold">No semesters configured yet.</p>
          </div>
        ) : (
          semesters.map((semester) => (
            <div key={semester.id} className="glass rounded-lg border border-white/20 p-4 shadow-medium">
               <div className="flex justify-between items-start mb-2">
                 <div>
                    <h3 className="font-bold text-slate-800 text-lg">{semester.name}</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {new Date(semester.startDate).toLocaleDateString()} - {new Date(semester.endDate).toLocaleDateString()}
                    </p>
                 </div>
                 {semester.isActive ? (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200">
                        Active
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold border border-slate-200">
                        Inactive
                    </span>
                  )}
               </div>

               <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200/50">
                  <button
                    onClick={() => handleEdit(semester)}
                    className="flex-1 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-md font-bold text-sm transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setSemesterToDelete(semester)}
                    className="flex-1 px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-md font-bold text-sm transition-all"
                  >
                    Delete
                  </button>
               </div>
            </div>
          ))
        )}
      </div>

      <SemesterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        isEditing={isEditing}
        isLoading={submitting}
      />

      {semesterToDelete && (
        <ConfirmDeleteModal
          title="Delete Semester"
          message={`Are you sure you want to delete "${semesterToDelete.name}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setSemesterToDelete(null)}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
};


export default SemestersManager;
