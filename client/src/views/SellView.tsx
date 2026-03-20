import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen, Camera, MapPin, ChevronRight, ChevronLeft,
  Check, PlusCircle, Upload, Info, Shield, X, Trash2,
  Banknote, CreditCard,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { getPlatformFeeConfig } from '../utils/formatters';
import { apiRequest } from '../utils/api';
import { toast } from 'react-hot-toast';
import { SUBJECTS_BY_SEM, LOCATIONS, STANDARD_SPOTS } from '../utils/constants';

// ── Types ──────────────────────────────────────────────────────────
interface ImageUpload {
  file: File;
  preview: string;
  url: string | null;
  isUploading: boolean;
  error: string | null;
}

interface FormData {
  images: ImageUpload[];
  materialType: string;
  semester: string;
  courseCode: string;
  isMultipleSubjects: boolean;
  subjects: string[];
  title: string;
  description: string;
  price: string;
  quantity: string;
  condition: string;
  location: string;
  customLocation: string;
  deliveryMethod: string;
  preferredMeetupSpot: string;
  meetupLocation: string;
  isDonation: boolean;
}

const INITIAL_FORM: FormData = {
  images: [],
  materialType: 'PPT',
  semester: '',
  courseCode: '',
  isMultipleSubjects: false,
  subjects: [],
  title: '',
  description: '',
  price: '',
  quantity: '1',
  condition: 'Good',
  location: LOCATIONS[0],
  customLocation: '',
  deliveryMethod: 'in_person',
  preferredMeetupSpot: STANDARD_SPOTS[0],
  meetupLocation: '',
  isDonation: false,
};

const STEPS = [
  { id: 1, label: 'Photo', icon: Camera },
  { id: 2, label: 'Course', icon: BookOpen },
  { id: 3, label: 'Details', icon: MapPin },
];

// ── Small helpers ──────────────────────────────────────────────────
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">{children}</p>
);

const inputClass = "w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-text-main placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all";

// ── Toggle ─────────────────────────────────────────────────────────
const Toggle: React.FC<{ checked: boolean; onChange: () => void; color?: string }> = ({
  checked, onChange, color = 'bg-primary',
}) => (
  <button
    type="button"
    onClick={onChange}
    className={`w-11 h-6 rounded-full p-1 transition-all shrink-0 ${checked ? color : 'bg-slate-300 dark:bg-slate-700'}`}
  >
    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
  </button>
);

// ── Image compression ─────────────────────────────────────────────
const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 1200;
        let { width, height } = img;
        if (width > height) { if (width > MAX) { height *= MAX / width; width = MAX; } }
        else { if (height > MAX) { width *= MAX / height; height = MAX; } }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          resolve(blob ? new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }) : file);
        }, 'image/jpeg', 0.8);
      };
    };
  });
};

// ── Main component ─────────────────────────────────────────────────
export const SellView: React.FC<{ onGoToBrowse?: () => void }> = ({ onGoToBrowse }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormData>(INITIAL_FORM);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);

  const { settings } = useSettings();
  const PLATFORM_FEE_PERCENTAGE = settings?.platform_fee_percentage ?? 0;
  const platformFee = Math.round(Number(form.price || 0) * (PLATFORM_FEE_PERCENTAGE / 100));

  const set = (key: keyof FormData, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const uploadFile = async (index: number, file: File) => {
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await apiRequest('/api/listings/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setForm(prev => {
        const imgs = [...prev.images];
        if (imgs[index]) imgs[index] = { ...imgs[index], url: data.url, isUploading: false };
        return { ...prev, images: imgs };
      });
    } catch (err: any) {
      setForm(prev => {
        const imgs = [...prev.images];
        if (imgs[index]) imgs[index] = { ...imgs[index], isUploading: false, error: err.message };
        return { ...prev, images: imgs };
      });
      toast.error(`Image upload failed: ${err.message}`);
    }
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!files.length) return;
    const newFiles = files.slice(0, 3 - form.images.length);
    if (!newFiles.length) { toast.error('You can only upload up to 3 images.'); return; }
    for (const file of newFiles) {
      const preview = URL.createObjectURL(file);
      setForm(prev => {
        if (prev.images.length >= 3) return prev;
        const newEntry: ImageUpload = { file, preview, url: null, isUploading: true, error: null };
        const updated = [...prev.images, newEntry];
        const idx = updated.length - 1;
        (async () => { const compressed = await compressImage(file); uploadFile(idx, compressed); })();
        return { ...prev, images: updated };
      });
    }
  };

  const removeImage = (index: number) => {
    const imgs = [...form.images];
    URL.revokeObjectURL(imgs[index].preview);
    imgs.splice(index, 1);
    set('images', imgs);
  };

  const toggleSubject = (s: string) =>
    set('subjects', form.subjects.includes(s) ? form.subjects.filter(x => x !== s) : [...form.subjects, s]);

  const canProceed = () => {
    if (step === 1) return form.images.length > 0 && !form.images.some(img => img.isUploading);
    if (step === 2) {
      if (!form.semester || !form.title) return false;
      if (form.isMultipleSubjects) return form.subjects.length > 0;
      return !!form.courseCode;
    }
    if (step === 3) {
      if (form.location === 'Other (Manual)' && !form.customLocation.trim()) return false;
      if (form.deliveryMethod !== 'courier') {
        if (!form.preferredMeetupSpot) return false;
        if (!form.meetupLocation.trim()) return false;
      }
      if (form.isDonation) return true;
      return !!form.price && Number(form.price) > 0;
    }
    return false;
  };

  const handleSubmit = async () => {
    if (!user) { setError('Please sign in to sell notes.'); return; }
    if (form.images.some(img => img.isUploading)) { toast.error('Please wait for all images to finish uploading.'); return; }
    setIsSubmitting(true); setError('');
    try {
      const typeMap: Record<string, string> = { 'Handwritten Notes': 'handwritten', 'PPT': 'ppt', 'Book': 'book' };
      const res = await apiRequest('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          course_code: form.isMultipleSubjects ? 'Multiple' : form.courseCode,
          semester: form.semester,
          condition: form.condition,
          price: form.price,
          location: form.location === 'Other (Manual)' ? form.customLocation : form.location,
          quantity: form.quantity,
          material_type: typeMap[form.materialType] || 'other',
          is_multiple_subjects: form.isMultipleSubjects,
          imageUrls: form.images.map(img => img.url).filter(Boolean),
          delivery_method: form.deliveryMethod,
          preferred_meetup_spot: form.deliveryMethod !== 'courier' ? form.preferredMeetupSpot : undefined,
          meetup_location: form.deliveryMethod !== 'courier' ? form.meetupLocation : undefined,
          subjects: form.isMultipleSubjects ? form.subjects : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create listing');
      setSuccess(true);
    } catch (err: any) { setError(err.message); }
    finally { setIsSubmitting(false); }
  };

  // ── Success screen ─────────────────────────────────────────────
  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto px-4 py-28 text-center"
      >
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Check className="h-10 w-10 text-white" />
          </div>
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
        </div>
        <h2 className="text-2xl font-black text-text-main mb-3 tracking-tight">Listing Published!</h2>
        <p className="text-sm text-text-muted mb-10 leading-relaxed max-w-xs mx-auto">
          Your notes are now live. Buyers searching for your course code can find and purchase them.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 max-w-xs mx-auto">
          <button
            onClick={() => { setSuccess(false); setStep(1); setForm(INITIAL_FORM); }}
            className="flex-1 py-3.5 bg-surface border border-border text-text-main rounded-2xl font-black text-xs uppercase tracking-wider transition-all active:scale-95"
          >
            List Another
          </button>
          <button
            onClick={() => onGoToBrowse?.()}
            className="flex-1 py-3.5 bg-primary text-black rounded-2xl font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-primary/20"
          >
            Browse Notes
          </button>
        </div>
      </motion.div>
    );
  }

  const subjects = form.semester ? SUBJECTS_BY_SEM[form.semester] || [] : [];
  const priceNum = Number(form.price);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="max-w-lg mx-auto px-4 sm:px-6 py-8 pb-24"
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-text-main tracking-tight mb-1">List Your Notes</h1>
        <p className="text-sm text-text-muted">Three quick steps to go live.</p>
      </div>

      {/* Launch promo banner */}
      {PLATFORM_FEE_PERCENTAGE === 0 && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl flex items-start gap-3">
          <div className="p-1.5 bg-emerald-600 rounded-lg shrink-0">
            <Shield className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">Launch Promo: 0% Fee</p>
            <p className="text-xs text-text-muted leading-relaxed">
              During our launch, we've <strong>waived the platform fee</strong>. You keep <strong>100% of your listing price</strong> paid in <strong>cash</strong> at hand-over.
            </p>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => {
          const done = step > s.id;
          const active = step === s.id;
          return (
            <React.Fragment key={s.id}>
              <div className={`flex items-center gap-2 ${active ? 'text-primary' : done ? 'text-emerald-500' : 'text-text-muted'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${done ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600' :
                    active ? 'border-primary bg-primary text-black' :
                      'border-border bg-surface text-text-muted'
                  }`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : s.id}
                </div>
                <span className={`text-xs font-bold hidden sm:block ${active ? 'text-text-main' : 'text-text-muted opacity-50'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2.5 rounded-full transition-colors ${done ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-border'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Card */}
      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
        <AnimatePresence mode="wait">

          {/* ── STEP 1: Photos ── */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="p-5 sm:p-7 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-text-main">Upload Photos</h2>
                  <p className="text-xs text-text-muted mt-0.5">Clear photos help buyers see what they're getting.</p>
                </div>
                <span className="text-[10px] font-black text-text-muted bg-background border border-border px-2.5 py-1 rounded-full">
                  {form.images.length}/3
                </span>
              </div>

              {/* Image grid */}
              <div className="grid grid-cols-3 gap-3">
                <AnimatePresence>
                  {form.images.map((img, index) => (
                    <motion.div
                      key={img.preview}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.15 }}
                      className="relative aspect-square rounded-2xl overflow-hidden border border-border group"
                    >
                      <img
                        src={img.preview}
                        alt={`Preview ${index + 1}`}
                        className={`w-full h-full object-cover transition-all ${img.isUploading ? 'opacity-40 grayscale' : ''}`}
                      />

                      {/* Status overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {img.isUploading && (
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            <span className="text-[9px] font-bold text-white bg-black/50 px-2 py-0.5 rounded-full">Uploading</span>
                          </div>
                        )}
                        {!img.isUploading && img.url && (
                          <div className="bg-emerald-500 p-1 rounded-full shadow-lg">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                        {img.error && (
                          <div className="bg-red-500 p-1 rounded-full shadow-lg" title={img.error}>
                            <X className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-1.5 right-1.5 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10 active:scale-90"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>

                      {/* Main badge */}
                      {index === 0 && (
                        <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-primary text-black text-[9px] font-black rounded-lg z-10">
                          Main
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Add photo slot */}
                {form.images.length < 3 && (
                  <label
                    htmlFor="img-upload"
                    className="aspect-square border-2 border-dashed border-border hover:border-primary rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group bg-background"
                  >
                    <input id="img-upload" type="file" accept="image/*" multiple className="hidden" onChange={handleImage} />
                    <div className="p-2.5 bg-surface border border-border group-hover:border-primary/30 rounded-xl transition-all">
                      <Camera className="h-5 w-5 text-text-muted group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-[10px] font-bold text-text-muted group-hover:text-primary transition-colors">Add Photo</span>
                  </label>
                )}
              </div>

              {/* Allowed materials */}
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/40 rounded-xl">
                <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <Info className="h-3.5 w-3.5" /> Allowed materials
                </p>
                <ul className="text-xs text-text-muted space-y-1.5">
                  {[
                    ['PPTs', 'Bound hard copies of faculty slides only'],
                    ['Books', 'Prescribed/reference from reputed publishers'],
                    ['Notes', 'Structured, properly bound notebooks only'],
                  ].map(([title, desc]) => (
                    <li key={title} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span><strong className="text-text-main">{title}:</strong> {desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: Course details ── */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="p-5 sm:p-7 space-y-5">
              <div>
                <h2 className="text-base font-black text-text-main">Course Details</h2>
                <p className="text-xs text-text-muted mt-0.5">What are you selling?</p>
              </div>

              {/* Material type */}
              <div>
                <Label>Material Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {['PPT', 'Handwritten Notes', 'Book'].map(t => (
                    <button key={t} type="button"
                      onClick={() => { set('materialType', t); if (t !== 'PPT') set('isMultipleSubjects', false); }}
                      className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all ${form.materialType === t
                          ? 'bg-primary text-black border-transparent shadow-sm'
                          : 'bg-background border-border text-text-muted hover:border-primary/30'
                        }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Semester */}
              <div>
                <Label>Semester</Label>
                <select value={form.semester} onChange={e => { set('semester', e.target.value); set('courseCode', ''); set('subjects', []); }} className={inputClass}>
                  <option value="">Select semester...</option>
                  {Object.keys(SUBJECTS_BY_SEM).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Multiple subjects toggle */}
              {form.materialType === 'PPT' && form.semester && (
                <div className="flex items-center justify-between p-3.5 bg-background rounded-xl border border-border">
                  <div>
                    <p className="text-sm font-bold text-text-main">Multiple subjects?</p>
                    <p className="text-xs text-text-muted mt-0.5">One print covering several courses</p>
                  </div>
                  <Toggle
                    checked={form.isMultipleSubjects}
                    onChange={() => { set('isMultipleSubjects', !form.isMultipleSubjects); set('subjects', []); set('courseCode', ''); }}
                  />
                </div>
              )}

              {/* Single course */}
              {form.semester && !form.isMultipleSubjects && (
                <div>
                  <Label>Course</Label>
                  <select value={form.courseCode} onChange={e => set('courseCode', e.target.value)} className={inputClass}>
                    <option value="">Select course...</option>
                    {subjects.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {/* Multiple courses checklist */}
              {form.semester && form.isMultipleSubjects && (
                <div>
                  <Label>Select Subjects ({form.subjects.length} selected)</Label>
                  <div className="rounded-xl border border-border divide-y divide-border/60 max-h-52 overflow-y-auto">
                    {subjects.map(s => (
                      <label key={s} className={`flex items-center gap-3 py-2.5 px-3 cursor-pointer transition-colors ${form.subjects.includes(s) ? 'bg-primary/5' : 'hover:bg-background'}`}>
                        <input type="checkbox" checked={form.subjects.includes(s)} onChange={() => toggleSubject(s)}
                          className="rounded border-border text-primary focus:ring-primary" />
                        <span className="text-xs text-text-main">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <Label>Listing Title</Label>
                <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g., Complete annotated OS slides" className={inputClass} />
              </div>

              {/* Description */}
              <div>
                <Label>Description <span className="normal-case text-[9px] font-medium">(optional)</span></Label>
                <textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="What's included? (e.g. Handwritten notes + 5 years of PYQs + colored diagrams)"
                  className={`${inputClass} min-h-[90px] resize-none`}
                />
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: Pricing & pickup ── */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="p-5 sm:p-7 space-y-5">
              <div>
                <h2 className="text-base font-black text-text-main">Pricing & Pickup</h2>
                <p className="text-xs text-text-muted mt-0.5">Set your price and exchange details.</p>
              </div>

              {/* Donation toggle */}
              <div className="flex items-center justify-between p-3.5 bg-background rounded-xl border border-border">
                <div>
                  <p className="text-sm font-bold text-text-main">Mark as Donation?</p>
                  <p className="text-xs text-text-muted mt-0.5">List this item for FREE (₹0)</p>
                </div>
                <Toggle
                  checked={form.isDonation}
                  color="bg-emerald-500"
                  onChange={() => {
                    const next = !form.isDonation;
                    set('isDonation', next);
                    if (next) set('price', '0');
                    else if (form.price === '0') set('price', '');
                  }}
                />
              </div>

              {/* Price + quantity */}
              <div className={`grid grid-cols-2 gap-4 transition-opacity ${form.isDonation ? 'opacity-40 pointer-events-none' : ''}`}>
                <div>
                  <Label>Price (₹)</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-semibold text-sm pointer-events-none">₹</span>
                    <input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="250" disabled={form.isDonation} className={`${inputClass} pl-8`} />
                  </div>
                </div>
                <div>
                  <Label>Quantity</Label>
                  <input type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} className={inputClass} />
                </div>
              </div>

              {/* Condition + location */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Condition</Label>
                  <select value={form.condition} onChange={e => set('condition', e.target.value)} className={inputClass}>
                    {['Like New', 'Good', 'Fair', 'Heavily Annotated'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>City / Region</Label>
                  <select value={form.location} onChange={e => { set('location', e.target.value); set('preferredMeetupSpot', STANDARD_SPOTS[0]); }} className={inputClass}>
                    {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              {/* Custom location */}
              {form.location === 'Other (Manual)' && (
                <div>
                  <Label>Specify City / Region <span className="text-red-500 text-[9px] font-bold">(Required)</span></Label>
                  <input type="text" value={form.customLocation} onChange={e => set('customLocation', e.target.value)} placeholder="e.g. Mumbai, Kolkata, Pilani..." className={inputClass} />
                </div>
              )}

              {/* Delivery method */}
              <div>
                <Label>Delivery Method</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'in_person', label: 'In-Person' },
                    { value: 'courier', label: 'Courier' },
                    { value: 'both', label: 'Both' },
                  ].map(opt => {
                    const comingSoon = opt.value === 'courier' || opt.value === 'both';
                    return (
                      <button key={opt.value} type="button"
                        onClick={() => !comingSoon && set('deliveryMethod', opt.value)}
                        disabled={comingSoon}
                        className={`py-3 rounded-xl text-xs font-bold border transition-all relative overflow-hidden ${form.deliveryMethod === opt.value ? 'bg-primary text-black border-transparent shadow-sm' : 'bg-background border-border text-text-muted'
                          } ${comingSoon ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/30'}`}>
                        {opt.label}
                        {comingSoon && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px]">
                            <span className="text-[8px] rotate-12 bg-amber-500 text-black px-1 rounded font-black uppercase">Soon</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Meetup spot + details */}
              {form.deliveryMethod !== 'courier' && (
                <>
                  <div>
                    <Label>Preferred Hand-over Spot <span className="text-red-500 text-[9px] font-bold">(Required)</span></Label>
                    <select value={form.preferredMeetupSpot} onChange={e => set('preferredMeetupSpot', e.target.value)} className={inputClass}>
                      {STANDARD_SPOTS.map(spot => <option key={spot} value={spot}>{spot}</option>)}
                      <option value="Other">Other (Specify below)</option>
                    </select>
                  </div>
                  <div>
                    <Label>Specific Instructions / Custom Location <span className="text-red-500 text-[9px] font-bold">(Required)</span></Label>
                    <input type="text" value={form.meetupLocation} onChange={e => set('meetupLocation', e.target.value)} placeholder="e.g. hcl 126, cafe 3..." className={inputClass} />
                  </div>
                </>
              )}

              {/* Price breakdown */}
              {form.price && (
                <div className="rounded-2xl border border-border overflow-hidden">
                  {(() => {
                    const config = getPlatformFeeConfig(PLATFORM_FEE_PERCENTAGE);
                    return (
                      <>
                        {/* Split tiles */}
                        <div className="grid grid-cols-2 divide-x divide-border">
                          <div className="p-3.5 flex flex-col gap-0.5 bg-primary/5">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <CreditCard className="h-3 w-3 text-primary shrink-0" />
                              <span className="text-[9px] font-black text-primary uppercase tracking-widest">Buyer Pays Online</span>
                            </div>
                            <p className="text-xl font-black text-text-main">₹{platformFee}</p>
                            <p className="text-[9px] text-text-muted">Platform fee</p>
                          </div>
                          <div className="p-3.5 flex flex-col gap-0.5 bg-surface">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Banknote className="h-3 w-3 text-emerald-600 shrink-0" />
                              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">You Receive</span>
                            </div>
                            <p className="text-xl font-black text-text-main">{priceNum === 0 ? 'FREE' : `₹${priceNum - platformFee}`}</p>
                            <p className="text-[9px] text-text-muted">Cash at meetup</p>
                          </div>
                        </div>

                        {/* Fee label bar */}
                        <div className={`px-4 py-2.5 border-t border-border flex items-center justify-between ${config.bgColor}`}>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${config.color}`}>
                            {config.label}: {config.desc}
                          </span>
                          <span className={`text-[10px] font-bold ${config.color}`}>Total: ₹{priceNum}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium">
                  {error}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer nav */}
        <div className="px-5 sm:px-7 py-4 bg-background border-t border-border flex justify-between items-center">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-text-muted hover:bg-surface transition-all disabled:opacity-0 disabled:pointer-events-none active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          <span className="text-[10px] font-black text-text-muted sm:hidden">{step} / {STEPS.length}</span>

          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-primary hover:bg-primary-hover text-black rounded-xl text-sm font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm active:scale-95"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !canProceed()}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-black rounded-xl text-sm font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm active:scale-95"
            >
              {isSubmitting
                ? <><span className="h-3.5 w-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" /> Publishing…</>
                : <><PlusCircle className="h-4 w-4" /> Publish Listing</>
              }
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};