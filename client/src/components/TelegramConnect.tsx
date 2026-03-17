import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, CheckCircle2, ShieldAlert, Info, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiRequest } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

export const TelegramConnect: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState({ isLinked: false, loading: true });
  const [generating, setGenerating] = useState(false);

  const checkStatus = async () => {
    try {
      const res = await apiRequest('/api/telegram/status');
      const data = await res.json();
      setStatus({ isLinked: data.isLinked, loading: false });
    } catch (err) {
      console.error('Failed to check Telegram status:', err);
      setStatus(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    if (user) checkStatus();
  }, [user]);

  const handleConnect = async () => {
    setGenerating(true);
    try {
      const res = await apiRequest('/api/telegram/generate-token');
      const data = await res.json();
      if (res.ok && data.link) {
        window.location.href = data.link;
        toast.success('Redirecting to Telegram...');
      } else {
        toast.error(data.error || 'Failed to generate linking token');
      }
    } catch (err) {
      console.error('Telegram connection error:', err);
      toast.error('Network error. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Telegram notifications?')) return;
    
    try {
      const res = await apiRequest('/api/telegram/unlink', { method: 'POST' });
      if (res.ok) {
        toast.success('Telegram disconnected');
        checkStatus();
      } else {
        toast.error('Failed to disconnect');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  if (!user) return null;

  return (
    <div className="bg-surface border border-border rounded-[2rem] p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-blue-500/10 rounded-2xl text-blue-600">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-black text-text-main uppercase tracking-widest">Telegram Notifications</h3>
          <p className="text-[10px] font-bold text-text-muted uppercase mt-0.5">Real-time alerts on your phone</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-background border border-border rounded-2xl">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${status.isLinked ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-400'}`}>
            {status.loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : status.isLinked ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <ShieldAlert className="h-6 w-6" />
            )}
          </div>
          <div>
            <p className="text-sm font-black text-text-main uppercase">
              {status.loading ? 'Checking status...' : status.isLinked ? 'Telegram Connected' : 'Telegram Not Linked'}
            </p>
            <p className="text-[10px] text-text-muted font-medium">
              {status.isLinked 
                ? 'You are receiving notifications via our Telegram bot.' 
                : 'Receive instant updates about orders, messages, and meetups.'}
            </p>
          </div>
        </div>
        
        {!status.loading && (
          status.isLinked ? (
            <button
              onClick={handleDisconnect}
              className="w-full sm:w-auto px-6 py-2.5 bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white border border-red-600/20 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={generating}
              className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary-hover text-black rounded-xl font-black text-[10px] uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
              Connect Bot
            </button>
          )
        )}
      </div>
      
      {!status.isLinked && !status.loading && (
        <p className="text-[9px] text-text-muted mt-4 font-medium px-1 flex items-start gap-1.5 leading-relaxed">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          Connecting will open our Telegram bot. Click <b>/start</b> in the bot to complete the link. No personal data except your Chat ID will be stored.
        </p>
      )}
    </div>
  );
};
