import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, DollarSign, MessageCircle, PackageOpen, X } from 'lucide-react';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: number;
  link?: string;
  created_at: string;
}

export const NotifRow: React.FC<{ n: Notification; onClick: (n: Notification) => void }> = ({ n, onClick }) => (
  <button
    onClick={() => onClick(n)}
    className={`w-full text-left px-5 py-4 transition-colors active:bg-white/10 ${!n.is_read ? 'bg-[#FFC000]/[0.06]' : 'hover:bg-white/[0.04]'
      }`}
  >
    <div className="flex items-start gap-4">
      <div className={`shrink-0 p-2.5 rounded-xl mt-0.5 ${!n.is_read ? 'bg-[#FFC000]/20 text-[#FFC000]' : 'bg-white/[0.07] text-slate-500'
        }`}>
        {n.type === 'sold'
          ? <DollarSign className="h-4 w-4" />
          : n.type === 'message'
            ? <MessageCircle className="h-4 w-4" />
            : <PackageOpen className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <p className={`text-sm font-bold leading-snug truncate ${!n.is_read ? 'text-white' : 'text-slate-300'}`}>
            {n.title}
          </p>
          {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#FFC000] shrink-0 mt-1.5" />}
        </div>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-1.5">{n.message}</p>
        <p className="text-[10px] text-slate-600 font-medium">
          {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  </button>
);

export const NotifEmpty = () => (
  <div className="py-16 flex flex-col items-center gap-4 px-8 text-center">
    <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center">
      <Bell className="h-8 w-8 text-slate-600" />
    </div>
    <div>
      <p className="font-bold text-slate-300 text-sm">You're all caught up</p>
      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
        Notifications for orders, messages and sales appear here.
      </p>
    </div>
  </div>
);

export const NotifLoading = () => (
  <div className="py-16 flex flex-col items-center gap-3">
    <span className="h-6 w-6 border-2 border-[#FFC000] border-t-transparent rounded-full animate-spin" />
    <p className="text-xs text-slate-500 font-medium">Loading…</p>
  </div>
);

interface NotificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  loading: boolean;
  onMarkAllRead: () => void;
  onNotificationClick: (n: Notification) => void;
}

export const NotificationSheet: React.FC<NotificationSheetProps> = ({
  isOpen, onClose, notifications, loading, onMarkAllRead, onNotificationClick
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
            className="absolute inset-0 bg-black/75 backdrop-blur-[6px]"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ 
              type: 'tween', 
              duration: 0.45, 
              ease: [0.32, 0.72, 0, 1] 
            }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.12}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 600) onClose();
            }}
            className="absolute inset-x-0 bottom-0 bg-slate-900 rounded-t-[2.5rem] border-t border-white/10 shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.7)] flex flex-col pointer-events-auto overflow-hidden will-change-transform"
            style={{ height: '78vh', maxHeight: '90dvh' }}
          >
            <div className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-6 pb-4 pt-1 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#FFC000]/15 rounded-xl">
                  <Bell className="h-5 w-5 text-[#FFC000]" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">Notifications</h3>
                  {notifications.filter(n => !n.is_read).length > 0 && (
                    <p className="text-[10px] font-bold text-[#FFC000] uppercase tracking-wider">
                      {notifications.filter(n => !n.is_read).length} new messages
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-400 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain bg-slate-900/50">
              <div className="divide-y divide-white/[0.06] pb-10">
                {loading
                  ? <NotifLoading />
                  : notifications.length === 0
                    ? <NotifEmpty />
                    : notifications.map(n => <NotifRow key={n.id} n={n} onClick={onNotificationClick} />)
                }
                <div style={{ height: 'env(safe-area-inset-bottom, 24px)' }} />
              </div>
            </div>

            {notifications.some(n => !n.is_read) && (
              <div className="p-4 bg-slate-900 border-t border-white/10 shrink-0">
                <button
                  onClick={onMarkAllRead}
                  className="w-full py-3.5 bg-[#FFC000] hover:bg-[#e6ac00] text-slate-900 rounded-2xl font-black text-xs uppercase tracking-[0.15em] shadow-lg shadow-[#FFC000]/20 transition-all active:scale-[0.98]"
                >
                  Mark all read
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
