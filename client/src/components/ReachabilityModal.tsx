import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { X, Phone, Send, Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { apiRequest } from "../utils/api";
import { toast } from "react-hot-toast";

interface ReachabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  purpose: "buy" | "sell";
}

export const ReachabilityModal: React.FC<ReachabilityModalProps> = ({
  isOpen,
  onClose,
  purpose,
}) => {
  const { user, refreshUser } = useAuth();
  const [mobileNumber, setMobileNumber] = useState("");
  const [isSavingMobile, setIsSavingMobile] = useState(false);
  const [isConnectingTelegram, setIsConnectingTelegram] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (user?.mobile_number) {
      setMobileNumber(user.mobile_number);
    }
  }, [user, isOpen]);

  // Status Polling for Telegram Bot link
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    if (isPolling && isOpen) {
      pollInterval = setInterval(async () => {
        try {
          const res = await apiRequest("/api/telegram/status");
          if (res.ok) {
            const data = await res.json();
            if (data.isLinked) {
              setIsPolling(false);
              toast.success("Telegram connected successfully!");
              await refreshUser();
              onClose();
            }
          }
        } catch (err) {
          console.error("Error polling Telegram status:", err);
        }
      }, 3000);
    }
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isPolling, isOpen, refreshUser, onClose]);

  if (!isOpen || !user) return null;

  const handleSaveMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileNumber.trim()) {
      toast.error("Please enter a valid mobile number");
      return;
    }
    setIsSavingMobile(true);
    try {
      const res = await apiRequest("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile_number: mobileNumber }),
      });
      if (res.ok) {
        toast.success("Mobile number saved!");
        await refreshUser();
        onClose();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save mobile number");
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSavingMobile(false);
    }
  };

  const handleConnectTelegram = async () => {
    setIsConnectingTelegram(true);
    try {
      const res = await apiRequest("/api/telegram/generate-token");
      const data = await res.json();
      if (res.ok && data.link) {
        window.open(data.link, "_blank", "noopener,noreferrer");
        toast.success("Opening Telegram... Click /start in the bot.");
        setIsPolling(true);
      } else {
        toast.error(data.error || "Failed to generate token");
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setIsConnectingTelegram(false);
    }
  };

  const textMessage = purpose === "buy"
    ? "Please complete your profile with a valid mobile number or link your Telegram before completing this purchase so the seller can coordinate the meetup."
    : "Please complete your profile with a valid mobile number or link your Telegram before listing this note so the buyer can coordinate the meetup.";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-950/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h2 className="text-base font-black text-white uppercase tracking-wider">Contact Details Needed</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-xs text-slate-300 leading-relaxed font-semibold">
            {textMessage}
          </p>

          {/* Option 1: Mobile Number */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#FFC000]">Option 1: Add Mobile Number</h3>
            <form onSubmit={handleSaveMobile} className="flex gap-2">
              <div className="relative flex-1">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="tel"
                  placeholder="Enter your mobile number"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FFC000]/40 transition-all font-semibold"
                />
              </div>
              <button
                type="submit"
                disabled={isSavingMobile || isPolling}
                className="px-4 py-2.5 bg-[#FFC000] hover:bg-[#e6ac00] text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0 active:scale-95 shadow-lg shadow-[#FFC000]/10"
              >
                {isSavingMobile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
              </button>
            </form>
          </div>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">OR</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Option 2: Telegram Bot Link */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#FFC000]">Option 2: Link Telegram Bot</h3>
            {isPolling ? (
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center justify-center flex-col gap-2 text-center">
                <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest animate-pulse">Waiting for Bot /start...</p>
                <p className="text-[10px] text-slate-400 font-medium max-w-[250px]">
                  Click start in the Telegram tab we just opened. Once done, this modal will auto-close.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectTelegram}
                disabled={isConnectingTelegram}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 shadow-lg shadow-blue-500/10"
              >
                {isConnectingTelegram ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Connect Telegram Bot
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
