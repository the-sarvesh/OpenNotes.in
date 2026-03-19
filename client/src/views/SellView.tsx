import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Camera, MapPin, ChevronRight, ChevronLeft, Check, PlusCircle, Upload, Info, Shield, X, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../utils/api';
import { toast } from 'react-hot-toast';

import { SUBJECTS_BY_SEM, LOCATIONS, STANDARD_SPOTS } from '../utils/constants';

interface ImageUpload {
  file: File;
  preview: string;
  url: string | null;      // Cloudinary URL (null if still uploading)
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
  customLocation: string; // New field for manual city entry
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

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] font-black text-text-muted uppercase tracking-widest mb-2">{children}</p>
);

const inputClass = "w-full px-4 py-3 bg-surface/80 border border-border rounded-xl text-sm text-text-main placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all";

const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.8);
      };
    };
  });
};

export const SellView: React.FC<{ onGoToBrowse?: () => void }> = ({ onGoToBrowse }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormData>(INITIAL_FORM);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const set = (key: keyof FormData, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const uploadFile = async (index: number, file: File) => {
    try {
      const fd = new FormData();
      fd.append('image', file);
      
      const res = await apiRequest('/api/listings/upload-image', {
        method: 'POST',
        body: fd,
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      setForm(prev => {
        const newImages = [...prev.images];
        if (newImages[index]) {
          newImages[index] = { ...newImages[index], url: data.url, isUploading: false };
        }
        return { ...prev, images: newImages };
      });
    } catch (err: any) {
      setForm(prev => {
        const newImages = [...prev.images];
        if (newImages[index]) {
          newImages[index] = { ...newImages[index], isUploading: false, error: err.message };
        }
        return { ...prev, images: newImages };
      });
      toast.error(`Image upload failed: ${err.message}`);
    }
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const totalRemaining = 3 - form.images.length;
    const newFiles = files.slice(0, totalRemaining);

    if (newFiles.length === 0) {
      toast.error('You can only upload up to 3 images.');
      return;
    }

    // Process one by one to avoid state race conditions easily
    for (const file of newFiles) {
      const preview = URL.createObjectURL(file);
      const tempId = form.images.length; // Approximate, will be correct in functional update
      
      setForm(prev => {
        if (prev.images.length >= 3) return prev;
        
        const newEntry: ImageUpload = {
          file,
          preview,
          url: null,
          isUploading: true,
          error: null
        };
        
        const updatedImages = [...prev.images, newEntry];
        const newIdx = updatedImages.length - 1;
        
        // Start compression and upload in background
        (async () => {
          const compressed = await compressImage(file);
          uploadFile(newIdx, compressed);
        })();
        
        return { ...prev, images: updatedImages };
      });
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...form.images];
    URL.revokeObjectURL(newImages[index].preview);
    newImages.splice(index, 1);
    set('images', newImages);
  };

  const toggleSubject = (s: string) =>
    set('subjects', form.subjects.includes(s)
      ? form.subjects.filter(x => x !== s)
      : [...form.subjects, s]);

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
    if (form.images.some(img => img.isUploading)) {
      toast.error('Please wait for all images to finish uploading.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const finalLocation = form.location === 'Other (Manual)' ? form.customLocation : form.location;
      
      // Map material type labels to backend-expected keys
      const typeMap: Record<string, string> = {
        'Handwritten Notes': 'handwritten',
        'PPT': 'printed',
        'Book': 'printed'
      };

      const imageUrls = form.images.map(img => img.url).filter(Boolean) as string[];

      const payload = {
        title: form.title,
        description: form.description,
        course_code: form.isMultipleSubjects ? 'Multiple' : form.courseCode,
        semester: form.semester,
        condition: form.condition,
        price: form.price,
        location: finalLocation,
        quantity: form.quantity,
        material_type: typeMap[form.materialType] || 'other',
        is_multiple_subjects: form.isMultipleSubjects, // Send as boolean
        imageUrls: imageUrls, // Send as array
        delivery_method: form.deliveryMethod,
        preferred_meetup_spot: form.deliveryMethod !== 'courier' ? form.preferredMeetupSpot : undefined,
        meetup_location: form.deliveryMethod !== 'courier' ? form.meetupLocation : undefined,
        subjects: form.isMultipleSubjects ? form.subjects : undefined, // Send as array
      };

      const res = await apiRequest('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create listing');
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto px-4 py-28 text-center"
      >
        <div className="relative w-24 h-24 mx-auto mb-7">
          <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Check className="h-12 w-12 text-white" />
          </div>
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
        </div>
        <h2 className="text-2xl font-black text-text-main mb-3 tracking-tight">Listing Published!</h2>
        <p className="text-text-muted mb-10 leading-relaxed">
          Your notes are now live. Buyers searching for your course code can find and purchase them.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
          <button
            onClick={() => { setSuccess(false); setStep(1); setForm(INITIAL_FORM); }}
            className="flex-1 px-6 py-3.5 bg-surface border border-border hover:bg-surface text-text-main rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-sm"
          >
            List Another
          </button>
          <button
            onClick={() => onGoToBrowse && onGoToBrowse()}
            className="flex-1 px-6 py-3.5 bg-[#003366] hover:bg-[#002244] text-white rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-md"
          >
            Buy Notes
          </button>
        </div>
      </motion.div>
    );
  }

  const subjects = form.semester ? SUBJECTS_BY_SEM[form.semester] || [] : [];
  const priceNum = Number(form.price);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-lg mx-auto px-4 sm:px-6 py-10 pb-24"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text-main tracking-tight mb-1">List Your Notes</h1>
        <p className="text-sm text-text-muted">Three quick steps to go live.</p>
      </div>

      {/* Selling Guide Note */}
      <div className="mb-8 p-5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-emerald-600 rounded-lg">
            <Shield className="h-3.5 w-3.5 text-white" />
          </div>
          <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Launch Promo: 0% Fee</p>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          List your notes for free. During our launch, we've <strong>waived the platform fee</strong>. You keep <strong>100% of your listing price</strong> which the buyer pays you in <strong>cash</strong> during the hand-over.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-10">
        {STEPS.map((s, i) => {
          const done = step > s.id;
          const active = step === s.id;
          return (
            <React.Fragment key={s.id}>
              <div className={`flex items-center gap-2.5 ${active ? 'text-[#003366]' : done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all shadow-sm ${done ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' :
                    active ? 'border-[#003366] bg-[#003366] text-white' :
                      'border-border bg-surface text-text-muted '
                  }`}>
                  {done ? <Check className="h-4 w-4" /> : s.id}
                </div>
                <span className={`text-sm font-bold hidden sm:block transition-opacity ${active ? 'opacity-100' : 'opacity-40'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 rounded-full transition-colors duration-300 ${done ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-surface'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Card */}
      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
        <AnimatePresence mode="wait">

          {/* Step 1 */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }} className="p-6 sm:p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-text-main mb-1">Upload photos (Up to 3)</h2>
                  <span className="text-xs font-bold text-text-muted">{form.images.length}/3 photos</span>
                </div>
                <p className="text-sm text-text-muted">Clear photos help buyers see what they're getting.</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {form.images.map((img, index) => (
                      <motion.div
                        key={img.preview}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="relative aspect-square rounded-2xl overflow-hidden border border-border group"
                      >
                        <img src={img.preview} alt={`Preview ${index + 1}`} className={`w-full h-full object-cover ${img.isUploading ? 'opacity-50 grayscale' : ''}`} />
                        
                        {/* Status Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          {img.isUploading && (
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                              <span className="text-[10px] font-bold text-white bg-black/40 px-2 py-0.5 rounded-full">Uploading...</span>
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

                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        {index === 0 && (
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-primary text-black text-[10px] font-black rounded-md z-10">
                            Main Photo
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {form.images.length < 3 && (
                    <label
                      htmlFor="img-upload"
                      className="aspect-square border-2 border-dashed border-border hover:border-primary dark:hover:border-primary rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group bg-surface/50"
                    >
                      <input id="img-upload" type="file" accept="image/*" multiple className="hidden" onChange={handleImage} />
                      <div className="p-3 bg-surface border border-border group-hover:border-primary/30 rounded-xl transition-all">
                        <Camera className="h-6 w-6 text-text-muted group-hover:text-primary" />
                      </div>
                      <span className="text-xs font-bold text-text-muted group-hover:text-primary">Add Photo</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/40 rounded-xl">
                <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
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
                      <span><strong className="text-text-muted">{title}:</strong> {desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }} className="p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-lg font-black text-text-main mb-1">Course details</h2>
                <p className="text-sm text-text-muted">What are you selling?</p>
              </div>

              <div>
                <Label>Material Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {['PPT', 'Handwritten Notes', 'Book'].map(t => (
                    <button key={t} type="button" onClick={() => { set('materialType', t); if (t !== 'PPT') set('isMultipleSubjects', false); }}
                      className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all ${form.materialType === t ? 'bg-[#003366] text-white border-transparent shadow-sm' : 'bg-surface/80 border-border text-text-muted hover:border-slate-300 dark:hover:border-slate-600'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Semester</Label>
                <select value={form.semester} onChange={e => { set('semester', e.target.value); set('courseCode', ''); set('subjects', []); }} className={inputClass}>
                  <option value="">Select semester...</option>
                  {Object.keys(SUBJECTS_BY_SEM).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {form.materialType === 'PPT' && form.semester && (
                <div className="flex items-center justify-between p-4 bg-surface/50 rounded-xl border border-border">
                  <div>
                    <p className="text-sm font-semibold text-text-main">Multiple subjects?</p>
                    <p className="text-xs text-text-muted mt-0.5">One print covering several courses</p>
                  </div>
                  <button type="button" onClick={() => { set('isMultipleSubjects', !form.isMultipleSubjects); set('subjects', []); set('courseCode', ''); }}
                    className={`w-11 h-6 rounded-full p-1 transition-all ${form.isMultipleSubjects ? 'bg-[#003366]' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    <div className={`w-4 h-4 bg-surface rounded-full shadow transition-transform ${form.isMultipleSubjects ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              )}

              {form.semester && !form.isMultipleSubjects && (
                <div>
                  <Label>Course</Label>
                  <select value={form.courseCode} onChange={e => set('courseCode', e.target.value)} className={inputClass}>
                    <option value="">Select course...</option>
                    {subjects.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {form.semester && form.isMultipleSubjects && (
                <div>
                  <Label>Select subjects ({form.subjects.length} selected)</Label>
                  <div className="rounded-xl border border-border divide-y divide-slate-100 dark:divide-slate-800 max-h-52 overflow-y-auto">
                    {subjects.map(s => (
                      <label key={s} className={`flex items-center gap-3 py-2.5 px-3 cursor-pointer transition-colors ${form.subjects.includes(s) ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                        <input type="checkbox" checked={form.subjects.includes(s)} onChange={() => toggleSubject(s)} className="rounded border-slate-300 text-[#003366] focus:ring-[#003366]" />
                        <span className="text-sm text-text-muted">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label>Listing Title</Label>
                <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g., Complete annotated OS slides" className={inputClass} />
              </div>

              <div>
                <Label>Description <span className="text-[10px] text-text-muted font-normal">(Optional)</span></Label>
                <textarea 
                  value={form.description} 
                  onChange={e => set('description', e.target.value)} 
                  placeholder="What's included? (e.g. Handwritten notes + 5 years of PYQs + colored diagrams)" 
                  className={`${inputClass} min-h-[100px] resize-none py-4`}
                />
              </div>
            </motion.div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }} className="p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-lg font-black text-text-main mb-1">Pricing & pickup</h2>
                <p className="text-sm text-text-muted">Set your price and exchange details.</p>
              </div>

              <div className="p-4 bg-surface/50 rounded-xl border border-border flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-text-main">Mark as Donation?</p>
                  <p className="text-xs text-text-muted mt-0.5">List this item for FREE (₹0)</p>
                </div>
                <button type="button" onClick={() => { 
                  const newDonation = !form.isDonation;
                  set('isDonation', newDonation);
                  if (newDonation) set('price', '0');
                  else if (form.price === '0') set('price', '');
                }}
                  className={`w-11 h-6 rounded-full p-1 transition-all ${form.isDonation ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                  <div className={`w-4 h-4 bg-surface rounded-full shadow transition-transform ${form.isDonation ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              <div className={`grid grid-cols-2 gap-4 transition-all ${form.isDonation ? 'opacity-50 pointer-events-none' : ''}`}>
                <div>
                  <Label>Price (₹)</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-semibold text-sm pointer-events-none">₹</span>
                    <input 
                      type="number" 
                      value={form.price} 
                      onChange={e => set('price', e.target.value)} 
                      placeholder="250" 
                      disabled={form.isDonation}
                      className={`${inputClass} pl-8`} 
                    />
                  </div>
                </div>
                <div>
                  <Label>Quantity</Label>
                  <input type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} className={inputClass} />
                </div>
              </div>

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

              {form.location === 'Other (Manual)' && (
                <div>
                  <Label>Specify Your City / Region <span className="text-red-500 text-[10px] font-bold">(Required)</span></Label>
                  <input 
                    type="text" 
                    value={form.customLocation} 
                    onChange={e => set('customLocation', e.target.value)} 
                    placeholder="e.g. Mumbai, Kolkata, Pilani..." 
                    className={inputClass} 
                  />
                </div>
              )}

              <div>
                <Label>Delivery Method</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[{ value: 'in_person', label: 'In-Person' }, { value: 'courier', label: 'Courier' }, { value: 'both', label: 'Both' }].map(opt => {
                    const isComingSoon = opt.value === 'courier' || opt.value === 'both';
                    return (
                      <button 
                        key={opt.value} 
                        type="button" 
                        onClick={() => !isComingSoon && set('deliveryMethod', opt.value)}
                        disabled={isComingSoon}
                        className={`py-3 rounded-xl text-xs font-bold border transition-all relative overflow-hidden ${
                          form.deliveryMethod === opt.value 
                            ? 'bg-[#003366] text-white border-transparent shadow-sm' 
                            : 'bg-surface/80 border-border text-text-muted hover:border-slate-300 dark:hover:border-slate-600'
                        } ${isComingSoon ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {opt.label}
                        {isComingSoon && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px]">
                            <span className="text-[8px] rotate-12 bg-amber-500 text-black px-1 rounded font-black uppercase">Soon</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.deliveryMethod !== 'courier' && (
                <div>
                  <Label>Preferred Hand-over Spot <span className="text-red-500 text-[10px] font-bold">(Required)</span></Label>
                  <select 
                    value={form.preferredMeetupSpot} 
                    onChange={e => set('preferredMeetupSpot', e.target.value)} 
                    className={inputClass}
                  >
                    {/* Standard universal spots */}
                    {STANDARD_SPOTS.map(spot => (
                      <option key={spot} value={spot}>{spot}</option>
                    ))}
                    <option value="Other">Other (Specify below)</option>
                  </select>
                </div>
              )}

              {form.deliveryMethod !== 'courier' && (
                <div>
                  <Label>Specific Instructions / Custom detailed Location <span className="text-red-500 text-[10px] font-bold">(Required)</span></Label>
                  <input 
                    type="text" 
                    value={form.meetupLocation} 
                    onChange={e => set('meetupLocation', e.target.value)} 
                    placeholder="e.g. hcl 126, cafe 3..." 
                    className={inputClass} 
                  />
                </div>
              )}

              {form.price && (
                <div className="p-4 bg-surface/50 rounded-xl border border-border space-y-2.5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Price Breakdown</p>
                    <span className="bg-emerald-500/10 text-emerald-600 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-emerald-500/20">
                      Launch Promo: 0% Fee
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Listing Price (Total)</span>
                    <span className="font-bold text-text-main">{priceNum === 0 ? 'FREE' : `₹${priceNum}`}</span>
                  </div>
                  <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                    <span className="font-medium">Platform Fee (Online)</span>
                    <span className="font-bold">₹0</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2.5 border-t border-border">
                    <span className="font-bold text-text-main">
                      {priceNum === 0 ? 'Buyer pays' : 'You receive at meetup'}
                    </span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">
                      {priceNum === 0 ? 'FREE' : `₹${priceNum}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed pt-1">
                    {priceNum === 0 ? (
                      <>Buyer pays <strong>₹0 online</strong> to unlock seller details. This is a <strong>donation</strong> - no money will be exchanged.</>
                    ) : (
                      <>Buyer pays <strong>₹0 online</strong> to unlock seller details, then hands you the <strong>full ₹{priceNum} cash</strong> at the meetup. You keep 100% of the sale!</>
                    )}
                  </p>
                </div>
              )}

              {error && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-sm text-red-600 dark:text-red-400 font-medium">
                  {error}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer nav */}
        <div className="px-6 sm:px-8 py-4 bg-surface/60 border-t border-border flex justify-between items-center">
          <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-text-muted hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-0 disabled:pointer-events-none">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          <span className="text-xs font-bold text-text-muted sm:hidden">{step} / {STEPS.length}</span>

          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-[#003366] hover:bg-[#002244] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={isSubmitting || !canProceed()}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#003366] hover:bg-[#002244] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
              <PlusCircle className="h-4 w-4" />
              {isSubmitting ? 'Publishing...' : 'Publish Listing'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};