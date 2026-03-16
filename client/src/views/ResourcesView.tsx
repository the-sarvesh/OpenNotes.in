import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, X, Download, FileText, Upload, Filter, 
  ChevronRight, Calendar, BookOpen, Clock, Users,
  FolderOpen
} from 'lucide-react';
import { apiRequest } from '../utils/api.js';
import { useAuth } from '../contexts/AuthContext';

const SEMESTERS = ['All', 'Sem1', 'Sem2', 'Sem3', 'Sem4', 'Sem5', 'Sem6', 'Sem7', 'Sem8'];
const CATEGORIES = [
  { id: 'All', label: 'All Materials', icon: FolderOpen },
  { id: 'midsem', label: 'Mid-Sem', icon: Clock },
  { id: 'endsem', label: 'End-Sem', icon: Calendar },
  { id: 'assignment', label: 'Assignments', icon: FileText },
  { id: 'quiz', label: 'Quizzes', icon: BookOpen },
];

interface Resource {
  id: string;
  title: string;
  description: string;
  file_url: string;
  file_type: string;
  semester: string;
  category: string;
  subject_name: string;
  course_code: string;
  download_count: number;
  uploader_name: string;
  created_at: string;
}

export const ResourcesView: React.FC = () => {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Upload Form State
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    semester: 'Sem1',
    category: 'midsem',
    subject_name: '',
    course_code: '',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedSemester !== 'All') params.set('semester', selectedSemester);
    if (selectedCategory !== 'All') params.set('category', selectedCategory);
    if (searchTerm) params.set('search', searchTerm);

    try {
      const res = await apiRequest(`/api/resources?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResources(data);
      }
    } catch (error) {
      console.error('Failed to fetch resources:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedSemester, selectedCategory, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchResources();
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchResources]);

  const handleDownload = async (resource: Resource) => {
    try {
      // Increment count on backend
      await apiRequest(`/api/resources/${resource.id}/download`, { method: 'POST' });
      // Open file in new tab
      window.open(resource.file_url, '_blank');
      // Update local state for UI
      setResources(prev => prev.map(r => r.id === resource.id ? { ...r, download_count: r.download_count + 1 } : r));
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    Object.entries(uploadForm).forEach(([key, value]) => formData.append(key, value as string));

    try {
      const res = await apiRequest('/api/resources', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setShowUploadModal(false);
        setUploadForm({
          title: '',
          description: '',
          semester: 'Sem1',
          category: 'midsem',
          subject_name: '',
          course_code: '',
        });
        setUploadFile(null);
        fetchResources();
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-[#FFC000]/10 text-[#FFC000] text-[10px] font-black uppercase tracking-wider rounded">Resource Center</span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Soft Copies</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-2">Study Material Repository</h1>
          <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
            Access previous year questions, assignments, and notes shared by your peers. 
            Everything is organized by semester and exam type for easy access.
          </p>
        </div>
        
        <button 
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 bg-[#FFC000] hover:bg-[#e6ac00] text-slate-900 px-6 py-3.5 rounded-2xl font-black text-sm transition-all shadow-xl shadow-[#FFC000]/20 active:scale-95 shrink-0"
        >
          <Upload className="h-4 w-4 stroke-[3px]" />
          Contribute Material
        </button>
      </div>

      {/* Control Bar: Search + Category */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by subject, title or course code..."
            className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/20 focus:border-[#FFC000]/40 transition-all placeholder:text-slate-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold whitespace-nowrap border transition-all ${
                selectedCategory === cat.id 
                  ? 'bg-white text-slate-900 border-white shadow-lg' 
                  : 'bg-slate-900 text-slate-400 border-white/10 hover:border-white/30 hover:text-white'
              }`}
            >
              <cat.icon className="h-3.5 w-3.5" />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Semester Tabs */}
      <div className="mb-8 p-1 bg-slate-900/50 border border-white/5 rounded-2xl inline-flex flex-wrap md:flex-nowrap w-full md:w-auto">
        {SEMESTERS.map(sem => (
          <button
            key={sem}
            onClick={() => setSelectedSemester(sem)}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              selectedSemester === sem 
                ? 'bg-[#FFC000] text-slate-900 shadow-md' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {sem === 'All' ? 'All Semesters' : sem.replace('Sem', 'Semester ')}
          </button>
        ))}
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-48 bg-slate-900/50 rounded-3xl border border-white/5" />
          ))}
        </div>
      ) : resources.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center bg-slate-900/30 rounded-3xl border border-dashed border-white/10">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-4 text-white">
            <Filter className="opacity-20 h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No matching materials</h3>
          <p className="text-slate-500 text-sm max-w-xs">Try adjusting your filters or search terms to find what you're looking for.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.map((resource) => (
            <motion.div
              layout
              key={resource.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group bg-slate-900 border border-white/10 rounded-[32px] p-6 hover:border-[#FFC000]/40 transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="bg-[#FFC000] text-slate-900 text-[10px] font-black px-2 py-0.5 rounded uppercase">{resource.file_type}</span>
              </div>

              <div className="flex flex-col h-full">
                <div className="mb-4">
                  <div className="flex items-center gap-2 text-[10px] font-black text-[#FFC000] uppercase tracking-widest mb-2 opacity-80">
                    <span>{resource.category}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                    <span>{resource.semester}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-[#FFC000] transition-colors line-clamp-1 mb-1">{resource.title}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <BookOpen className="h-3 w-3" />
                    <span>{resource.subject_name} ({resource.course_code})</span>
                  </div>
                </div>

                <p className="text-slate-400 text-xs line-clamp-2 mb-6 leading-relaxed flex-grow">
                  {resource.description || 'No additional description provided for this resource.'}
                </p>

                <div className="flex items-center justify-between pt-6 border-t border-white/5 mt-auto">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400">
                      {resource.uploader_name.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400">{resource.uploader_name}</span>
                      <span className="text-[9px] text-slate-600 italic">Contributor</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleDownload(resource)}
                    className="flex items-center gap-2 text-white hover:text-[#FFC000] transition-colors"
                  >
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black uppercase tracking-wider">Download</span>
                      <span className="text-[9px] text-slate-500">{resource.download_count} downloads</span>
                    </div>
                    <div className="h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-[#FFC000] group-hover:text-slate-900 transition-all">
                      <Download className="h-4 w-4" />
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUploadModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-slate-900 border border-white/15 rounded-[40px] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-white">Share Materials</h2>
                <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X className="h-6 w-6 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#FFC000] uppercase tracking-widest ml-1">Title</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. 2023 End sem Paper"
                      value={uploadForm.title}
                      onChange={e => setUploadForm({...uploadForm, title: e.target.value})}
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#FFC000] uppercase tracking-widest ml-1">Semester</label>
                    <select 
                      value={uploadForm.semester}
                      onChange={e => setUploadForm({...uploadForm, semester: e.target.value})}
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/20 appearance-none"
                    >
                      {SEMESTERS.slice(1).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#FFC000] uppercase tracking-widest ml-1">Category</label>
                    <select 
                      value={uploadForm.category}
                      onChange={e => setUploadForm({...uploadForm, category: e.target.value})}
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/20 appearance-none"
                    >
                      {CATEGORIES.slice(1).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#FFC000] uppercase tracking-widest ml-1">Subject Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Mathematics II"
                      value={uploadForm.subject_name}
                      onChange={e => setUploadForm({...uploadForm, subject_name: e.target.value})}
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#FFC000] uppercase tracking-widest ml-1">File (PDF, Docx)</label>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-3xl p-8 hover:bg-white/5 transition-colors cursor-pointer group">
                    <Upload className="h-8 w-8 text-slate-600 group-hover:text-[#FFC000] transition-colors mb-2" />
                    <span className="text-sm font-bold text-slate-500 group-hover:text-slate-300">
                      {uploadFile ? uploadFile.name : 'Select document here'}
                    </span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".pdf,.docx,.doc,.zip"
                      onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                <button 
                  disabled={isUploading}
                  className="w-full bg-white hover:bg-slate-200 text-slate-900 py-4 rounded-[24px] font-black text-sm transition-all flex items-center justify-center gap-2 shadow-xl"
                >
                  {isUploading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-slate-900 border-t-transparent animate-spin rounded-full" />
                      Uploading Material...
                    </>
                  ) : (
                    <>Submit Contribution</>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
