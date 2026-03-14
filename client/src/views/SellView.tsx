import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Camera, MapPin, ChevronRight, ChevronLeft, Check, PlusCircle, Upload, Info, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../utils/api';

const SUBJECTS_BY_SEM: Record<string, string[]> = {
  'Sem1': ['BSDCH ZC111: Probability & Statistics', 'BSDCH ZC112: Electrical Science', 'BSDCH ZC151: Writing Practice', 'BSDCH ZC236: Symbolic Logic'],
  'Sem2': ['BSDCH ZC142: Computer Programming', 'BSDCH ZC222: Discrete Structures for Computer Science', 'BSDCH ZC225: Environmental Studies', 'BSDCH ZC231: Dynamics of Social Change'],
  'Sem3': ['BSDCH ZC215: Digital Design', 'BSDCH ZC226: Creative Thinking', 'BSDCH ZC234: Linear Algebra & Optimization', 'BSDCH ZC356: Data Structures'],
  'Sem4': ['BSDCH ZC242: Cultural Studies', 'BSDCH ZC312: Evolution of Design', 'BSDCH ZC313: Object Oriented Programming & Design', 'BSDCH ZC353: Computer Organization & Architecture'],
  'Sem5': ['BSDCH ZC317: Algorithm Design', 'BSDCH ZC322: Critical Analysis of Literature & Cinema', 'BSDCH ZC328: Humanities and Design', 'BSDCH ZC364: Operating Systems (Elective)'],
  'Sem6': ['BSDCH ZC316: Computing and Design', 'BSDCH ZC355: Statistical Inferences & Applications', 'BSDCH ZC412: Software Design Principles', 'BSDCH ZC413: Database Design (Elective)'],
  'Sem7': ['BSDCH ZC311: Information Security', 'BSDCH ZC365: Human Computer Interaction', 'BSDCH ZC481: Computer Networks (Elective)'],
  'Sem8': ['BSDCH ZC499T: Capstone Project'],
};
const STANDARD_SPOTS = ['HCL Office', 'BITS Exam Center'];

const LOCATIONS = ['Noida / Delhi NCR', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune', 'Other (Manual)'];

interface FormData {
  imageFile: File | null;
  imagePreview: string;
  materialType: string;
  semester: string;
  courseCode: string;
  isMultipleSubjects: boolean;
  subjects: string[];
  title: string;
  price: string;
  quantity: string;
  condition: string;
  location: string;
  customLocation: string; // New field for manual city entry
  deliveryMethod: string;
  preferredMeetupSpot: string;
  meetupLocation: string;
}

const INITIAL_FORM: FormData = {
  imageFile: null,
  imagePreview: '',
  materialType: 'PPT',
  semester: '',
  courseCode: '',
  isMultipleSubjects: false,
  subjects: [],
  title: '',
  price: '',
  quantity: '1',
  condition: 'Good',
  location: 'Noida / Delhi NCR',
  customLocation: '',
  deliveryMethod: 'in_person',
  preferredMeetupSpot: STANDARD_SPOTS[0],
  meetupLocation: '',
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

export const SellView: React.FC<{ onGoToBrowse?: () => void }> = ({ onGoToBrowse }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormData>(INITIAL_FORM);

  const set = (key: keyof FormData, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    set('imageFile', file);
    set('imagePreview', URL.createObjectURL(file));
  };

  const toggleSubject = (s: string) =>
    set('subjects', form.subjects.includes(s)
      ? form.subjects.filter(x => x !== s)
      : [...form.subjects, s]);

  const canProceed = () => {
    if (step === 1) return !!form.imageFile;
    if (step === 2) {
      if (!form.semester || !form.title) return false;
      if (form.isMultipleSubjects) return form.subjects.length > 0;
      return !!form.courseCode;
    }
    if (step === 3) {
      if (!form.price) return false;
      if (form.location === 'Other (Manual)' && !form.customLocation.trim()) return false;
      if (form.deliveryMethod !== 'courier') {
        if (!form.preferredMeetupSpot) return false;
        if (!form.meetupLocation.trim()) return false;
      }
      return true;
    }
    return false;
  };


  const handleSubmit = async () => {
    if (!user) { setError('Please sign in to sell notes.'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      const finalLocation = form.location === 'Other (Manual)' ? form.customLocation : form.location;
      
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('course_code', form.isMultipleSubjects ? 'Multiple' : form.courseCode);
      fd.append('semester', form.semester);
      fd.append('condition', form.condition);
      fd.append('price', form.price);
      fd.append('location', finalLocation);
      fd.append('quantity', form.quantity);
      
      // Map material type labels to backend-expected keys
      const typeMap: Record<string, string> = {
        'Handwritten Notes': 'handwritten',
        'PPT': 'printed',
        'Book': 'printed'
      };
      fd.append('material_type', typeMap[form.materialType] || 'other');
      
      fd.append('is_multiple_subjects', String(form.is_multiple_subjects));
      fd.append('image', form.imageFile!);
      fd.append('delivery_method', form.deliveryMethod);
      if (form.deliveryMethod !== 'courier') {
        fd.append('preferred_meetup_spot', form.preferredMeetupSpot);
        fd.append('meetup_location', form.meetupLocation);
      }
      if (form.isMultipleSubjects) fd.append('subjects', JSON.stringify(form.subjects));

      const res = await apiRequest('/api/listings', {
        method: 'POST',
        body: fd,
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
      <div className="mb-8 p-5 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 rounded-2xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-[#003366] rounded-lg">
            <Shield className="h-3.5 w-3.5 text-white" />
          </div>
          <p className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider">Selling safely</p>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          List your notes for free. You keep <strong>90% of the listing price</strong> which the buyer pays you in <strong>cash</strong> during the hand-over. We charge a small 10% platform fee to coordinate the exchange, which the buyer pays online.
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
              <div>
                <h2 className="text-lg font-black text-text-main mb-1">Upload a photo</h2>
                <p className="text-sm text-text-muted">A clear photo helps buyers see what they're getting.</p>
              </div>

              <label htmlFor="img-upload" className={`block border-2 border-dashed rounded-2xl transition-all cursor-pointer overflow-hidden group ${form.imagePreview ? 'border-border' : 'border-border hover:border-primary dark:hover:border-primary'}`}>
                <input id="img-upload" type="file" accept="image/*" className="hidden" onChange={handleImage} />
                {form.imagePreview ? (
                  <div className="relative">
                    <img src={form.imagePreview} alt="Preview" className="w-full h-64 object-cover" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Upload className="h-6 w-6 text-white" />
                      <span className="text-white font-bold text-sm">Change photo</span>
                    </div>
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-accent text-black text-xs font-bold px-2.5 py-1 rounded-full">
                      <Check className="h-3 w-3" /> Photo added
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                    <div className="w-16 h-16 bg-surface hover:bg-surface border border-transparent hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl flex items-center justify-center mb-4 transition-all">
                      <Camera className="h-8 w-8 text-text-muted transition-colors group-hover:text-[#003366]" />
                    </div>
                    <p className="font-bold text-text-muted mb-1 transition-colors group-hover:text-[#003366]">Click to upload photo</p>
                    <p className="text-xs text-text-muted">PNG, JPG up to 5MB</p>
                  </div>
                )}
              </label>

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
            </motion.div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }} className="p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-lg font-black text-text-main mb-1">Pricing & pickup</h2>
                <p className="text-sm text-text-muted">Set your price and exchange details.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Price (₹)</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-semibold text-sm pointer-events-none">₹</span>
                    <input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="250" className={`${inputClass} pl-8`} />
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
                  {[{ value: 'in_person', label: 'In-Person' }, { value: 'courier', label: 'Courier' }, { value: 'both', label: 'Both' }].map(opt => (
                    <button key={opt.value} type="button" onClick={() => set('deliveryMethod', opt.value)}
                      className={`py-3 rounded-xl text-xs font-bold border transition-all ${form.deliveryMethod === opt.value ? 'bg-[#003366] text-white border-transparent shadow-sm' : 'bg-surface/80 border-border text-text-muted hover:border-slate-300 dark:hover:border-slate-600'}`}>
                      {opt.label}
                    </button>
                  ))}
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

              {form.price && priceNum > 0 && (
                <div className="p-4 bg-surface/50 rounded-xl border border-border space-y-2.5">
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-3">Price Breakdown</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Listing Price (Total)</span>
                    <span className="font-bold text-text-main">₹{priceNum}</span>
                  </div>
                  <div className="flex justify-between text-sm text-blue-700 dark:text-blue-400">
                    <span className="font-medium">Platform Fee (10% - Paid Online)</span>
                    <span className="font-bold">-₹{Math.round(priceNum * 0.1)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2.5 border-t border-border">
                    <span className="font-bold text-text-main">You receive at meetup</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">₹{priceNum - Math.round(priceNum * 0.1)}</span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed pt-1">
                    Buyer pays ₹{Math.round(priceNum * 0.1)} platform fee online to unlock seller details, then hands you ₹{priceNum - Math.round(priceNum * 0.1)} cash at meetup.
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