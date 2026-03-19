import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, PlusCircle, ShoppingBag, Sun, Moon,
  ShoppingCart, MessageCircle, Menu, User as UserIcon, Bell,
  ChevronDown, LogOut, X, HelpCircle, FileText, Send, Settings
} from 'lucide-react';
import { useNavigate, NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { View } from '../types';
import { apiRequest } from '../utils/api';
import { 
  Notification, 
  NotifRow, 
  NotifEmpty, 
  NotifLoading, 
  NotificationSheet 
} from './NotificationSystem';

interface NavbarProps {
  isDark: boolean;
  toggleDark: () => void;
  cartCount: number;
  setShowAuth: (v: boolean) => void;
  unreadMessageCount?: number;
  unreadNotificationCount?: number;
  onShowGuide?: () => void;
  onMessagesClick?: () => void;
  onTelegramClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isDark, toggleDark,
  cartCount, setShowAuth,
  unreadMessageCount = 0, unreadNotificationCount = 0,
  onShowGuide, onMessagesClick, onTelegramClick,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);   // desktop dropdown
  const [showMobileSheet, setShowMobileSheet] = useState(false);        // mobile bottom sheet

  // Background scroll lock
  useEffect(() => {
    const isLocked = showMobileSheet || isMenuOpen;
    if (isLocked) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => { 
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [showMobileSheet, isMenuOpen]);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState(true); // Default to true to avoid flicker

  useEffect(() => {
    if (user) {
      apiRequest('/api/telegram/status')
        .then(res => res.json())
        .then(data => setTelegramLinked(data.isLinked))
        .catch(() => { });
    }
  }, [user]);

  const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;

  // Desktop only: close dropdown on outside click
  const notifRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (isMobile()) return;
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setIsMenuOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoadingNotifs(true);
    try {
      const res = await apiRequest('/api/notifications');
      if (res.ok) setNotifications(await res.json());
    } finally {
      setLoadingNotifs(false);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await apiRequest('/api/notifications/mark-read', { method: 'PUT' });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  const handleNotificationClick = async (notif: Notification) => {
    // 1. Immediately start closing overlays to feel responsive
    setShowNotifications(false);
    setShowMobileSheet(false);
    setIsMenuOpen(false);

    // 2. Mark as read in the background
    if (!notif.is_read && user) {
      apiRequest(`/api/notifications/${notif.id}/mark-read`, {
        method: 'PUT'
      }).catch(() => { });
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
    }

    const link = notif.link;
    if (!link) return;

    // 3. Delay the navigation slightly to allow exit animations to run smoothly.
    setTimeout(() => {
      const type = notif.type.toLowerCase();
      
      // Explicit Mapping by Notification Type
      if (type === 'sold' || type === 'payout' || type === 'sale') {
        navigate('/profile?tab=earnings');
        return;
      }
      
      if (type === 'message' || type === 'chat') {
        navigate('/messages');
        return;
      }
      
      if (type === 'purchase' || type === 'order' || type === 'buy') {
        navigate('/orders');
        return;
      }
      
      if (type === 'listing' || type === 'approved' || type === 'rejected') {
        navigate('/profile?tab=listings');
        return;
      }

      // Fallback: Path-based detection if type doesn't match
      if (link.startsWith('/messages')) navigate('/messages');
      else if (link.startsWith('/profile') || link.startsWith('/dashboard')) navigate('/profile');
      else if (link.startsWith('/orders')) navigate('/orders');
      else if (link.startsWith('/sell')) navigate('/sell');
      else if (link.startsWith('/browse')) navigate('/browse');
      else navigate('/');
    }, 180);
  };

  const toggleNotifications = () => {
    if (isMobile()) {
      const next = !showMobileSheet;
      setShowMobileSheet(next);
      setShowNotifications(false);
      if (next) {
        fetchNotifications();
        setIsMenuOpen(false);
      }
    } else {
      const next = !showNotifications;
      setShowNotifications(next);
      setShowMobileSheet(false);
      if (next) fetchNotifications();
    }
  };

  const navLink = (to: string, label: string, needsAuth = false) => {
    const isActive = location.pathname === to;
    return (
      <button
        onClick={() => {
          if (needsAuth && !user) {
            setShowAuth(true);
          } else {
            navigate(to);
          }
        }}
        className={`relative text-sm font-semibold tracking-tight transition-colors duration-150 py-1 ${
          isActive ? 'text-[#FFC000]' : 'text-slate-400 hover:text-white'
        }`}
      >
        {label}
        {isActive && (
          <motion.span
            layoutId="nav-indicator"
            className="absolute -bottom-[1px] left-0 right-0 h-0.5 bg-[#FFC000] rounded-full"
          />
        )}
      </button>
    );
  };

  const iconBtn = (onClick: () => void, children: React.ReactNode, badge?: number, title?: string) => (
    <button
      onClick={onClick}
      title={title}
      className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-150"
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full px-0.5 border-2 border-slate-900 overflow-hidden">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );

  return (
    <>
      <nav className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-xl border-b border-white/[0.08] shadow-xl shadow-black/20 transition-colors">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FFC000]/30 to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center gap-4 py-3">

            {/* Logo */}
            <button
              onClick={() => {
                if (location.pathname === '/') {
                  window.location.reload();
                } else {
                  navigate('/');
                }
              }}
              className="flex items-center gap-2 group shrink-0"
            >
              <img 
                src="/logo192.png" 
                alt="OpenNotes Logo" 
                className="h-9 w-9 rounded-xl shadow-lg shadow-[#FFC000]/10 group-hover:scale-110 transition-transform duration-300" 
              />
              <span className="font-black text-lg tracking-tight text-white">
                Open<span className="text-[#FFC000]">Notes</span>.in
              </span>
            </button>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-7 border-b border-transparent">
              {navLink('/browse', 'Browse Notes', true)}
              {navLink('/resources', 'Study Material', true)}
              <button
                onClick={() => {
                  if (!user) {
                    setShowAuth(true);
                  } else {
                    navigate('/sell');
                  }
                }}
                className={`relative text-sm font-semibold tracking-tight transition-colors duration-150 py-1 ${
                  location.pathname === '/sell' ? 'text-[#FFC000]' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sell Notes
                {location.pathname === '/sell' && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute -bottom-[1px] left-0 right-0 h-0.5 bg-[#FFC000] rounded-full"
                  />
                )}
              </button>
              {user && navLink('/profile', 'Dashboard')}
              {user && navLink('/orders', 'My Orders')}
              {user?.role === 'admin' && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) => 
                    `text-sm font-semibold tracking-tight transition-colors py-1 ${isActive ? 'text-[#FFC000]' : 'text-slate-400 hover:text-[#FFC000]'}`
                  }
                >
                  Admin
                </NavLink>
              )}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-1.5 sm:gap-1">

              {/* Desktop-only icons */}
              <div className="hidden md:flex items-center gap-1">
                {iconBtn(onShowGuide || (() => { }), <HelpCircle className="h-4 w-4" />, undefined, 'How it works')}
                {iconBtn(toggleDark, isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />, undefined, 'Toggle theme')}
                {user && !telegramLinked && iconBtn(onTelegramClick || (() => { }), <Send className="h-3.5 w-3.5 text-[#229ED9]" />, undefined, 'Connect Telegram')}
              </div>

              {user && (
                <button
                  onClick={() => {
                    if (onMessagesClick) {
                      onMessagesClick();
                    } else {
                      navigate('/messages');
                    }
                  }}
                  title="Messages"
                  className={`relative p-2 rounded-xl transition-all duration-150 ${
                    location.pathname === '/messages' 
                      ? 'text-[#FFC000] bg-white/10' 
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <MessageCircle className="h-4 w-4" />
                  {unreadMessageCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full px-0.5 border-2 border-slate-900 overflow-hidden">
                      {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                    </span>
                  )}
                </button>
              )}

              {/* Bell — always visible */}
              {user && (
                <div className="relative" ref={notifRef}>
                  {iconBtn(toggleNotifications, <Bell className="h-4 w-4" />, unreadNotificationCount, 'Notifications')}

                  {/* ── Desktop dropdown (md+) ── */}
                  <AnimatePresence>
                    {showNotifications && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="hidden md:block absolute right-0 top-full mt-2 w-80 bg-slate-900 rounded-2xl shadow-2xl shadow-black/40 border border-white/10 z-50 overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-white">Notifications</h3>
                            {notifications.filter(n => !n.is_read).length > 0 && (
                              <span className="bg-[#FFC000] text-slate-900 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                {notifications.filter(n => !n.is_read).length}
                              </span>
                            )}
                          </div>
                          {notifications.some(n => !n.is_read) && (
                            <button onClick={markAllAsRead} className="text-[11px] font-semibold text-[#FFC000] hover:text-[#e6ac00] transition-colors">
                              Mark all read
                            </button>
                          )}
                        </div>
                        <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                          {loadingNotifs ? <NotifLoading /> : notifications.length === 0 ? <NotifEmpty /> : notifications.map(n => <NotifRow key={n.id} n={n} onClick={handleNotificationClick} />)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Desktop cart + user menu */}
              {user && (
                <div className="hidden md:block">
                  {iconBtn(() => navigate('/cart'), <ShoppingCart className="h-4 w-4" />, cartCount, 'Cart')}
                </div>
              )}

              {user ? (
                <div className="hidden md:flex items-center gap-3 ml-2 pl-3 border-l border-white/10">
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center gap-1 p-1 pr-2.5 rounded-full hover:bg-white/10 transition-all"
                    >
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#FFC000] to-[#e6ac00] flex items-center justify-center text-slate-900 text-xs font-black shadow-lg shadow-[#FFC000]/20">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {showUserMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.96 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 top-full mt-2 w-52 bg-slate-900 rounded-2xl shadow-2xl shadow-black/40 border border-white/10 z-50 overflow-hidden"
                          >
                            <div className="px-4 py-3 bg-white/5 border-b border-white/10">
                              <p className="text-sm font-bold text-white truncate">{user.name}</p>
                              <p className="text-xs text-slate-400 truncate">{user.email}</p>
                            </div>
                            <div className="p-1.5 space-y-0.5">
                              {[
                                { icon: UserIcon, label: 'Dashboard', path: '/profile', state: { tab: 'overview' } },
                                { icon: ShoppingBag, label: 'My Orders', path: '/orders' },
                                { icon: Settings, label: 'Settings', path: '/profile', state: { tab: 'settings' } },
                              ].map(({ icon: Icon, label, path, state }) => (
                                <button
                                  key={label}
                                  onClick={() => { navigate(path, { state }); setShowUserMenu(false); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                                >
                                  <Icon className="h-4 w-4" /> {label}
                                </button>
                              ))}
                              <button
                                onClick={() => { logout(); setShowUserMenu(false); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-[#FFC000] text-sm font-bold transition-colors"
                              >
                                <LogOut className="h-4 w-4" /> Sign Out
                              </button>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2 ml-2">
                  <button
                    onClick={() => setShowAuth(true)}
                    className="text-sm font-semibold text-slate-400 hover:text-white px-3 py-2 rounded-xl hover:bg-white/10 transition-all"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => setShowAuth(true)}
                    className="flex items-center gap-1.5 bg-[#FFC000] hover:bg-[#e6ac00] text-slate-900 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#FFC000]/20"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    List Notes
                  </button>
                </div>
              )}

              {user && (
                <button
                  onClick={() => navigate('/sell')}
                  className="hidden md:flex items-center gap-1.5 bg-[#FFC000] hover:bg-[#e6ac00] text-slate-900 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#FFC000]/20 ml-2"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  List Notes
                </button>
              )}

              {/* Mobile: Cart icon */}
              {user && (
                <div className="md:hidden">
                  {iconBtn(() => navigate('/cart'), <ShoppingCart className="h-4 w-4" />, cartCount, 'Cart')}
                </div>
              )}

              {/* Mobile: Sign in button when logged out */}
              {!user && (
                <button
                  onClick={() => setShowAuth(true)}
                  className="md:hidden flex items-center gap-1.5 bg-[#FFC000] hover:bg-[#e6ac00] active:scale-95 text-slate-900 px-3 py-2 rounded-xl text-xs font-black transition-all shadow-md shadow-[#FFC000]/20"
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  Sign In
                </button>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile Hamburger Menu (Dropdown style) ── */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden overflow-hidden bg-slate-900 border-t border-white/10"
            >
              <div className="px-4 py-6 space-y-1">
                {user && (
                  <div className="flex items-center gap-3 px-3 py-3 mb-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FFC000] to-[#e6ac00] flex items-center justify-center text-slate-900 text-sm font-black shadow-lg shadow-[#FFC000]/20">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-white truncate">{user.name}</p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    </div>
                  </div>
                )}
                {[
                  { icon: Search, label: 'Browse Notes', path: '/browse' },
                  { icon: FileText, label: 'Free Study Materials', path: '/resources' },
                  { icon: PlusCircle, label: 'Sell Notes', path: '/sell' },
                  ...(user ? [
                    { icon: UserIcon, label: 'Dashboard', path: '/profile', state: { tab: 'overview' } },
                    { icon: ShoppingBag, label: 'My Orders', path: '/orders' },
                    { icon: Settings, label: 'Settings', path: '/profile', state: { tab: 'settings' } },
                    ...(!telegramLinked ? [{ icon: Send, label: 'Connect Telegram', onClick: onTelegramClick, color: '#229ED9' }] : []),
                  ] : []),
                  { icon: isDark ? Sun : Moon, label: `${isDark ? 'Light' : 'Dark'} Mode`, path: null, onClick: () => toggleDark() },
                  { icon: HelpCircle, label: 'How it Works', path: null, onClick: () => { onShowGuide?.(); setIsMenuOpen(false); } },
                ].map((item: any) => {
                  const { icon: Icon, label, path, badge, onClick, color } = item;
                  const isActive = path ? location.pathname === path : false;
                  return (
                    <button
                      key={label}
                      onClick={() => { 
                        if (onClick) {
                          onClick();
                        } else {
                          const needsAuth = ['/sell', '/browse', '/resources', '/profile', '/orders', '/cart', '/messages'].includes(path);
                          if (needsAuth && !user) {
                            setShowAuth(true);
                          } else {
                            navigate(path, { state: item.state });
                          }
                          setIsMenuOpen(false);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-3.5 rounded-xl transition-colors ${isActive ? 'bg-[#FFC000]/10 text-[#FFC000]' : 'hover:bg-white/5 text-slate-400 hover:text-white'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${color ? '' : 'opacity-70'}`} style={color ? { color: color } : {}} />
                        <span className={`text-sm font-bold ${color ? 'text-white' : ''}`}>{label}</span>
                      </div>
                      {badge > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md">{badge}</span>
                      )}
                    </button>
                  );
                })}

                <div className="pt-4 mt-4 border-t border-white/10 space-y-2">
                  {user ? (
                    <button
                      onClick={() => { logout(); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-3.5 rounded-xl text-[#FFC000] hover:bg-[#FFC000]/10 text-sm font-black transition-colors"
                    >
                      <LogOut className="h-5 w-5" /> Sign Out
                    </button>
                  ) : (
                    <button
                      onClick={() => { setShowAuth(true); setIsMenuOpen(false); }}
                      className="w-full py-4 bg-[#FFC000] hover:bg-[#e6ac00] text-slate-900 rounded-xl text-sm font-black shadow-lg shadow-[#FFC000]/20 transition-all active:scale-[0.98]"
                    >
                      Sign In
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── Mobile Notification Bottom Sheet ── */}
      <NotificationSheet 
        isOpen={showMobileSheet}
        onClose={() => setShowMobileSheet(false)}
        notifications={notifications}
        loading={loadingNotifs}
        onMarkAllRead={markAllAsRead}
        onNotificationClick={handleNotificationClick}
      />
    </>
  );
};