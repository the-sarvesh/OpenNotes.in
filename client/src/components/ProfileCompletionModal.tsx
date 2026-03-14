import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Phone, CreditCard, User, Camera, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.js";
import { apiRequest } from "../utils/api.js";

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileCompletionModal: React.FC<ProfileCompletionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, refreshUser } = useAuth();
  const [mobileNumber, setMobileNumber] = useState("");
  const [upiId, setUpiId] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setMobileNumber(user.mobile_number || "");
      setUpiId(user.upi_id || "");
      setAvatarPreview(user.profile_image_url || null);
    }
  }, [user, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!mobileNumber.trim()) {
      setError("Mobile number is required");
      return;
    }
    
    if (!upiId.trim()) {
      setError("UPI ID is required");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("mobile_number", mobileNumber);
      formData.append("upi_id", upiId);
      if (avatar) {
        formData.append("profile_image", avatar);
      }

      const res = await apiRequest("/api/users/me", {
        method: "PUT",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update profile");
      }

      await refreshUser();
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/20 dark:border-slate-700/50"
      >
        <div className="p-6 border-b border-border flex justify-between items-center bg-background/50">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-text-main">Complete Your Profile</h2>
          </div>
          {!isSuccess && (
            <button
              onClick={onClose}
              className="p-2 text-text-muted hover:text-primary rounded-full hover:bg-primary-hover transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="p-6">
          {isSuccess ? (
            <div className="py-8 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-main mb-1">Profile Updated!</h3>
                <p className="text-sm text-text-muted">Thank you for completing your profile.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <p className="text-sm text-text-muted leading-relaxed">
                Please provide your contact and payment details to continue. This helps other users contact you for trades.
              </p>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-200 dark:border-red-900/50 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-primary/20 group-hover:border-primary transition-colors">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-muted">
                        <User className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 p-2 bg-primary text-black rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform">
                    <Camera className="h-4 w-4" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>
                <span className="text-xs text-text-muted font-medium">Profile Image (Optional)</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1.5">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted pointer-events-none" />
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all text-text-main"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1.5">
                    UPI ID <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted pointer-events-none" />
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. name@upi"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all text-text-main"
                    />
                  </div>
                  <p className="text-[10px] text-text-muted mt-1 ml-1">
                    Used for payments when someone buys your notes.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-black rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save and Continue"
                )}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
