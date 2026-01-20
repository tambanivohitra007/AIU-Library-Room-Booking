import React, { useState, useEffect } from 'react';
import { Semester } from '../types';
import { api } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from './LoadingSpinner';

const SemestersManager: React.FC = () => {
  const toast = useToast();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    isActive: false,
  });

  useEffect(() => {
    loadSemesters();
  }, []);

  const loadSemesters = async () => {
    try {
      setLoading(true);
      const data = await api.getSemesters();
      setSemesters(data);
    } catch (error) {
      toast.error('Failed to load semesters');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', startDate: '', endDate: '', isActive: false });
    setIsEditing(false);
    setEditingId(null);
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
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this semester?')) return;
    
    try {
      await api.deleteSemester(id);
      toast.success('Semester deleted successfully');
      loadSemesters();
    } catch (error) {
       toast.error('Failed to delete semester');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      resetForm();
      loadSemesters();
    } catch (error) {
      toast.error('Failed to save semester');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="glass p-6 rounded-lg border border-white/20 shadow-medium">
        <h2 className="text-xl font-bold gradient-text mb-4">
            {isEditing ? 'Edit Semester' : 'Add New Semester'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Semester Name</label>
                <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Fall 2025"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    required
                />
            </div>
            
            <div className="flex items-center space-x-3 pt-6">
                <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-5 h-5 text-primary rounded focus:ring-primary"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
                    Set as Active Semester
                </label>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Start Date</label>
                <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    required
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">End Date</label>
                <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    required
                />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            {isEditing && (
                <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                >
                    Cancel
                </button>
            )}
            <button
                type="submit"
                className="px-6 py-2 bg-primary hover:bg-primary-light text-white rounded-lg font-bold shadow-md hover:shadow-lg transition-all"
            >
                {isEditing ? 'Update Semester' : 'Create Semester'}
            </button>
          </div>
        </form>
      </div>

      <div className="glass rounded-lg border border-white/20 shadow-medium overflow-hidden">
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
                                onClick={() => handleDelete(semester.id)}
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
    </div>
  );
};

export default SemestersManager;
