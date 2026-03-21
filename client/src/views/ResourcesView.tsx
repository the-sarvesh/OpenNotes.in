import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, X, Download, FileText, Upload, Filter,
  ChevronRight, Calendar, BookOpen, Clock,
  FolderOpen, ArrowLeft, ExternalLink
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

// ── Gold label ─────────────────────────────────────────────────────
const GoldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] font-black text-[#FFC000] uppercase tracking-widest mb-2">{children}</p>
);

// ── Input shared class ─────────────────────────────────────────────
const darkInput = "w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/20 focus:border-[#FFC000]/30 transition-all placeholder:text-slate-600";

export const ResourcesView: React.FC = () => {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [navigationPath, setNavigationPath] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [subjectLinks, setSubjectLinks] = useState<any[]>([]);

  const availableSubjects = useMemo(() => {
    if (navigationPath.length === 0) return [];
    return SUBJECTS_BY_SEM[navigationPath[0]] || [];
  }, [navigationPath]);

  const getResourceCount = (sem?: string, sub?: string, cat?: string) =>
    resources.filter(r => {
      const matchSem = !sem || r.semester === sem;
      const matchSub = !sub || r.subject_name === sub;
      const matchCat = !cat || r.category === cat;
      return matchSem && matchSub && matchCat;
    }).length;

  const [uploadForm, setUploadForm] = useState({
    title: '', description: '', semester: 'Sem1', category: 'midsem',
    subject_name: '', course_code: '',
  });

  // Sync upload form with current navigation when modal opens
  useEffect(() => {
    if (showUploadModal) {
      const sem = navigationPath[0] || 'Sem1';
      const cat = (navigationPath.length === 3) ? navigationPath[2] : 'midsem';
      const sub = navigationPath[1] || SUBJECTS_BY_SEM[sem]?.[0] || '';
      
      setUploadForm(prev => ({
        ...prev,
        semester: sem,
        category: CATEGORIES.some(c => c.id === cat) ? cat : 'midsem',
        subject_name: sub
      }));
    }
  }, [showUploadModal, navigationPath]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const fetchResources = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) setIsLoadingMore(true);
    else setLoading(true);
    
    const targetPage = isLoadMore ? page + 1 : 1;
    try {
      const res = await apiRequest(`/api/resources?page=${targetPage}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        if (isLoadMore) {
          setResources(prev => [...prev, ...data]);
          setPage(targetPage);
        } else {
          setResources(data);
          setPage(1);
        }
        setHasMore(data.length === 50);
      }
    } catch (error) { console.error('Failed to fetch resources:', error); }
    finally { 
      setLoading(false); 
      setIsLoadingMore(false);
    }
  }, [page]);

  const fetchSubjectLinks = useCallback(async () => {
    try {
      const res = await apiRequest('/api/resources/subject-links');
      if (res.ok) setSubjectLinks(await res.json());
    } catch (error) { console.error('Failed to fetch subject links:', error); }
  }, []);

  useEffect(() => { 
    fetchResources(); 
    fetchSubjectLinks();
  }, [fetchResources, fetchSubjectLinks]);

  const handleDownload = (resource: Resource) => {
    const a = document.createElement('a');
    a.href = `${API_BASE_URL}/api/resources/${resource.id}/download`;
    a.download = `${resource.title}.${resource.file_type}`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
      const res = await apiRequest('/api/resources', { method: 'POST', body: formData });
      if (res.ok) {
        toast.success("Contribution submitted! Thank you.");
        setShowUploadModal(false);
        setUploadForm({
          title: '', description: '',
          semester: navigationPath[0] || 'Sem1',
          category: (navigationPath.length === 3) ? navigationPath[2] : 'midsem',
          subject_name: navigationPath[1] || SUBJECTS_BY_SEM[navigationPath[0] || 'Sem1']?.[0] || '',
          course_code: '',
        });
        setUploadFile(null);
        fetchResources();
      } else {
        if (res.status === 413) {
          toast.error("File is too large! Maximum limit is 50MB.");
        } else {
          const ct = res.headers.get("content-type");
          if (ct?.includes("application/json")) {
            const data = await res.json();
            toast.error(data.error || "Upload failed.");
          } else {
            toast.error(`Server error (${res.status}).`);
          }
        }
      }
    } catch (error: any) { toast.error(error.message || "Network error."); }
    finally { setIsUploading(false); }
  };

  const isSearchMode = searchTerm.length > 0;

  const filteredResources = useMemo(() => {
    return resources.filter(r => {
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
  }, [resources, isSearchMode, searchTerm, navigationPath]);

  // ── Breadcrumbs ──────────────────────────────────────────────────
  const renderBreadcrumbs = () => (
    <div className="flex items-center gap-2 mb-6 text-xs font-bold text-slate-500 overflow-x-auto whitespace-nowrap scrollbar-hide">
      <button onClick={() => setNavigationPath([])} className="hover:text-[#FFC000] flex items-center gap-1.5 transition-colors shrink-0">
        <FolderOpen className="h-3.5 w-3.5" /> Resources
      </button>
      {navigationPath.map((path, idx) => (
        <React.Fragment key={path + idx}>
          <ChevronRight className="h-3 w-3 opacity-25 shrink-0" />
          <button
            onClick={() => setNavigationPath(navigationPath.slice(0, idx + 1))}
            className={`transition-colors shrink-0 ${idx === navigationPath.length - 1 ? 'text-white font-black' : 'hover:text-[#FFC000]'}`}
          >
            {path.startsWith('Sem') ? path.replace('Sem', 'Semester ') : CATEGORIES.find(c => c.id === path)?.label || path}
          </button>
        </React.Fragment>
      ))}
    </div>
  );

  // ── Back button ──────────────────────────────────────────────────
  const BackButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
    <button onClick={onClick} className="flex items-center gap-2 text-[10px] font-black text-[#FFC000]/70 hover:text-[#FFC000] uppercase tracking-widest mb-4 transition-colors group">
      <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" /> {label}
    </button>
  );

  // ── Empty state ──────────────────────────────────────────────────
  const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="col-span-full py-20 text-center bg-slate-900/30 rounded-3xl border border-dashed border-white/5">
      <p className="text-slate-500 font-bold text-sm">{message}</p>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-[#FFC000]/10 text-[#FFC000] text-[9px] font-black uppercase tracking-wider rounded-md">Repository</span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Free Study Hub</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-1.5 tracking-tight">Free Study Materials</h1>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
            Browse by semester → subject → category. Contribute to help your peers.
          </p>
        </div>

        <button
          onClick={() => {
            if (!user) { toast.error("Please sign in to contribute materials"); return; }
            setShowUploadModal(true);
          }}
          className="flex items-center gap-2 bg-[#FFC000] hover:bg-[#e6ac00] text-slate-900 px-5 py-3 rounded-2xl font-black text-sm transition-all shadow-xl shadow-[#FFC000]/20 active:scale-95 shrink-0 self-start sm:self-auto"
        >
          <Upload className="h-4 w-4 stroke-[2.5px]" />
          Contribute
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search all materials by title, subject or course code…"
          className="w-full bg-slate-900 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/20 focus:border-[#FFC000]/30 transition-all placeholder:text-slate-600"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/5 rounded-full transition-colors">
            <X className="h-3.5 w-3.5 text-slate-500" />
          </button>
        )}
      </div>

      {!isSearchMode && renderBreadcrumbs()}

      {/* Grid content */}
      <AnimatePresence mode="wait">

        {/* Loading */}
        {loading ? (
          <motion.div key="loading" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square bg-slate-900/50 rounded-3xl animate-pulse" />
            ))}
          </motion.div>

          /* Search results */
        ) : isSearchMode ? (
          <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredResources.length === 0
              ? <EmptyState message={`No results for "${searchTerm}"`} />
              : filteredResources.map(r => <ResourceCard key={r.id} resource={r} onDownload={() => handleDownload(r)} />)
            }
          </motion.div>

          /* Root — semester folders */
        ) : navigationPath.length === 0 ? (
          <motion.div key="root" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {SEMESTERS.slice(1).map(sem => {
              const semLink = subjectLinks.find(l => l.semester === sem && (l.subject_name === '' || l.subject_name === null));
              return (
                <FolderItem
                  key={sem}
                  label={sem.replace('Sem', 'Sem ')}
                  count={getResourceCount(sem)}
                  hasDriveLink={!!semLink}
                  onClick={() => setNavigationPath([sem])}
                />
              );
            })}
          </motion.div>

          /* Semester — subject folders */
        ) : navigationPath.length === 1 ? (
          <motion.div key="semester" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <BackButton label="All Semesters" onClick={() => setNavigationPath([])} />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {availableSubjects.length === 0
                ? <EmptyState message="No subjects found in this semester yet." />
                : availableSubjects.map(sub => {
                  const subLink = subjectLinks.find(l => l.semester === navigationPath[0] && l.subject_name === sub);
                  return (
                    <FolderItem
                      key={sub}
                      label={sub}
                      icon={<BookOpen className="h-7 w-7" />}
                      count={getResourceCount(navigationPath[0], sub)}
                      hasDriveLink={!!subLink}
                      onClick={() => setNavigationPath([navigationPath[0], sub])}
                    />
                  );
                })
              }
            </div>
            
            {/* Semester General Drive Link */}
            {(() => {
              const semLink = subjectLinks.find(l => l.semester === navigationPath[0] && (l.subject_name === '' || l.subject_name === null));
              if (!semLink) return null;
              return (
                <a 
                  href={semLink.drive_link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-5 bg-[#FFC000]/10 border border-[#FFC000]/20 rounded-3xl group hover:bg-[#FFC000]/20 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#FFC000] flex items-center justify-center text-slate-900 shadow-lg shadow-[#FFC000]/20">
                      <FolderOpen className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-white text-base">Open {navigationPath[0].replace('Sem', 'Semester ')} Google Drive</h4>
                      <p className="text-xs text-[#FFC000]/70 font-bold uppercase tracking-widest">Shared Resource Folder</p>
                    </div>
                  </div>
                  <ExternalLink className="h-5 w-5 text-[#FFC000] group-hover:translate-x-1 transition-transform" />
                </a>
              );
            })()}
          </motion.div>

          /* Subject — category folders */
        ) : navigationPath.length === 2 ? (
          <motion.div key="subject" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <BackButton label={`Back to ${navigationPath[0].replace('Sem', 'Semester ')}`} onClick={() => setNavigationPath([navigationPath[0]])} />
            
            {/* Subject General Drive Link */}
            {(() => {
              const subLink = subjectLinks.find(l => l.semester === navigationPath[0] && l.subject_name === navigationPath[1]);
              if (!subLink) return null;
              return (
                <a 
                  href={subLink.drive_link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-5 bg-[#FFC000]/10 border border-[#FFC000]/20 rounded-3xl group hover:bg-[#FFC000]/20 transition-all mb-6"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#FFC000] flex items-center justify-center text-slate-900 shadow-lg shadow-[#FFC000]/20">
                      <FolderOpen className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-white text-base">Open {navigationPath[1]} Google Drive</h4>
                      <p className="text-xs text-[#FFC000]/70 font-bold uppercase tracking-widest">Subject Reference Folder</p>
                    </div>
                  </div>
                  <ExternalLink className="h-5 w-5 text-[#FFC000] group-hover:translate-x-1 transition-transform" />
                </a>
              );
            })()}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {CATEGORIES.slice(1).map(cat => (
                <FolderItem
                  key={cat.id}
                  label={cat.label}
                  icon={<cat.icon className="h-7 w-7" />}
                  count={getResourceCount(navigationPath[0], navigationPath[1], cat.id)}
                  onClick={() => setNavigationPath([navigationPath[0], navigationPath[1], cat.id])}
                />
              ))}
            </div>
          </motion.div>

          /* Category — resource cards */
        ) : (
          <motion.div key="category" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <BackButton label={`Back to ${navigationPath[1]}`} onClick={() => setNavigationPath([navigationPath[0], navigationPath[1]])} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredResources.length === 0
                ? <EmptyState message="No materials uploaded in this category yet." />
                : filteredResources.map(r => <ResourceCard key={r.id} resource={r} onDownload={() => handleDownload(r)} />)
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Load More Button */}
      {!loading && !isSearchMode && hasMore && resources.length > 0 && (
        <div className="mt-12 flex justify-center">
          <button
            onClick={() => fetchResources(true)}
            disabled={isLoadingMore}
            className="flex items-center gap-2 bg-slate-900 border border-white/10 hover:border-[#FFC000]/30 text-white px-8 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoadingMore ? (
              <><span className="h-4 w-4 border-2 border-white/20 border-t-white animate-spin rounded-full" /> Loading more…</>
            ) : (
              <>Load More Materials</>
            )}
          </button>
        </div>
      )}

      {/* Upload modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowUploadModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="relative w-full sm:max-w-xl bg-slate-900 border border-white/10 rounded-t-[2rem] sm:rounded-[2rem] p-6 sm:p-8 shadow-2xl max-h-[92dvh] overflow-y-auto"
            >
              {/* Drag handle */}
              <div className="sm:hidden w-10 h-1 rounded-full bg-white/10 mx-auto mb-5" />

              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-black text-white">Share Materials</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Help your peers by contributing study resources</p>
                </div>
                <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <GoldLabel>Title</GoldLabel>
                    <input
                      type="text" required placeholder="e.g. 2023 End Sem Paper"
                      value={uploadForm.title}
                      onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })}
                      className={darkInput}
                    />
                  </div>
                  <div>
                    <GoldLabel>Semester</GoldLabel>
                    <select
                      value={uploadForm.semester}
                      onChange={e => {
                        const newSem = e.target.value;
                        setUploadForm({ ...uploadForm, semester: newSem, subject_name: SUBJECTS_BY_SEM[newSem]?.[0] || '' });
                      }}
                      className={`${darkInput} appearance-none`}
                    >
                      {SEMESTERS.slice(1).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <GoldLabel>Category</GoldLabel>
                    <select
                      value={uploadForm.category}
                      onChange={e => setUploadForm({ ...uploadForm, category: e.target.value })}
                      className={`${darkInput} appearance-none`}
                    >
                      {CATEGORIES.slice(1).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <GoldLabel>Subject</GoldLabel>
                    <select
                      required value={uploadForm.subject_name}
                      onChange={e => setUploadForm({ ...uploadForm, subject_name: e.target.value })}
                      className={`${darkInput} appearance-none`}
                    >
                      <option value="" disabled>Select subject…</option>
                      {(SUBJECTS_BY_SEM[uploadForm.semester] || []).map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* File drop zone */}
                <div>
                  <GoldLabel>File (PDF, Docx, PPT, Excel, Images, Zip)</GoldLabel>
                  <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-7 cursor-pointer group transition-all ${uploadFile ? 'border-[#FFC000]/40 bg-[#FFC000]/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                    }`}>
                    {uploadFile ? (
                      <>
                        <div className="w-10 h-10 rounded-2xl bg-[#FFC000]/10 flex items-center justify-center mb-2">
                          <FileText className="h-5 w-5 text-[#FFC000]" />
                        </div>
                        <span className="text-sm font-bold text-[#FFC000] text-center">{uploadFile.name}</span>
                        <span className="text-[10px] text-slate-500 mt-1">Tap to change file</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-slate-600 group-hover:text-slate-400 transition-colors mb-2" />
                        <span className="text-sm font-bold text-slate-500 group-hover:text-slate-300 transition-colors">Select or drop file here</span>
                        <span className="text-[10px] text-slate-600 mt-1">PDF, Docx, PPT, XLS, Images, Zip</span>
                      </>
                    )}
                    <input
                      type="file" className="hidden"
                      accept=".pdf,.docx,.doc,.zip,.ppt,.pptx,.xls,.xlsx,.jpg,.png,.jpeg,.webp"
                      onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                <button
                  disabled={isUploading || !uploadFile}
                  className="w-full bg-[#FFC000] hover:bg-[#e6ac00] disabled:opacity-50 text-slate-900 py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#FFC000]/20 active:scale-[0.98]"
                >
                  {isUploading ? (
                    <><span className="h-4 w-4 border-2 border-slate-900/30 border-t-slate-900 animate-spin rounded-full" /> Uploading…</>
                  ) : (
                    <><Upload className="h-4 w-4 stroke-[2.5px]" /> Submit Contribution</>
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

// ── FolderItem ─────────────────────────────────────────────────────
const FolderItem: React.FC<{
  label: string; count: number; icon?: React.ReactNode; hasDriveLink?: boolean; onClick: () => void;
}> = ({ label, count, icon, hasDriveLink, onClick }) => (
  <button
    onClick={onClick}
    className="group flex flex-col items-center p-4 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-[#FFC000]/30 hover:bg-[#FFC000]/5 transition-all active:scale-95 relative"
  >
    {hasDriveLink && (
      <div className="absolute top-2 right-2 p-1 bg-[#FFC000]/10 rounded-lg text-[#FFC000]">
        <ExternalLink className="h-2.5 w-2.5" />
      </div>
    )}
    <div className="relative w-12 h-12 flex items-center justify-center text-slate-600 group-hover:text-[#FFC000] transition-colors mb-2.5">
      {icon || <FolderOpen className="h-8 w-8" />}
      {count > 0 && (
        <span className="absolute -top-1 -right-1.5 bg-[#FFC000] text-slate-900 text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg leading-none">
          {count}
        </span>
      )}
    </div>
    <span className="text-[10px] font-black text-slate-400 group-hover:text-white transition-colors text-center line-clamp-2 leading-tight">{label}</span>
  </button>
);

// ── ResourceCard ───────────────────────────────────────────────────
const ResourceCard: React.FC<{ resource: Resource; onDownload: () => void }> = ({ resource, onDownload }) => (
  <motion.div
    layout
    className="group bg-slate-900 border border-white/8 rounded-3xl p-5 hover:border-[#FFC000]/30 transition-all duration-300 flex flex-col relative overflow-hidden"
  >
    {/* File type badge — top right on hover */}
    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
      <span className="bg-[#FFC000] text-slate-900 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
        {resource.file_type}
      </span>
    </div>

    {/* Meta */}
    <div className="flex items-center gap-2 text-[9px] font-black text-[#FFC000]/70 uppercase tracking-widest mb-2.5">
      <span>{CATEGORIES.find(c => c.id === resource.category)?.label}</span>
      <span className="w-1 h-1 rounded-full bg-slate-700" />
      <span>{resource.semester}</span>
    </div>

    {/* Title + subject */}
    <h3 className="text-base font-bold text-white group-hover:text-[#FFC000] transition-colors line-clamp-1 mb-1 leading-tight">
      {resource.title}
    </h3>
    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium mb-3">
      <BookOpen className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {resource.subject_name}
        {resource.course_code && ` (${resource.course_code})`}
      </span>
    </div>

    {/* Description */}
    <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed flex-1 mb-5">
      {resource.description || 'No additional description provided.'}
    </p>

    {/* Footer */}
    <div className="flex items-center justify-between pt-4 border-t border-white/5">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[9px] font-black text-slate-400 shrink-0">
          {resource.uploader_name.charAt(0).toUpperCase()}
        </div>
        <span className="text-[10px] font-bold text-slate-500 truncate">{resource.uploader_name}</span>
      </div>

      <button
        onClick={onDownload}
        className="flex items-center gap-2 text-white shrink-0 group/dl"
      >
        <div className="text-right">
          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 group-hover/dl:text-white transition-colors">Download</p>
          <p className="text-[9px] text-slate-600">{resource.download_count} downloads</p>
        </div>
        <div className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center group-hover/dl:bg-[#FFC000] group-hover/dl:text-slate-900 transition-all active:scale-90">
          <Download className="h-4 w-4" />
        </div>
      </button>
    </div>
  </motion.div>
);