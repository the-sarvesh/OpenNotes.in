import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Camera, Check, Trash2, AlertCircle, Lock, Save, Info,
} from 'lucide-react';
import { apiRequest } from '../utils/api';
import toast from 'react-hot-toast';
import { Listing } from '../types';
import { LOCATIONS, STANDARD_SPOTS } from '../utils/constants';

// ── Types ──────────────────────────────────────────────────────────────────────
interface EditImageItem {
  preview: string;
  url: string;
  isUploading: boolean;
  error: string | null;
}

interface EditForm {
  title: string;
  description: string;
  price: string;
  quantity: string;
  condition: string;
  location: string;
  customLocation: string;
  preferredMeetupSpot: string;
  meetupLocation: string;
  isDonation: boolean;
  images: EditImageItem[];
}

interface EditListingModalProps {
  listing: Listing;
  hasActiveOrders: boolean;
  onClose: () => void;
  onSuccess: (updated: Listing) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const inputClass =
  'w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-text-main placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all';

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">{children}</p>
);

const LockedField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <Label>{label} <Lock className="inline h-2.5 w-2.5 ml-1 opacity-60" /></Label>
    <div className="flex items-center gap-2 w-full px-4 py-3 bg-background border border-border rounded-xl opacity-50">
      <Lock className="h-3.5 w-3.5 text-text-muted shrink-0" />
      <span className="text-sm text-text-main">{value}</span>
    </div>
    <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
      <AlertCircle className="h-2.5 w-2.5 shrink-0" />
      Locked — a buyer has an active order. Complete it first.
    </p>
  </div>
);

const compressImage = async (file: File): Promise<File> =>
  new Promise((resolve) => {
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
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }) : file),
          'image/jpeg', 0.8,
        );
      };
    };
  });

// ── Main component ─────────────────────────────────────────────────────────────
export const EditListingModal: React.FC<EditListingModalProps> = ({
  listing, hasActiveOrders, onClose, onSuccess,
}) => {
  const listingLocation = listing.location ?? '';
  const isKnownLocation = LOCATIONS.some((l) => l !== 'Other (Manual)' && l === listingLocation);

  const [form, setForm] = useState<EditForm>({
    title:               listing.title ?? '',
    description:         (listing as any).description ?? '',
    price:               hasActiveOrders ? String(listing.price ?? '') : String(listing.price ?? ''),
    quantity:            String(listing.quantity ?? 1),
    condition:           (listing as any).condition ?? 'Good',
    location:            isKnownLocation ? listingLocation : 'Other (Manual)',
    customLocation:      isKnownLocation ? '' : listingLocation,
    preferredMeetupSpot: listing.preferred_meetup_spot ?? STANDARD_SPOTS[0],
    meetupLocation:      listing.meetup_location ?? '',
    isDonation:          listing.price === 0,
    images:              (listing.images ?? [listing.image_url]).filter(Boolean).map((url) => ({
      preview: url,
      url,
      isUploading: false,
      error: null,
    })),
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const set = (key: keyof EditForm, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasChanges]);

  const handleClose = () => {
    if (hasChanges) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
    }
    onClose();
  };

  // ── Image upload ────────────────────────────────────────────────────────────
  const uploadImageFile = async (index: number, file: File) => {
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await apiRequest('/api/listings/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setForm((prev) => {
        const imgs = [...prev.images];
        if (imgs[index]) imgs[index] = { ...imgs[index], url: data.url, isUploading: false };
        return { ...prev, images: imgs };
      });
    } catch (err: any) {
      setForm((prev) => {
        const imgs = [...prev.images];
        if (imgs[index]) imgs[index] = { ...imgs[index], isUploading: false, error: err.message };
        return { ...prev, images: imgs };
      });
      toast.error(`Image upload failed: ${err.message}`);
    }
  };

  const handleImageAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newFiles = files.slice(0, 3 - form.images.length) as File[];
    if (!newFiles.length) { toast.error('Max 3 images allowed.'); return; }

    for (const rawFile of newFiles) {
      const file: File = rawFile;
      const preview = URL.createObjectURL(file as Blob);
      let insertedIdx = -1;
      setForm((prev) => {
        if (prev.images.length >= 3) return prev;
        const entry: EditImageItem = { preview, url: '', isUploading: true, error: null };
        const updated = [...prev.images, entry];
        insertedIdx = updated.length - 1;
        return { ...prev, images: updated };
      });
      // Compress and upload asynchronously
      compressImage(file).then((compressed) => {
        // insertedIdx might be -1 if setForm was skipped; use current length
        setForm((prev) => {
          const idx = insertedIdx >= 0 ? insertedIdx : prev.images.length - 1;
          uploadImageFile(idx, compressed as File);
          return prev; // no change to state yet, upload callback handles it
        });
      });
    }
    setHasChanges(true);
  };

  const removeImage = (index: number) => {
    const imgs = [...form.images];
    if (imgs[index].preview.startsWith('blob:')) URL.revokeObjectURL(imgs[index].preview);
    imgs.splice(index, 1);
    set('images', imgs);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.isDonation && (!form.price || Number(form.price) < 0)) { toast.error('Enter a valid price'); return; }
    if (form.images.some((img) => img.isUploading)) { toast.error('Please wait for images to finish uploading'); return; }
    if (form.images.some((img) => img.error)) { toast.error('Some images failed to upload — remove them and try again'); return; }

    setIsSubmitting(true);
    try {
      const finalLocation = form.location === 'Other (Manual)' ? form.customLocation.trim() : form.location;

      const payload: Record<string, any> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        condition: form.condition,
        location: finalLocation,
        preferred_meetup_spot: form.preferredMeetupSpot,
        meetup_location: form.meetupLocation.trim() || null,
      };

      // Only include price/quantity/images if not locked by active orders
      if (!hasActiveOrders) {
        payload.price = form.isDonation ? 0 : Number(form.price);
        payload.quantity = Number(form.quantity);
        payload.imageUrls = form.images.filter((img) => img.url).map((img) => img.url);
      }

      const res = await apiRequest(`/api/listings/${listing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');

      toast.success('Listing updated!');
      onSuccess(data.listing ?? { ...listing, ...payload });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="bg-surface rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-2xl shadow-2xl border border-border flex flex-col"
        style={{ maxHeight: '95dvh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="w-10 h-1 bg-border rounded-full absolute top-3 left-1/2 -translate-x-1/2 sm:hidden" />
          <div>
            <h2 className="text-base font-black text-text-main">Edit Listing</h2>
            <p className="text-[10px] text-text-muted mt-0.5 truncate max-w-[280px]">{listing.title}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-background text-text-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Active-orders banner */}
        {hasActiveOrders && (
          <div className="mx-5 mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl flex items-start gap-3 shrink-0">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              <strong>Active order in progress.</strong> Price, quantity, and images are locked until the buyer's transaction is completed.
            </p>
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">

          {/* Images */}
          <div>
            <Label>Photos {hasActiveOrders && <Lock className="inline h-2.5 w-2.5 ml-1 opacity-60" />}</Label>
            {hasActiveOrders ? (
              <div className="flex gap-2">
                {form.images.slice(0, 3).map((img, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden opacity-50">
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <AnimatePresence>
                  {form.images.map((img, index) => (
                    <motion.div
                      key={img.preview}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      className="relative aspect-square rounded-xl overflow-hidden border border-border group"
                    >
                      <img src={img.preview} alt="" className={`w-full h-full object-cover ${img.isUploading ? 'opacity-40 grayscale' : ''}`} />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {img.isUploading && (
                          <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        )}
                        {!img.isUploading && img.url && !img.error && (
                          <div className="bg-emerald-500 p-1 rounded-full shadow">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                        {img.error && (
                          <div className="bg-red-500 p-1 rounded-full shadow" title={img.error}>
                            <X className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-1.5 right-1.5 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow z-10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      {index === 0 && (
                        <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-primary text-black text-[9px] font-black rounded-lg z-10">
                          Main
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {form.images.length < 3 && (
                  <label className="aspect-square border-2 border-dashed border-border hover:border-primary rounded-xl cursor-pointer flex flex-col items-center justify-center gap-1.5 group bg-background transition-all">
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageAdd} />
                    <Camera className="h-5 w-5 text-text-muted group-hover:text-primary transition-colors" />
                    <span className="text-[10px] font-bold text-text-muted group-hover:text-primary transition-colors">Add Photo</span>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <Label>Title</Label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Complete OS slides — Sem 5"
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <Label>Description <span className="normal-case text-[9px] font-medium">(optional)</span></Label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What's included? Any PYQs, annotations, condition notes..."
              className={`${inputClass} min-h-[80px] resize-none`}
              rows={3}
            />
          </div>

          {/* Price + Quantity */}
          <div className="grid grid-cols-2 gap-4">
            {hasActiveOrders ? (
              <>
                <LockedField label="Price (₹)" value={form.isDonation ? 'FREE (Donation)' : `₹${form.price}`} />
                <LockedField label="Quantity" value={form.quantity} />
              </>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Price (₹)</Label>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !form.isDonation;
                        set('isDonation', next);
                        if (next) set('price', '0');
                        else if (form.price === '0') set('price', '');
                      }}
                      className={`text-[9px] font-black px-2 py-0.5 rounded-lg border transition-all uppercase tracking-wide ${form.isDonation ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-600' : 'bg-surface border-border text-text-muted hover:border-primary/30'}`}
                    >
                      {form.isDonation ? '✓ Donation (FREE)' : 'Mark as Donation'}
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-semibold text-sm pointer-events-none">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={form.price}
                      onChange={(e) => set('price', e.target.value)}
                      disabled={form.isDonation}
                      className={`${inputClass} pl-8 ${form.isDonation ? 'opacity-40' : ''}`}
                      placeholder="250"
                    />
                  </div>
                </div>
                <div>
                  <Label>Quantity</Label>
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) => set('quantity', e.target.value)}
                    className={inputClass}
                  />
                  {listing.status === 'archived' && Number(form.quantity) > 0 && (
                    <p className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1">
                      <Check className="h-2.5 w-2.5 shrink-0" />
                      Saving will re-activate this listing.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Condition */}
          <div>
            <Label>Condition</Label>
            <select value={form.condition} onChange={(e) => set('condition', e.target.value)} className={inputClass}>
              {['Like New', 'Good', 'Fair', 'Heavily Annotated'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <Label>City / Region</Label>
            <select
              value={form.location}
              onChange={(e) => { set('location', e.target.value); set('preferredMeetupSpot', STANDARD_SPOTS[0]); }}
              className={inputClass}
            >
              {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>

          {form.location === 'Other (Manual)' && (
            <div>
              <Label>Specify City / Region <span className="text-red-500 text-[9px] font-bold">(Required)</span></Label>
              <input
                type="text"
                value={form.customLocation}
                onChange={(e) => set('customLocation', e.target.value)}
                placeholder="e.g. Mumbai, Pilani..."
                className={inputClass}
              />
            </div>
          )}

          {/* Meetup spot */}
          <div>
            <Label>Preferred Hand-over Spot</Label>
            <select value={form.preferredMeetupSpot} onChange={(e) => set('preferredMeetupSpot', e.target.value)} className={inputClass}>
              {STANDARD_SPOTS.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="Other">Other (Specify below)</option>
            </select>
          </div>

          {/* Meetup instructions */}
          <div>
            <Label>Exchange Instructions / Location Details</Label>
            <input
              type="text"
              value={form.meetupLocation}
              onChange={(e) => set('meetupLocation', e.target.value)}
              placeholder="e.g. Library ground floor, Mon–Fri evenings"
              className={inputClass}
            />
          </div>

          {/* Non-editable notice */}
          <div className="p-3.5 bg-background border border-border rounded-xl flex items-start gap-2.5">
            <Info className="h-3.5 w-3.5 text-text-muted shrink-0 mt-0.5" />
            <p className="text-[10px] text-text-muted leading-relaxed">
              <strong className="text-text-main">Semester, course, and material type</strong> cannot be changed after publishing. If you need to correct these, delete this listing and create a new one.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-border flex gap-3 shrink-0">
          <button
            onClick={handleClose}
            className="flex-1 py-3.5 bg-background hover:bg-surface border border-border text-text-main rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !form.title.trim()}
            className="flex-[2] py-3.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-black rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm shadow-primary/20"
          >
            {isSubmitting
              ? <><span className="h-3.5 w-3.5 rounded-full border-2 border-black/40 border-t-black animate-spin" /> Saving…</>
              : <><Save className="h-3.5 w-3.5" /> Save Changes</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
