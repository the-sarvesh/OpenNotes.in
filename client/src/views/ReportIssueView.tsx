import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, ImagePlus, Mail, Send, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../utils/api';

const CATEGORIES = [
  { value: 'otp_verification', label: 'OTP or email verification' },
  { value: 'login_registration', label: 'Login or registration' },
  { value: 'listing_upload', label: 'Listing or file upload' },
  { value: 'order_checkout', label: 'Cart, checkout, or order' },
  { value: 'messages_notifications', label: 'Messages or notifications' },
  { value: 'study_resources', label: 'Free study resources' },
  { value: 'other', label: 'Something else' },
] as const;

const inputClass = 'w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-main placeholder:text-text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

export const ReportIssueView: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedCategory = searchParams.get('category');
  const initialCategory = CATEGORIES.some((item) => item.value === requestedCategory)
    ? requestedCategory!
    : 'other';

  const [email, setEmail] = useState(user?.email || '');
  const [category, setCategory] = useState(initialCategory);
  const [subject, setSubject] = useState(
    initialCategory === 'otp_verification' ? 'Verification OTP not received' : '',
  );
  const [description, setDescription] = useState('');
  const [pageUrl, setPageUrl] = useState(searchParams.get('from') || '');
  const [website, setWebsite] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState('');

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  useEffect(() => () => {
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
  }, [screenshotPreview]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('email', email);
      formData.append('category', category);
      formData.append('subject', subject);
      formData.append('description', description);
      formData.append('page_url', pageUrl);
      formData.append('website', website);
      formData.append('technical_context', JSON.stringify({
        screen: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        online: navigator.onLine,
        language: navigator.language,
        capturedAt: new Date().toISOString(),
      }));
      if (screenshot) formData.append('screenshot', screenshot);
      const response = await apiRequest('/api/issues', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not submit your report.');
      setReference(data.reference || 'RECEIVED');
    } catch (error: any) {
      toast.error(error.message || 'Could not submit your report.');
    } finally {
      setSubmitting(false);
    }
  };

  if (reference) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-black text-text-main">Issue reported</h1>
        <p className="text-sm text-text-muted mt-2 leading-relaxed">
          The OpenNotes admin has been notified. Keep this reference if you need to follow up:
        </p>
        <p className="inline-block mt-4 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary font-black tracking-widest">
          {reference}
        </p>
        <div className="mt-8">
          <Link to="/" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary text-black text-sm font-black hover:bg-primary-hover transition-colors">
            Back to OpenNotes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 pb-24">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="rounded-3xl border border-border bg-surface shadow-xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary to-amber-400" />
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4 mb-7">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-text-main">Report an issue</h1>
              <p className="text-sm text-text-muted mt-1 leading-relaxed">
                Tell us what went wrong. You can use this page even if you cannot sign in or receive an OTP.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-text-muted mb-2">Issue category</label>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass} required>
                {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-text-muted mb-2">Contact email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={`${inputClass} pl-10`} placeholder="you@example.com" maxLength={254} required />
              </div>
              <p className="text-[11px] text-text-muted mt-1.5">We will use this only to follow up about this report.</p>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-text-muted mb-2">Short subject</label>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} className={inputClass} placeholder="What is not working?" minLength={5} maxLength={120} required />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-text-muted mb-2">What happened?</label>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} min-h-36 resize-y`} placeholder="Describe what you tried, what you expected, and any error message you saw." minLength={10} maxLength={2000} required />
              <p className="text-[11px] text-text-muted text-right mt-1">{description.length}/2000</p>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-text-muted mb-2">Page where it happened <span className="normal-case font-medium tracking-normal">(optional)</span></label>
              <input value={pageUrl} onChange={(event) => setPageUrl(event.target.value)} className={inputClass} placeholder="For example: Login, Sell, Checkout" maxLength={500} />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-text-muted mb-2">Screenshot <span className="normal-case font-medium tracking-normal">(optional)</span></label>
              {screenshotPreview ? (
                <div className="relative overflow-hidden rounded-2xl border border-border bg-background">
                  <img src={screenshotPreview} alt="Issue screenshot preview" className="w-full max-h-72 object-contain" />
                  <button
                    type="button"
                    aria-label="Remove screenshot"
                    onClick={() => {
                      URL.revokeObjectURL(screenshotPreview);
                      setScreenshot(null);
                      setScreenshotPreview('');
                    }}
                    className="absolute right-2 top-2 p-2 rounded-full bg-black/70 text-white hover:bg-black"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background px-4 py-6 text-sm font-bold text-text-muted cursor-pointer hover:border-primary/50 hover:text-primary transition-colors">
                  <ImagePlus className="h-5 w-5" /> Attach PNG, JPG, or WebP (max 8 MB)
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (file.size > 8 * 1024 * 1024) {
                        toast.error('Screenshot must be smaller than 8 MB.');
                        event.target.value = '';
                        return;
                      }
                      setScreenshot(file);
                      setScreenshotPreview(URL.createObjectURL(file));
                    }}
                  />
                </label>
              )}
              <p className="text-[11px] text-text-muted mt-1.5">Please hide passwords, OTPs, payment details, and other private information.</p>
            </div>

            <div className="hidden" aria-hidden="true">
              <label>Website<input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
            </div>

            <button type="submit" disabled={submitting} className="w-full py-3.5 rounded-2xl bg-primary hover:bg-primary-hover text-black font-black text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting ? <span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? 'Sending report…' : 'Send issue report'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
