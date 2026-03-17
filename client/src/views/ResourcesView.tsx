import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, X, Download, FileText, Upload, Filter, 
  ChevronRight, Calendar, BookOpen, Clock, 
  FolderOpen
} from 'lucide-react';
import { apiRequest, API_BASE_URL } from '../utils/api.js';
import { useAuth } from '../contexts/AuthContext';
import { SUBJECTS_BY_SEM } from '../utils/constants';
import { toast } from 'react-hot-toast';

const SEMESTERS = ['All', 'Sem1', 'Sem2', 'Sem3', 'Sem4', 'Sem5', 'Sem6', 'Sem7', 'Sem8'];
const CATEGORIES = [
  { id: 'All', label: 'All Materials', icon: FolderOpen },
  { id: 'midsem', label: 'Mid-Sem', icon: Clock },
  { id: 'endsem', label: 'End-Sem', icon: Calendar },
  { id: 'ppt', label: 'BITS PPTs', icon: FileText },
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
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Navigation Path: [] (Root) -> ['Sem1'] -> ['Sem1', 'Subject Name'] -> ['Sem1', 'Subject Name', 'midsem']
  const [navigationPath, setNavigationPath] = useState<string[]>([]);

  // Get unique subjects for current semester from shared constants
  const availableSubjects = useMemo(() => {
    if (navigationPath.length === 0) return [];
    const sem = navigationPath[0];
    return SUBJECTS_BY_SEM[sem] || [];
  }, [navigationPath]);

  // Statistics for folders
  const getResourceCount = (sem?: string, sub?: string, cat?: string) => {
    return resources.filter(r => {
      const matchSem = !sem || r.semester === sem;
      const matchSub = !sub || r.subject_name === sub;
      const matchCat = !cat || r.category === cat;
      return matchSem && matchSub && matchCat;
    }).length;
  };

  // Upload Form State
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    semester: 'Sem1',
    category: 'midsem',
    subject_name: SUBJECTS_BY_SEM['Sem1'][0] || '',
    course_code: '',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/resources`);
      if (res.ok) {
        const data = await res.json();
        setResources(data);
      }
    } catch (error) {
      console.error('Failed to fetch resources:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const handleDownload = (resource: Resource) => {
    // Trigger the server-side proxy download. 
    // This handles both the download count and the file streaming with correct headers.
    
    // Use absolute URL if API_BASE_URL is set (production), otherwise use relative (local)
    const downloadUrl = `${API_BASE_URL}/api/resources/${resource.id}/download`;
    
    // Create a temp anchor and click it — more reliable than window.location.href
    // for cross-origin binary data and ensures the "download" attribute is respected.
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${resource.title}.${resource.file_type}`;
    a.target = '_blank'; // Opens in new tab if download attribute is not supported
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Update local state for immediate UI feedback
    setResources(prev => prev.map(r => 
      r.id === resource.id ? { ...r, download_count: r.download_count + 1 } : r
    ));
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
        toast.success("Contribution submitted! Thank you.");
        setShowUploadModal(false);
        setUploadForm({
          title: '',
          description: '',
          semester: navigationPath[0] || 'Sem1',
          category: navigationPath[navigationPath.length - 1] === 'midsem' ? 'midsem' : 'midsem',
          subject_name: SUBJECTS_BY_SEM[navigationPath[0] || 'Sem1']?.[0] || '',
          course_code: '',
        });
        setUploadFile(null);
        fetchResources();
      } else {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          toast.error(data.error || "Upload failed. Please try again.");
        } else {
          const errorText = await res.text();
          console.error("Non-JSON error response:", errorText);
          toast.error(`Server error (${res.status}). Check console for details.`);
        }
      }
    } catch (error: any) {
      console.error('Full upload error details:', error);
      toast.error(error.message || "Network error. Is the server running?");
    } finally {
      setIsUploading(false);
    }
  };

  // Derived Views
  const isSearchMode = searchTerm.length > 0;
  
  const filteredResources = resources.filter(r => {
    if (isSearchMode) {
      const s = searchTerm.toLowerCase();
      return r.title.toLowerCase().includes(s) || 
             r.subject_name.toLowerCase().includes(s) || 
             r.course_code?.toLowerCase().includes(s);
    }
    
    if (navigationPath.length === 0) return true;
    if (navigationPath.length === 1) return r.semester === navigationPath[0];
    if (navigationPath.length === 2) return r.semester === navigationPath[0] && r.subject_name === navigationPath[1];
    return r.semester === navigationPath[0] && r.subject_name === navigationPath[1] && r.category === navigationPath[2];
  });

  const renderBreadcrumbs = () => (
    <div className="flex items-center gap-2 mb-8 text-xs font-bold text-slate-500 overflow-x-auto whitespace-nowrap pb-2">
      <button 
        onClick={() => setNavigationPath([])}
        className="hover:text-[#FFC000] flex items-center gap-1 transition-colors shrink-0"
      >
        <FolderOpen className="h-3.5 w-3.5" />
        Resources
      </button>
      {navigationPath.map((path, idx) => (
        <React.Fragment key={path + idx}>
          <ChevronRight className="h-3 w-3 opacity-30 shrink-0" />
          <button 
            onClick={() => setNavigationPath(navigationPath.slice(0, idx + 1))}
            className={`transition-colors shrink-0 ${idx === navigationPath.length - 1 ? 'text-white' : 'hover:text-[#FFC000]'}`}
          >
            {path.startsWith('Sem') ? path.replace('Sem', 'Semester ') : CATEGORIES.find(c => c.id === path)?.label || path}
          </button>
        </React.Fragment>
      ))}
    </div>
  );

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
            <span className="px-2 py-0.5 bg-[#FFC000]/10 text-[#FFC000] text-[10px] font-black uppercase tracking-wider rounded">Repository</span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Nested Folders</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-2">Free Study Materials</h1>
          <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
            Browse materials organized by semester, subject, and category. 
            Contribute to the repository to help your peers.
          </p>
        </div>
        
        <button 
          onClick={() => {
            if (!user) {
              toast.error("Please sign in to contribute materials");
              return;
            }
            setShowUploadModal(true);
          }}
          className="flex items-center gap-2 bg-[#FFC000] hover:bg-[#e6ac00] text-slate-900 px-6 py-3.5 rounded-2xl font-black text-sm transition-all shadow-xl shadow-[#FFC000]/20 active:scale-95 shrink-0"
        >
          <Upload className="h-4 w-4 stroke-[3px]" />
          Contribute
        </button>
      </div>

      {/* Control Bar */}
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search all materials..."
            className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/20 focus:border-[#FFC000]/40 transition-all placeholder:text-slate-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {!isSearchMode && renderBreadcrumbs()}

      {/* Grid Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[1,2,3,4,5].map(i => <div key={i} className="aspect-square bg-slate-900/50 rounded-3xl animate-pulse" />)}
          </motion.div>
        ) : isSearchMode ? (
          <motion.div key="search" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResources.map(r => (
               <ResourceCard key={r.id} resource={r} onDownload={() => handleDownload(r)} />
            ))}
            {filteredResources.length === 0 && (
              <div className="col-span-full py-20 text-center opacity-50 font-bold">No results found for "{searchTerm}"</div>
            )}
          </motion.div>
        ) : navigationPath.length === 0 ? (
          // Root level: Semester Folders
          <motion.div 
            key="root"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4"
          >
            {SEMESTERS.slice(1).map(sem => (
              <FolderItem 
                key={sem}
                label={sem.replace('Sem', 'Sem ')}
                count={getResourceCount(sem)}
                onClick={() => setNavigationPath([sem])}
              />
            ))}
          </motion.div>
        ) : navigationPath.length === 1 ? (
          // Semester level: Subject Folders
          <motion.div 
            key="semester"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
          >
            <button 
              onClick={() => setNavigationPath([])}
              className="col-span-full flex items-center gap-2 text-xs font-black text-[#FFC000] uppercase mb-2 hover:opacity-80"
            >
              <X className="h-3 w-3 rotate-45" /> Back to All Semesters
            </button>
            {availableSubjects.map(sub => (
              <FolderItem 
                key={sub}
                label={sub}
                icon={<BookOpen className="h-8 w-8" />}
                count={getResourceCount(navigationPath[0], sub)}
                onClick={() => setNavigationPath([navigationPath[0], sub])}
              />
            ))}
            {availableSubjects.length === 0 && (
              <div className="col-span-full py-20 text-center bg-slate-900/30 rounded-3xl border border-dashed border-white/5 opacity-50">
                No subjects found in this semester yet.
              </div>
            )}
          </motion.div>
        ) : navigationPath.length === 2 ? (
          // Subject level: Category Folders
          <motion.div 
            key="subject"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            <button 
              onClick={() => setNavigationPath([navigationPath[0]])}
              className="col-span-full flex items-center gap-2 text-xs font-black text-[#FFC000] uppercase mb-2 hover:opacity-80"
            >
              <X className="h-3 w-3 rotate-45" /> Back to Subjects
            </button>
            {CATEGORIES.slice(1).map(cat => (
              <FolderItem 
                key={cat.id}
                label={cat.label}
                icon={<cat.icon className="h-7 w-7" />}
                count={getResourceCount(navigationPath[0], navigationPath[1], cat.id)}
                onClick={() => setNavigationPath([navigationPath[0], navigationPath[1], cat.id])}
              />
            ))}
          </motion.div>
        ) : (
          // Category level: Resource Cards
          <motion.div 
            key="category"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <button 
              onClick={() => setNavigationPath([navigationPath[0], navigationPath[1]])}
              className="flex items-center gap-2 text-xs font-black text-[#FFC000] uppercase mb-4 hover:opacity-80"
            >
               Back to {navigationPath[1]}
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredResources.map(r => (
                <ResourceCard key={r.id} resource={r} onDownload={() => handleDownload(r)} />
              ))}
              {filteredResources.length === 0 && (
                <div className="col-span-full py-20 text-center bg-slate-900/30 rounded-3xl border border-dashed border-white/5 opacity-50">
                  No materials uploaded in this category yet.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                      onChange={e => {
                        const newSem = e.target.value;
                        const subjects = SUBJECTS_BY_SEM[newSem] || [];
                        setUploadForm({
                          ...uploadForm, 
                          semester: newSem,
                          subject_name: subjects[0] || ''
                        });
                      }}
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
                    <select 
                      required
                      value={uploadForm.subject_name}
                      onChange={e => setUploadForm({...uploadForm, subject_name: e.target.value})}
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/20 appearance-none"
                    >
                      <option value="" disabled>Select subject...</option>
                      {(SUBJECTS_BY_SEM[uploadForm.semester] || []).map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#FFC000] uppercase tracking-widest ml-1">File (PDF, Docx, PPT, Excel, Images, Zip)</label>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-3xl p-8 hover:bg-white/5 transition-colors cursor-pointer group">
                    <Upload className="h-8 w-8 text-slate-600 group-hover:text-[#FFC000] transition-colors mb-2" />
                    <span className="text-sm font-bold text-slate-500 group-hover:text-slate-300">
                      {uploadFile ? uploadFile.name : 'Select documents here'}
                    </span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".pdf,.docx,.doc,.zip,.ppt,.pptx,.xls,.xlsx,.jpg,.png,.jpeg,.webp"
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

const FolderItem: React.FC<{ label: string; count: number; icon?: React.ReactNode; onClick: () => void }> = ({ label, count, icon, onClick }) => (
  <button 
    onClick={onClick}
    className="group flex flex-col items-center p-4 rounded-[24px] bg-slate-900/50 border border-white/5 hover:border-[#FFC000]/30 hover:bg-[#FFC000]/5 hover:scale-[1.02] transition-all"
  >
    <div className="relative w-12 h-12 flex items-center justify-center text-slate-600 group-hover:text-[#FFC000] transition-colors mb-3">
      {icon || <FolderOpen className="h-8 w-8" />}
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-[#FFC000] text-slate-900 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-lg">
          {count}
        </span>
      )}
    </div>
    <span className="text-xs font-black text-slate-400 group-hover:text-white transition-colors text-center line-clamp-1">{label}</span>
  </button>
);

const ResourceCard: React.FC<{ resource: Resource; onDownload: () => void }> = ({ resource, onDownload }) => (
  <motion.div
    layout
    className="group bg-slate-900 border border-white/10 rounded-[32px] p-6 hover:border-[#FFC000]/40 transition-all duration-300 relative overflow-hidden"
  >
    <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
      <span className="bg-[#FFC000] text-slate-900 text-[10px] font-black px-2 py-0.5 rounded uppercase">{resource.file_type}</span>
    </div>
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <div className="flex items-center gap-2 text-[10px] font-black text-[#FFC000] uppercase tracking-widest mb-2 opacity-80">
          <span>{CATEGORIES.find(c => c.id === resource.category)?.label}</span>
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
        {resource.description || 'No additional description provided.'}
      </p>
      <div className="flex items-center justify-between pt-6 border-t border-white/5 mt-auto">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400">
            {resource.uploader_name.charAt(0)}
          </div>
          <span className="text-[10px] font-bold text-slate-400">{resource.uploader_name}</span>
        </div>
        <button onClick={onDownload} className="flex items-center gap-2 text-white hover:text-[#FFC000] transition-colors">
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
);
