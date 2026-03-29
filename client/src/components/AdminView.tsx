import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3, Users, Package, ShoppingBag,
  Trash2, Archive, RotateCcw, X,
  AlertTriangle, DollarSign, Shield, MessageCircle,
  Eye, Briefcase, ShoppingCart as ShoppingCartIcon,
  TrendingUp, ChevronRight, ChevronLeft, MapPin,
  Hash, Calendar, Tag, Star, User as UserIcon,
  BookOpen, Layers, Clock, CheckCircle2, XCircle,
  PackageOpen, Truck, Settings as SettingsIcon, Edit2, Send as SendIcon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { apiRequest } from '../utils/api.js';
import { SUBJECTS_BY_SEM, SEMESTERS, LOCATIONS, STANDARD_SPOTS } from '../utils/constants.js';
import { ExternalLink, Link as LinkIcon, Save } from 'lucide-react';
import { statusColors, formatStatus } from '../utils/status';

type AdminTab = 'overview' | 'listings' | 'resources' | 'users' | 'orders' | 'chats' | 'settings';

interface Stats {
  users: number;
  totalListings: number;
  activeListings: number;
  outOfStock: number;
  orders: number;
  platformRevenue: number;
  platformVolume: number;
  activeResources: number;
}

const fmt = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

// ─── Detail Panel wrapper ───────────────────────────────────────────────────
const DetailPanel: React.FC<{ title: string; subtitle?: string; onBack: () => void; children: React.ReactNode }> = ({ title, subtitle, onBack, children }) => (
  <motion.div
    key="detail"
    initial={{ opacity: 0, x: 24 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -24 }}
    transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
  >
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={onBack}
        className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div>
        <h2 className="font-black text-white text-lg leading-none">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {children}
  </motion.div>
);

// ─── Info row ───────────────────────────────────────────────────────────────
const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
    <div className="text-slate-500 mt-0.5 shrink-0">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">{label}</p>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  </div>
);

// ─── Stat chip ──────────────────────────────────────────────────────────────
const StatChip: React.FC<{ label: string; value: string | number; gold?: boolean }> = ({ label, value, gold }) => (
  <div className={`rounded-xl p-4 border text-center ${gold ? 'bg-[#FFC000]/10 border-[#FFC000]/20' : 'bg-white/5 border-white/10'}`}>
    <p className={`text-[9px] font-black uppercase tracking-widest mb-1.5 ${gold ? 'text-[#FFC000]' : 'text-slate-500'}`}>{label}</p>
    <p className={`text-2xl font-black ${gold ? 'text-[#FFC000]' : 'text-white'}`}>{value}</p>
  </div>
);

export const AdminView: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [subjectLinks, setSubjectLinks] = useState<any[]>([]);
  const [dbSettings, setDbSettings] = useState<any>(null);
  const [localFee, setLocalFee] = useState<string>('0');
  const [localDiscount, setLocalDiscount] = useState<string>('40');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  // Detail views
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const [selectedResource, setSelectedResource] = useState<any | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userActivity, setUserActivity] = useState<{ listings: any[]; orders: any[] } | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Admin listing edit
  const [editingListing, setEditingListing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [isSavingListing, setIsSavingListing] = useState(false);

  // Chat transcript
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  // Listing filter
  const [listingFilter, setListingFilter] = useState('');

  // Purge modal
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState('');

  // Telegram broadcast
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastLink, setBroadcastLink] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  // No manual headers with apiRequest

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const res = await apiRequest('/api/admin/stats');
        if (res.ok) setStats(await res.json());
      } else if (tab === 'listings') {
        const url = listingFilter ? `/api/admin/listings?status=${listingFilter}` : '/api/admin/listings';
        const res = await apiRequest(url);
        if (res.ok) setListings(await res.json());
      } else if (tab === 'resources') {
        const res = await apiRequest('/api/admin/resources');
        if (res.ok) setResources(await res.json());
        const linksRes = await apiRequest('/api/resources/subject-links');
        if (linksRes.ok) setSubjectLinks(await linksRes.json());
      } else if (tab === 'users') {
        const res = await apiRequest('/api/admin/users');
        if (res.ok) setUsers(await res.json());
      } else if (tab === 'orders') {
        const res = await apiRequest('/api/admin/orders');
        if (res.ok) setOrders(await res.json());
      } else if (tab === 'chats') {
        const res = await apiRequest('/api/admin/chats');
        if (res.ok) setChats(await res.json());
      } else if (tab === 'settings') {
        const res = await apiRequest('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setDbSettings(data);
          setLocalFee(String(data.platform_fee_percentage));
          setLocalDiscount(String(data.recommended_discount_percentage || 40));
        }
      }
    } catch (err) {
      console.error('Admin fetch error:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [tab, listingFilter]);
  // Reset detail views on tab change
  useEffect(() => { setSelectedListing(null); setSelectedResource(null); setSelectedUser(null); setSelectedOrder(null); setUserActivity(null); setEditingListing(false); }, [tab]);

  // Sync selected details when main lists update (to keep views reactive after doAction)
  useEffect(() => {
    if (selectedUser && users.length > 0) {
      const updated = users.find(u => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
    }
  }, [users]);

  useEffect(() => {
    if (selectedListing && listings.length > 0) {
      const updated = listings.find(l => l.id === selectedListing.id);
      if (updated) setSelectedListing(updated);
    }
  }, [listings]);

  useEffect(() => {
    if (selectedResource && resources.length > 0) {
      const updated = resources.find(r => r.id === selectedResource.id);
      if (updated) setSelectedResource(updated);
    }
  }, [resources]);

  const doAction = async (url: string, method: string, body?: any) => {
    try {
      const res = await apiRequest(url, { method, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json();
      setActionMsg(data.message || 'Done');
      fetchData();
      setTimeout(() => setActionMsg(''), 3000);
    } catch {
      setActionMsg('Action failed');
    }
  };

  const fetchTranscript = async (chatId: string) => {
    setSelectedChatId(chatId);
    setLoadingTranscript(true);
    try {
      const res = await apiRequest(`/api/admin/chats/${chatId}/messages`);
      if (res.ok) setTranscript(await res.json());
    } finally {
      setLoadingTranscript(false);
    }
  };

  const fetchUserActivity = async (user: any) => {
    setSelectedUser(user);
    setLoadingActivity(true);
    setUserActivity(null);
    try {
      const res = await apiRequest(`/api/admin/users/${user.id}/activity`);
      if (res.ok) setUserActivity(await res.json());
    } finally {
      setLoadingActivity(false);
    }
  };

  const handlePurge = async () => {
    if (purgeConfirm !== 'PURGE') return;
    try {
      const res = await apiRequest('/api/admin/purge-data', { method: 'POST' });
      if (res.ok) { setShowPurgeModal(false); setPurgeConfirm(''); window.location.reload(); }
      else alert('Purge failed');
    } catch { alert('Error purging data'); }
  };

  const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'listings', label: 'Listings', icon: <Package className="h-4 w-4" /> },
    { id: 'resources', label: 'Study Material', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
    { id: 'orders', label: 'Orders', icon: <ShoppingBag className="h-4 w-4" /> },
    { id: 'chats', label: 'Chats', icon: <MessageCircle className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon className="h-4 w-4" /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-24"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-[#FFC000] rounded-2xl shadow-lg shadow-[#FFC000]/20">
          <Shield className="h-5 w-5 text-slate-900" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none">Admin Panel</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage listings, users, and orders</p>
        </div>
      </div>

      {/* Action toast */}
      <AnimatePresence>
        {actionMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-5 px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl text-sm font-semibold border border-emerald-500/20"
          >
            ✓ {actionMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border ${tab === t.id
                ? 'bg-[#FFC000] text-slate-900 border-[#FFC000] shadow-lg shadow-[#FFC000]/20'
                : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
              }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content panel */}
      <div className="bg-slate-900 rounded-2xl border border-white/10 shadow-2xl shadow-black/40 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative h-10 w-10">
              <span className="absolute inset-0 rounded-full border-4 border-[#FFC000]/20"></span>
              <span className="absolute inset-0 rounded-full border-4 border-[#FFC000] border-t-transparent animate-spin"></span>
            </div>
            <p className="text-xs font-bold text-slate-500 animate-pulse">Loading…</p>
          </div>
        ) : (
          <div className="p-5 sm:p-7">
            <AnimatePresence mode="wait">

              {/* ══ OVERVIEW ══════════════════════════════════════════════ */}
              {tab === 'overview' && stats && (
                <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                  <div className="grid sm:grid-cols-4 gap-4">
                    <StatChip label="Total Users" value={stats.users} />
                    <StatChip label="Active Listings" value={stats.activeListings} />
                    <StatChip label="Active Resources" value={stats.activeResources} />
                    <StatChip label="Total Orders" value={stats.orders} />
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="p-5 rounded-2xl border bg-red-500/10 border-red-500/20">
                      <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> Out of Stock
                      </p>
                      <p className="text-3xl font-black text-red-400 mb-3">{stats.outOfStock}</p>
                      {stats.outOfStock > 0 && (
                        <button
                          onClick={() => doAction('/api/admin/archive-out-of-stock', 'POST')}
                          className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded-lg border border-red-500/20 transition-colors"
                        >
                          Archive All
                        </button>
                      )}
                    </div>
                    <StatChip label="Platform Revenue" value={`₹${stats.platformRevenue}`} gold />
                    <div className="p-5 rounded-2xl border bg-white/5 border-white/10">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" /> Gross Volume
                      </p>
                      <p className="text-3xl font-black text-white">₹{stats.platformVolume}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Total transacted value</p>
                    </div>
                  </div>

                  {/* Danger zone */}
                  <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-black text-red-400 flex items-center gap-2 mb-1.5">
                          <AlertTriangle className="h-4 w-4" /> Danger Zone
                        </h3>
                        <p className="text-sm text-slate-400 max-w-md leading-relaxed">
                          Permanently deletes all listings, orders, messages, notifications, and reviews. User accounts are preserved.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowPurgeModal(true)}
                        className="shrink-0 flex items-center gap-2 px-5 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-xl font-bold text-sm transition-all"
                      >
                        <Trash2 className="h-4 w-4" /> Purge All Data
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ══ LISTINGS ══════════════════════════════════════════════ */}
              {tab === 'listings' && (
                <AnimatePresence mode="wait">
                  {selectedListing ? (
                    <DetailPanel
                      key="listing-detail"
                      title={selectedListing.title}
                      subtitle={`Listed by ${selectedListing.seller_name}`}
                      onBack={() => { setSelectedListing(null); setEditingListing(false); }}
                    >
                      {!editingListing ? (
                        <>
                          <div className="grid md:grid-cols-2 gap-5">
                            {/* Image */}
                            <div className="rounded-2xl overflow-hidden border border-white/10 aspect-[4/3] relative">
                              <img src={selectedListing.image_url} alt="" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                              <span className={`absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${statusColors[selectedListing.status] || 'bg-white/10 text-white'}`}>
                                {fmt(selectedListing.status)}
                              </span>
                            </div>

                            {/* Details */}
                            <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                              <InfoRow icon={<Hash className="h-3.5 w-3.5" />} label="ID" value={<span className="font-mono text-xs">{selectedListing.id}</span>} />
                              <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="Course Code" value={selectedListing.course_code} />
                              <InfoRow icon={<DollarSign className="h-3.5 w-3.5" />} label="Price" value={`₹${selectedListing.price}`} />
                              <InfoRow icon={<Layers className="h-3.5 w-3.5" />} label="Quantity" value={selectedListing.quantity} />
                              <InfoRow icon={<BookOpen className="h-3.5 w-3.5" />} label="Material Type" value={selectedListing.material_type || '—'} />
                              <InfoRow icon={<Star className="h-3.5 w-3.5" />} label="Condition" value={selectedListing.condition || '—'} />
                              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={selectedListing.location || '—'} />
                              <InfoRow icon={<UserIcon className="h-3.5 w-3.5" />} label="Seller" value={`${selectedListing.seller_name} (${selectedListing.seller_email || '—'})`} />
                              {selectedListing.meetup_location && (
                                <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Meetup Notes" value={<em className="text-slate-300">"{selectedListing.meetup_location}"</em>} />
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2 mt-5">
                            <button
                              onClick={() => {
                                setEditForm({
                                  title: selectedListing.title || '',
                                  description: selectedListing.description || '',
                                  original_price: selectedListing.original_price === null ? '' : String(selectedListing.original_price),
                                  price: String(selectedListing.price ?? ''),
                                  quantity: String(selectedListing.quantity ?? ''),
                                  condition: selectedListing.condition || 'Good',
                                  location: selectedListing.location || '',
                                  semester: selectedListing.semester || '',
                                  course_code: selectedListing.course_code || '',
                                  material_type: selectedListing.material_type || 'ppt',
                                  preferred_meetup_spot: selectedListing.preferred_meetup_spot || '',
                                  meetup_location: selectedListing.meetup_location || '',
                                  imageUrls: '',
                                  subjects: '',
                                  is_multiple_subjects: !!selectedListing.is_multiple_subjects,
                                });
                                setEditingListing(true);
                              }}
                              className="flex items-center gap-2 px-4 py-2.5 bg-[#FFC000]/10 hover:bg-[#FFC000]/20 border border-[#FFC000]/20 text-[#FFC000] rounded-xl text-xs font-bold transition-colors"
                            >
                              <Edit2 className="h-4 w-4" /> Edit Details
                            </button>
                            {selectedListing.status === 'active' && (
                              <button
                                onClick={() => { doAction(`/api/admin/listings/${selectedListing.id}/archive`, 'PATCH'); setSelectedListing(null); }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                              >
                                <Archive className="h-4 w-4" /> Archive
                              </button>
                            )}
                            {selectedListing.status === 'archived' && (
                              <button
                                onClick={() => { doAction(`/api/admin/listings/${selectedListing.id}/activate`, 'PATCH'); setSelectedListing(null); }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold transition-colors"
                              >
                                <RotateCcw className="h-4 w-4" /> Re-activate
                              </button>
                            )}
                            <button
                              onClick={() => { if (confirm('Permanently delete this listing?')) { doAction(`/api/admin/listings/${selectedListing.id}`, 'DELETE'); setSelectedListing(null); } }}
                              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-colors"
                            >
                              <Trash2 className="h-4 w-4" /> Delete Listing
                            </button>
                          </div>
                        </>
                      ) : (
                        /* ── Inline Edit Form ── */
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-5"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#FFC000]">Editing Listing</p>
                            <button
                              onClick={() => setEditingListing(false)}
                              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" /> Cancel
                            </button>
                          </div>

                          {/* Title */}
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Title</p>
                            <input
                              type="text"
                              value={editForm.title}
                              onChange={e => setEditForm((f: any) => ({ ...f, title: e.target.value }))}
                              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FFC000]/40 transition-all"
                            />
                          </div>

                          {/* Description */}
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Description</p>
                            <textarea
                              value={editForm.description}
                              onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))}
                              rows={3}
                              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FFC000]/40 transition-all resize-none"
                            />
                          </div>

                          {/* Pricing & Quantity */}
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Orig Price (₹)</p>
                              <input
                                type="number"
                                min="0"
                                value={editForm.original_price}
                                onChange={e => setEditForm((f: any) => ({ ...f, original_price: e.target.value }))}
                                placeholder="Auto/Empty"
                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/40 transition-all"
                              />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Price (₹)</p>
                              <input
                                type="number"
                                min="0"
                                value={editForm.price}
                                onChange={e => setEditForm((f: any) => ({ ...f, price: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/40 transition-all"
                              />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Quantity</p>
                              <input
                                type="number"
                                min="1"
                                value={editForm.quantity}
                                onChange={e => setEditForm((f: any) => ({ ...f, quantity: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/40 transition-all"
                              />
                            </div>
                          </div>

                          {/* Semester & Course */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Semester</p>
                              <select
                                value={editForm.semester}
                                onChange={e => setEditForm((f: any) => ({ ...f, semester: e.target.value, course_code: '' }))}
                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/40 transition-all"
                              >
                                <option value="">Select…</option>
                                {Object.keys(SUBJECTS_BY_SEM).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Course Code</p>
                              {editForm.semester ? (
                                <select
                                  value={editForm.course_code}
                                  onChange={e => setEditForm((f: any) => ({ ...f, course_code: e.target.value }))}
                                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/40 transition-all"
                                >
                                  <option value="">Select…</option>
                                  {(SUBJECTS_BY_SEM[editForm.semester] || []).map((s: string) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={editForm.course_code}
                                  onChange={e => setEditForm((f: any) => ({ ...f, course_code: e.target.value }))}
                                  placeholder="e.g. CS F111"
                                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FFC000]/40 transition-all"
                                />
                              )}
                            </div>
                          </div>

                          {/* Material Type & Condition */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Material Type</p>
                              <select
                                value={editForm.material_type}
                                onChange={e => setEditForm((f: any) => ({ ...f, material_type: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/40 transition-all"
                              >
                                {['ppt', 'handwritten', 'book', 'other'].map(t => <option key={t} value={t}>{fmt(t)}</option>)}
                              </select>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Condition</p>
                              <select
                                value={editForm.condition}
                                onChange={e => setEditForm((f: any) => ({ ...f, condition: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/40 transition-all"
                              >
                                {['Like New', 'Good', 'Fair', 'Heavily Annotated'].map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          </div>

                          {/* Location */}
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Location</p>
                            <select
                              value={editForm.location}
                              onChange={e => setEditForm((f: any) => ({ ...f, location: e.target.value }))}
                              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/40 transition-all"
                            >
                              {LOCATIONS.map((l: string) => <option key={l} value={l}>{l}</option>)}
                            </select>
                          </div>

                          {/* Meetup spot */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Preferred Meetup Spot</p>
                              <select
                                value={editForm.preferred_meetup_spot}
                                onChange={e => setEditForm((f: any) => ({ ...f, preferred_meetup_spot: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC000]/40 transition-all"
                              >
                                <option value="">—</option>
                                {STANDARD_SPOTS.map((s: string) => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Meetup Instructions</p>
                              <input
                                type="text"
                                value={editForm.meetup_location}
                                onChange={e => setEditForm((f: any) => ({ ...f, meetup_location: e.target.value }))}
                                placeholder="e.g. Cafe 2, evenings"
                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FFC000]/40 transition-all"
                              />
                            </div>
                          </div>

                          {/* Raw Image URLs & Subjects (for advanced edits) */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 flex items-center gap-1.5">
                                Image URLs (JSON Array) <span className="text-[9px] lowercase opacity-60 font-normal">Optional</span>
                              </p>
                              <input
                                type="text"
                                value={editForm.imageUrls}
                                onChange={e => setEditForm((f: any) => ({ ...f, imageUrls: e.target.value }))}
                                placeholder='e.g. ["https://img1...", "https://img2..."]'
                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FFC000]/40 transition-all text-xs"
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-3 mb-1.5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 flex-1 m-0">
                                  Subjects (JSON Array) <span className="text-[9px] lowercase opacity-60 font-normal">Optional</span>
                                </p>
                                <label className="flex items-center gap-2 text-[10px] text-slate-300 font-bold uppercase tracking-wider cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={editForm.is_multiple_subjects}
                                    onChange={e => setEditForm((f: any) => ({...f, is_multiple_subjects: e.target.checked}))}
                                    className="accent-[#FFC000]"
                                  />
                                  Multiple?
                                </label>
                              </div>
                              <input
                                type="text"
                                value={editForm.subjects}
                                onChange={e => setEditForm((f: any) => ({ ...f, subjects: e.target.value }))}
                                placeholder='e.g. ["Physics", "Math"]'
                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FFC000]/40 transition-all text-xs"
                                disabled={!editForm.is_multiple_subjects}
                                title={!editForm.is_multiple_subjects ? "Check 'Multiple?' to edit subjects array natively" : ""}
                              />
                            </div>
                          </div>

                          {/* Save / Cancel */}
                          <div className="flex gap-3 pt-2">
                            <button
                              disabled={isSavingListing}
                              onClick={async () => {
                                // Basic client-side validation for numbers
                                const p = parseInt(editForm.price);
                                const q = parseInt(editForm.quantity);
                                if (isNaN(p) || p < 0) return setActionMsg('Price must be a valid number ≥ 0');
                                if (isNaN(q) || q < 0) return setActionMsg('Quantity must be a valid number ≥ 0');

                                // Prep payload
                                const payload = { ...editForm, price: p, quantity: q };
                                if (!payload.imageUrls.trim()) delete payload.imageUrls;
                                if (!payload.subjects.trim()) delete payload.subjects;

                                setIsSavingListing(true);
                                try {
                                  const res = await apiRequest(`/api/admin/listings/${selectedListing.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify(payload),
                                  });
                                  const data = await res.json();
                                  if (res.ok) {
                                    setActionMsg('Listing updated successfully');
                                    setEditingListing(false);
                                    fetchData();
                                    setTimeout(() => setActionMsg(''), 3000);
                                  } else {
                                    setActionMsg(data.error || 'Update failed');
                                  }
                                } catch {
                                  setActionMsg('Update failed');
                                } finally {
                                  setIsSavingListing(false);
                                }
                              }}
                              className="flex items-center gap-2 px-5 py-2.5 bg-[#FFC000] hover:bg-[#e6ac00] text-slate-900 rounded-xl text-sm font-black transition-all disabled:opacity-60 shadow-lg shadow-[#FFC000]/20"
                            >
                              {isSavingListing ? (
                                <span className="h-4 w-4 border-2 border-slate-900/30 border-t-slate-900 animate-spin rounded-full" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                              Save Changes
                            </button>
                            <button
                              onClick={() => setEditingListing(false)}
                              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm font-bold transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </DetailPanel>
                  ) : (
                    <motion.div key="listing-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <div className="flex gap-2 mb-5">
                        {['', 'active', 'archived'].map(f => (
                          <button
                            key={f}
                            onClick={() => setListingFilter(f)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${listingFilter === f
                                ? 'bg-[#FFC000] text-slate-900 border-[#FFC000]'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                              }`}
                          >
                            {f === '' ? 'All' : fmt(f)}
                          </button>
                        ))}
                      </div>
                      {listings.length === 0 ? (
                        <p className="text-center py-16 text-slate-500 text-sm">No listings found</p>
                      ) : (
                        <div className="space-y-2">
                          {listings.map(l => (
                            <div
                              key={l.id}
                              onClick={() => setSelectedListing(l)}
                              className="flex items-center gap-4 p-3.5 rounded-xl border border-white/10 hover:border-[#FFC000]/30 hover:bg-white/5 transition-all cursor-pointer group"
                            >
                              <img src={l.image_url} alt="" className="w-12 h-12 rounded-xl object-cover bg-white/5 shrink-0 group-hover:scale-105 transition-transform duration-300" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate group-hover:text-[#FFC000] transition-colors">{l.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{l.seller_name} · ₹{l.price} · Qty: {l.quantity}</p>
                              </div>
                              <span className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${statusColors[l.status] || 'bg-white/10 text-white'}`}>
                                {fmt(l.status)}
                              </span>
                              <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                {l.status === 'active' && (
                                  <button onClick={() => doAction(`/api/admin/listings/${l.id}/archive`, 'PATCH')} title="Archive" className="p-2 text-slate-500 hover:text-[#FFC000] hover:bg-white/10 rounded-lg transition-colors">
                                    <Archive className="h-4 w-4" />
                                  </button>
                                )}
                                {l.status === 'archived' && (
                                  <button onClick={() => doAction(`/api/admin/listings/${l.id}/activate`, 'PATCH')} title="Re-activate" className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors">
                                    <RotateCcw className="h-4 w-4" />
                                  </button>
                                )}
                                <button onClick={() => { if (confirm('Delete?')) doAction(`/api/admin/listings/${l.id}`, 'DELETE'); }} title="Delete" className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-[#FFC000] transition-colors shrink-0" />
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* ══ STUDY MATERIAL ════════════════════════════════════════ */}
              {tab === 'resources' && (
                <AnimatePresence mode="wait">
                  {selectedResource ? (
                    <DetailPanel
                      key="resource-detail"
                      title={selectedResource.title}
                      subtitle={`Uploaded by ${selectedResource.uploader_name}`}
                      onBack={() => setSelectedResource(null)}
                    >
                      <div className="grid md:grid-cols-2 gap-5 mb-5">
                        <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                          <InfoRow icon={<Hash className="h-3.5 w-3.5" />} label="ID" value={<span className="font-mono text-xs">{selectedResource.id}</span>} />
                          <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="Course Code" value={selectedResource.course_code || '—'} />
                          <InfoRow icon={<BookOpen className="h-3.5 w-3.5" />} label="Subject" value={selectedResource.subject_name} />
                          <InfoRow icon={<Layers className="h-3.5 w-3.5" />} label="Semester" value={selectedResource.semester} />
                          <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="Category" value={selectedResource.category} />
                          <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label="Uploaded At" value={new Date(selectedResource.created_at).toLocaleString()} />
                        </div>
                        <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                          <InfoRow icon={<UserIcon className="h-3.5 w-3.5" />} label="Uploader" value={`${selectedResource.uploader_name} (${selectedResource.uploader_email})`} />
                          <InfoRow icon={<TrendingUp className="h-3.5 w-3.5" />} label="Downloads" value={selectedResource.download_count} />
                          <InfoRow icon={<Shield className="h-3.5 w-3.5" />} label="Status" value={
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${statusColors[selectedResource.status] || 'bg-white/10 text-white'}`}>
                              {fmt(selectedResource.status)}
                            </span>
                          } />
                          <div className="mt-4">
                            <a 
                              href={`/api/resources/${selectedResource.id}/download`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FFC000] hover:bg-[#e6ac00] text-slate-900 rounded-xl text-xs font-black transition-all"
                            >
                              <Eye className="h-4 w-4" /> View / Download File
                            </a>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {selectedResource.status !== 'deleted' && (
                          <button
                            onClick={() => { if (confirm('Delete this study material?')) { doAction(`/api/resources/${selectedResource.id}`, 'DELETE'); setSelectedResource(null); } }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-colors"
                          >
                            <Trash2 className="h-4 w-4" /> Delete Resource
                          </button>
                        )}
                        {selectedResource.status === 'deleted' && (
                          <button
                            onClick={() => { doAction(`/api/admin/resources/${selectedResource.id}`, 'PATCH', { status: 'active' }); setSelectedResource(null); }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold transition-colors"
                          >
                            <RotateCcw className="h-4 w-4" /> Restore Resource
                          </button>
                        )}
                      </div>
                    </DetailPanel>
                  ) : (
                    <motion.div key="resource-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                      {/* Subject Drive Links Management */}
                      <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="p-2 bg-[#FFC000]/10 rounded-xl text-[#FFC000]">
                            <LinkIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-black text-white text-base">Subject Drive Links</h3>
                            <p className="text-xs text-slate-500">Attach a Google Drive folder for each subject</p>
                          </div>
                        </div>

                        <div className="space-y-6">
                          {SEMESTERS.map(sem => (
                            <div key={sem} className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFC000]/60">{sem}</h4>
                                {/* Semester level link */}
                                {(() => {
                                  const semLink = subjectLinks.find(l => l.semester === sem && (l.subject_name === '' || l.subject_name === null));
                                  return (
                                    <div className="flex items-center gap-2 max-w-sm flex-1">
                                      <div className="relative flex-1">
                                        <input
                                          id={`sem-link-${sem}`}
                                          type="url"
                                          placeholder={`${sem} General Drive Link`}
                                          defaultValue={semLink?.drive_link || ''}
                                          className="w-full bg-slate-800 border border-[#FFC000]/20 rounded-lg px-2 py-1 text-[10px] text-[#FFC000] focus:outline-none focus:ring-1 focus:ring-[#FFC000]/50 placeholder:text-[#FFC000]/30"
                                        />
                                      </div>
                                      <button 
                                        onClick={async () => {
                                          const input = document.getElementById(`sem-link-${sem}`) as HTMLInputElement;
                                          const newLink = input.value.trim();
                                          try {
                                            const res = await apiRequest('/api/admin/subject-links', {
                                              method: 'POST',
                                              body: JSON.stringify({ semester: sem, subject_name: '', drive_link: newLink })
                                            });
                                            if (res.ok) {
                                              setActionMsg(`${sem} link updated`);
                                              const linksRes = await apiRequest('/api/resources/subject-links');
                                              if (linksRes.ok) setSubjectLinks(await linksRes.json());
                                            }
                                          } catch (err) { setActionMsg('Failed to update link'); }
                                          setTimeout(() => setActionMsg(''), 3000);
                                        }}
                                        className="p-1.5 bg-[#FFC000]/10 hover:bg-[#FFC000]/20 border border-[#FFC000]/20 rounded-lg text-[#FFC000] transition-all active:scale-90"
                                        title="Save Link"
                                      >
                                        <Save className="h-3 w-3" />
                                      </button>
                                      {semLink?.drive_link && (
                                        <a href={semLink.drive_link} target="_blank" rel="noreferrer" className="shrink-0 p-1.5 text-[#FFC000] hover:bg-[#FFC000]/10 rounded-lg border border-transparent hover:border-[#FFC000]/20 transition-colors">
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="grid sm:grid-cols-2 gap-3">
                                {SUBJECTS_BY_SEM[sem]?.map(subject => {
                                  const existingLink = subjectLinks.find(l => l.semester === sem && l.subject_name === subject);
                                  return (
                                    <div key={subject} className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                                      <p className="text-xs font-bold text-white leading-tight">{subject}</p>
                                      <div className="flex gap-2">
                                        <div className="relative flex-1">
                                          <input
                                            id={`sub-link-${sem}-${subject}`}
                                            type="url"
                                            placeholder="Drive Link (https://...)"
                                            defaultValue={existingLink?.drive_link || ''}
                                            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#FFC000]/50"
                                          />
                                        </div>
                                        <button 
                                          onClick={async () => {
                                            const input = document.getElementById(`sub-link-${sem}-${subject}`) as HTMLInputElement;
                                            const newLink = input.value.trim();
                                            try {
                                              const res = await apiRequest('/api/admin/subject-links', {
                                                method: 'POST',
                                                body: JSON.stringify({ semester: sem, subject_name: subject, drive_link: newLink })
                                              });
                                              if (res.ok) {
                                                setActionMsg(`Link updated for ${subject}`);
                                                const linksRes = await apiRequest('/api/resources/subject-links');
                                                if (linksRes.ok) setSubjectLinks(await linksRes.json());
                                              }
                                            } catch (err) { setActionMsg('Failed to update link'); }
                                            setTimeout(() => setActionMsg(''), 3000);
                                          }}
                                          className="p-2 bg-[#FFC000]/10 hover:bg-[#FFC000]/20 border border-[#FFC000]/20 rounded-lg text-[#FFC000] transition-all active:scale-90"
                                          title="Save Link"
                                        >
                                          <Save className="h-4 w-4" />
                                        </button>
                                        {existingLink?.drive_link && (
                                          <a 
                                            href={existingLink.drive_link} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-400 hover:text-[#FFC000] transition-colors"
                                          >
                                            <ExternalLink className="h-4 w-4" />
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="h-px bg-white/5" />

                      {/* Existing Resource List Section Header */}
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-black text-white text-base">User Uploads</h3>
                          <p className="text-xs text-slate-500">Manage all study materials uploaded by users</p>
                        </div>
                      </div>

                      {resources.length === 0 ? (
                        <p className="text-center py-16 text-slate-500 text-sm">No study material found</p>
                      ) : (
                        <div className="space-y-2">
                          {resources.map(r => (
                            <div
                              key={r.id}
                              onClick={() => setSelectedResource(r)}
                              className="flex items-center gap-4 p-3.5 rounded-xl border border-white/10 hover:border-[#FFC000]/30 hover:bg-white/5 transition-all cursor-pointer group"
                            >
                              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 shrink-0">
                                <BookOpen className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate group-hover:text-[#FFC000] transition-colors">{r.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{r.uploader_name} · {r.subject_name} · Sem {r.semester}</p>
                              </div>
                              <span className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${statusColors[r.status] || 'bg-white/10 text-white'}`}>
                                {fmt(r.status)}
                              </span>
                              <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-[#FFC000] transition-colors shrink-0" />
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* ══ USERS ══════════════════════════════════════════════════ */}
              {tab === 'users' && (
                <AnimatePresence mode="wait">
                  {selectedUser ? (
                    <DetailPanel
                      key="user-detail"
                      title={selectedUser.name}
                      subtitle={selectedUser.email}
                      onBack={() => { setSelectedUser(null); setUserActivity(null); }}
                    >
                      <div className="grid sm:grid-cols-3 gap-4 mb-5">
                        <StatChip label="Earnings" value={`₹${selectedUser.total_earnings || 0}`} gold />
                        <StatChip label="Items Sold" value={selectedUser.listings_count || 0} />
                        <StatChip label="Purchased" value={selectedUser.buy_count || 0} />
                      </div>

                      <div className="grid md:grid-cols-2 gap-5 mb-5">
                        {/* Profile card */}
                        <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                          <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/10">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FFC000] to-[#e6ac00] flex items-center justify-center text-slate-900 text-xl font-black shadow-lg shadow-[#FFC000]/20">
                              {selectedUser.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-black text-white text-base">{selectedUser.name}</p>
                              <p className="text-sm text-slate-400">{selectedUser.email}</p>
                              {selectedUser.role === 'admin' && (
                                <span className="inline-block mt-1 px-2 py-0.5 bg-[#FFC000]/20 text-[#FFC000] text-[9px] font-black rounded uppercase tracking-widest border border-[#FFC000]/20">Admin</span>
                              )}
                            </div>
                          </div>
                          <InfoRow icon={<Shield className="h-3.5 w-3.5" />} label="Role" value={
                            <select
                              value={selectedUser.role}
                              onChange={e => doAction(`/api/admin/users/${selectedUser.id}/role`, 'PATCH', { role: e.target.value })}
                              className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none"
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          } />
                          <InfoRow icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Status" value={
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${selectedUser.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {selectedUser.status === 'active' ? 'Active' : 'Blocked'}
                              </span>
                              {selectedUser.status === 'active' ? (
                                <button
                                  onClick={() => { if (confirm(`Block ${selectedUser.name}?`)) doAction(`/api/admin/users/${selectedUser.id}/status`, 'PATCH', { status: 'blocked' }); }}
                                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                                >
                                  Block
                                </button>
                              ) : (
                                <button
                                  onClick={() => doAction(`/api/admin/users/${selectedUser.id}/status`, 'PATCH', { status: 'active' })}
                                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                                >
                                  Unblock
                                </button>
                              )}
                            </div>
                          } />
                          <InfoRow icon={<Layers className="h-3.5 w-3.5" />} label="Upload Limit" value={
                            <div className="flex items-center gap-2">
                              <input
                                key={selectedUser.monthly_upload_limit}
                                type="number"
                                min="0"
                                defaultValue={selectedUser.monthly_upload_limit ?? 10}
                                onBlur={e => {
                                  const val = parseInt(e.target.value);
                                  if (!isNaN(val) && val !== selectedUser.monthly_upload_limit) {
                                    doAction(`/api/admin/users/${selectedUser.id}/upload-limit`, 'PATCH', { limit: val });
                                  }
                                }}
                                className="w-16 text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-[#FFC000]/50"
                              />
                              <span className="text-[10px] text-slate-500">per month</span>
                            </div>
                          } />
                        </div>

                        {/* Activity summary */}
                        <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-4">Activity</p>
                          {loadingActivity ? (
                            <div className="flex justify-center py-8">
                              <span className="h-6 w-6 border-2 border-[#FFC000] border-t-transparent animate-spin rounded-full" />
                            </div>
                          ) : userActivity ? (
                            <div className="space-y-2">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Recent Listings</p>
                              {userActivity.listings.slice(0, 3).map(l => (
                                <div key={l.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                                  <img src={l.image_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-white truncate">{l.title}</p>
                                    <p className="text-[10px] text-slate-500">₹{l.price} · {fmt(l.status)}</p>
                                  </div>
                                </div>
                              ))}
                              {userActivity.listings.length === 0 && <p className="text-xs text-slate-500 italic">No listings yet.</p>}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Full activity */}
                      {userActivity && (
                        <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-4">Purchase History</p>
                          {userActivity.orders.length === 0 ? (
                            <p className="text-xs text-slate-500 italic">No purchases yet.</p>
                          ) : (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {userActivity.orders.map(o => (
                                <div key={o.id} className="p-3 bg-white/5 rounded-xl border border-white/10">
                                  <div className="flex justify-between items-center mb-1">
                                    <p className="text-[10px] font-mono text-slate-500">#{o.id.slice(0, 8)}</p>
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase ${statusColors[o.status] || 'bg-white/10 text-white'}`}>
                                      {fmt(o.status)}
                                    </span>
                                  </div>
                                  <p className="text-base font-black text-white">₹{o.total_amount}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </DetailPanel>
                  ) : (
                    <motion.div key="user-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {users.length === 0 ? (
                        <p className="text-center py-16 text-slate-500 text-sm">No users found</p>
                      ) : (
                        <div className="space-y-2">
                          {users.map(u => (
                            <div
                              key={u.id}
                              onClick={() => fetchUserActivity(u)}
                              className="flex items-center gap-4 p-3.5 rounded-xl border border-white/10 hover:border-[#FFC000]/30 hover:bg-white/5 transition-all cursor-pointer group"
                            >
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFC000]/30 to-[#FFC000]/10 border border-[#FFC000]/20 flex items-center justify-center text-sm font-black text-[#FFC000] shrink-0">
                                {u.name?.charAt(0)?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-white truncate group-hover:text-[#FFC000] transition-colors">{u.name}</p>
                                  {u.role === 'admin' && <span className="px-1.5 py-0.5 bg-[#FFC000]/20 text-[#FFC000] text-[8px] font-black rounded uppercase tracking-wider border border-[#FFC000]/20">Admin</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-[10px] text-slate-500 flex items-center gap-1"><DollarSign className="h-3 w-3" />₹{u.total_earnings || 0}</span>
                                  <span className="text-[10px] text-slate-500 flex items-center gap-1"><Briefcase className="h-3 w-3" />{u.listings_count || 0} sold</span>
                                  <span className="text-[10px] text-slate-500 flex items-center gap-1"><ShoppingCartIcon className="h-3 w-3" />{u.buy_count || 0} bought</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                <select
                                  value={u.role}
                                  onChange={e => doAction(`/api/admin/users/${u.id}/role`, 'PATCH', { role: e.target.value })}
                                  className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-slate-300 focus:outline-none"
                                >
                                  <option value="user">User</option>
                                  <option value="admin">Admin</option>
                                </select>
                                {u.status === 'active' ? (
                                  <button onClick={() => { if (confirm(`Block ${u.name}?`)) doAction(`/api/admin/users/${u.id}/status`, 'PATCH', { status: 'blocked' }); }} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors">Block</button>
                                ) : (
                                  <button onClick={() => doAction(`/api/admin/users/${u.id}/status`, 'PATCH', { status: 'active' })} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors">Unblock</button>
                                )}
                                <div className="flex flex-col items-center">
                                  <input
                                    key={u.monthly_upload_limit}
                                    type="number"
                                    min="0"
                                    defaultValue={u.monthly_upload_limit ?? 10}
                                    onBlur={e => {
                                      const val = parseInt(e.target.value);
                                      if (!isNaN(val) && val !== u.monthly_upload_limit) {
                                        doAction(`/api/admin/users/${u.id}/upload-limit`, 'PATCH', { limit: val });
                                      }
                                    }}
                                    onClick={e => e.stopPropagation()}
                                    className="w-12 text-[10px] bg-white/5 border border-white/10 rounded px-1 py-0.5 text-white focus:outline-none"
                                    title="Monthly upload limit"
                                  />
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-[#FFC000] transition-colors shrink-0" />
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* ══ ORDERS ════════════════════════════════════════════════ */}
              {tab === 'orders' && (
                <AnimatePresence mode="wait">
                  {selectedOrder ? (
                    <DetailPanel
                      key="order-detail"
                      title={`Order #${selectedOrder.id?.slice(0, 8).toUpperCase()}`}
                      subtitle={`Placed by ${selectedOrder.buyer_name}`}
                      onBack={() => setSelectedOrder(null)}
                    >
                      <div className="grid md:grid-cols-2 gap-5 mb-5">
                        {/* Buyer info */}
                        <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-4">Buyer Details</p>
                          <InfoRow icon={<UserIcon className="h-3.5 w-3.5" />} label="Name" value={selectedOrder.buyer_name} />
                          <InfoRow icon={<Hash className="h-3.5 w-3.5" />} label="Email" value={selectedOrder.buyer_email} />
                          <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Placed" value={new Date(selectedOrder.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })} />
                          {selectedOrder.delivery_details && <InfoRow icon={<Truck className="h-3.5 w-3.5" />} label="Delivery" value={selectedOrder.delivery_details} />}
                          {selectedOrder.collection_date && <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label="Collection Date" value={selectedOrder.collection_date} />}
                        </div>

                        {/* Order summary */}
                        <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-4">Order Summary</p>
                          <InfoRow icon={<DollarSign className="h-3.5 w-3.5" />} label="Total Amount" value={<span className="text-[#FFC000] font-black text-base">₹{selectedOrder.total_amount}</span>} />
                          <InfoRow icon={<DollarSign className="h-3.5 w-3.5" />} label="Platform Fee" value={selectedOrder.platform_fee === 0 ? '₹0 (Waived)' : `₹${selectedOrder.platform_fee}`} />
                          <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="Status" value={
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${statusColors[selectedOrder.status] || 'bg-white/10 text-white'}`}>
                                {fmt(selectedOrder.status)}
                              </span>
                              <select
                                value={selectedOrder.status}
                                onChange={e => doAction(`/api/admin/orders/${selectedOrder.id}/status`, 'PATCH', { status: e.target.value })}
                                className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-slate-300 focus:outline-none"
                              >
                                {['pending_payment', 'paid', 'shipped', 'delivered', 'buyer_confirmed', 'completed', 'cancelled'].map(s => (
                                  <option key={s} value={s}>{fmt(s)}</option>
                                ))}
                              </select>
                            </div>
                          } />
                          {selectedOrder.status === 'buyer_confirmed' && (
                            <div className="mt-4">
                              <button
                                onClick={() => { if (confirm('Release funds to seller(s)?')) doAction(`/api/admin/orders/${selectedOrder.id}/release-funds`, 'POST'); }}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-[#FFC000] hover:bg-[#e6ac00] text-slate-900 rounded-xl font-black text-sm transition-all shadow-lg shadow-[#FFC000]/20"
                              >
                                <DollarSign className="h-4 w-4" /> Release Funds to Seller
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Items */}
                      <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-4">Items ({selectedOrder.items?.length || 0})</p>
                        <div className="space-y-3">
                          {selectedOrder.items?.map((item: any) => (
                            <div key={item.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                              <img src={item.image_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate">{item.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {item.course_code} · {item.seller_name} · Qty {item.quantity}
                                </p>
                              </div>
                              <p className="text-sm font-black text-[#FFC000] shrink-0">₹{item.price_at_purchase * item.quantity}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </DetailPanel>
                  ) : (
                    <motion.div key="order-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {orders.length === 0 ? (
                        <p className="text-center py-16 text-slate-500 text-sm">No orders found</p>
                      ) : (
                        <div className="space-y-2">
                          {orders.map(o => (
                            <div
                              key={o.id}
                              onClick={() => setSelectedOrder(o)}
                              className="flex items-center gap-4 p-3.5 rounded-xl border border-white/10 hover:border-[#FFC000]/30 hover:bg-white/5 transition-all cursor-pointer group"
                            >
                              {/* Item thumbnails */}
                              <div className="relative shrink-0 w-12 h-12">
                                <div className="w-full h-full rounded-xl overflow-hidden border border-white/10">
                                  {o.items?.[0] && <img src={o.items[0].image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />}
                                </div>
                                {(o.items?.length || 0) > 1 && (
                                  <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#FFC000] text-slate-900 text-[8px] font-black flex items-center justify-center border-2 border-slate-900">
                                    +{(o.items?.length || 0) - 1}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-[10px] font-mono text-slate-500">#{o.id?.slice(0, 8).toUpperCase()}</p>
                                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${statusColors[o.status] || 'bg-white/10 text-white'}`}>
                                    {fmt(o.status)}
                                  </span>
                                </div>
                                <p className="text-sm font-bold text-white truncate group-hover:text-[#FFC000] transition-colors">{o.buyer_name}</p>
                                <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · {o.items?.map((i: any) => i.title).join(', ')}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-black text-[#FFC000]">₹{o.total_amount}</p>
                                <p className="text-[10px] text-slate-500">fee {o.platform_fee === 0 ? 'Waived' : `₹${o.platform_fee}`}</p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-[#FFC000] transition-colors shrink-0" />
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* ══ CHATS ════════════════════════════════════════════════ */}
              {tab === 'chats' && (
                <motion.div key="chats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {chats.length === 0 ? (
                    <p className="text-center py-16 text-slate-500 text-sm">No conversations found</p>
                  ) : (
                    <div className="space-y-2">
                      {chats.map(c => (
                        <div key={c.conversation_id} className="flex items-center gap-4 p-3.5 rounded-xl border border-white/10 hover:bg-white/5 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm font-bold text-white mb-1">
                              <span>{c.sender_name}</span>
                              <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                              <span>{c.receiver_name}</span>
                            </div>
                            <p className="text-xs text-[#FFC000]/80 font-medium truncate">{c.listing_title || 'General Chat'}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {new Date(c.last_message_at).toLocaleString()}
                            </p>
                          </div>
                          <button
                            onClick={() => fetchTranscript(c.conversation_id)}
                            className="shrink-0 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all"
                          >
                            View Transcript
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ══ SETTINGS ══════════════════════════════════════════════ */}
              {tab === 'settings' && dbSettings && (
                <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-[#FFC000]/10 rounded-xl text-[#FFC000]">
                        <DollarSign className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-white">Platform Settings</h3>
                        <p className="text-xs text-slate-500">Configure global platform parameters</p>
                      </div>
                    </div>

                    <div className="max-w-md space-y-4">
                      <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[#FFC000] mb-2">
                          Platform Fee Percentage (%)
                        </label>
                        <div className="flex gap-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={localFee}
                            onChange={(e) => setLocalFee(e.target.value)}
                            onBlur={async () => {
                              const val = Number(localFee);
                              if (!isNaN(val) && val >= 0 && val <= 100) {
                                try {
                                  const res = await apiRequest('/api/settings', { 
                                    method: 'PATCH', 
                                    body: JSON.stringify({ platform_fee_percentage: val }) 
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    setActionMsg(data.message || 'Updated');
                                    fetchData();
                                  } else {
                                    const data = await res.json();
                                    setActionMsg(data.error || 'Update failed');
                                    setLocalFee(String(dbSettings.platform_fee_percentage));
                                  }
                                } catch {
                                  setActionMsg('Network error');
                                  setLocalFee(String(dbSettings.platform_fee_percentage));
                                }
                                setTimeout(() => setActionMsg(''), 3000);
                              } else {
                                setLocalFee(String(dbSettings.platform_fee_percentage));
                              }
                            }}
                            className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#FFC000]/50 flex-1"
                          />
                          <div className="flex items-center justify-center bg-white/5 border border-white/10 rounded-xl px-4 font-black text-slate-400">
                            %
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                          This fee is charged to the seller on every transaction. Setting this to 0 will enable Launch Promo mode (0% fees).
                        </p>
                      </div>

                      <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">
                          Recommended Discount (%)
                        </label>
                        <div className="flex gap-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={localDiscount}
                            onChange={(e) => setLocalDiscount(e.target.value)}
                            onBlur={async () => {
                              const val = Number(localDiscount);
                              if (!isNaN(val) && val >= 0 && val <= 100) {
                                try {
                                  const res = await apiRequest('/api/settings', { 
                                    method: 'PATCH', 
                                    body: JSON.stringify({ recommended_discount_percentage: val }) 
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    setActionMsg(data.message || 'Updated discount');
                                    fetchData();
                                  } else {
                                    const data = await res.json();
                                    setActionMsg(data.error || 'Update failed');
                                    setLocalDiscount(String(dbSettings.recommended_discount_percentage || 40));
                                  }
                                } catch {
                                  setActionMsg('Network error');
                                  setLocalDiscount(String(dbSettings.recommended_discount_percentage || 40));
                                }
                                setTimeout(() => setActionMsg(''), 3000);
                              } else {
                                setLocalDiscount(String(dbSettings.recommended_discount_percentage || 40));
                              }
                            }}
                            className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 flex-1"
                          />
                          <div className="flex items-center justify-center bg-white/5 border border-white/10 rounded-xl px-4 font-black text-slate-400">
                            %
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                          Global discount percentage recommended to users when setting final prices based on original cost.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                    <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" /> Note on Caching
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Settings are cached for 30 seconds to optimize performance. Changes may take up to half a minute to reflect across all users globally.
                    </p>
                  </div>

                  {/* ── Telegram Broadcast ── */}
                  <div className="p-6 bg-violet-500/5 border border-violet-500/20 rounded-2xl space-y-4">
                    <h4 className="text-xs font-black text-violet-400 uppercase tracking-widest flex items-center gap-2">
                      <SendIcon className="h-3.5 w-3.5" /> Telegram Broadcast
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed -mt-2">
                      Send an announcement to all users who have connected their Telegram account.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Title (optional)</label>
                        <input
                          type="text"
                          value={broadcastTitle}
                          onChange={e => setBroadcastTitle(e.target.value)}
                          placeholder="e.g. 🚀 New Feature Released!"
                          className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Message <span className="text-red-400">*</span></label>
                        <textarea
                          value={broadcastMsg}
                          onChange={e => setBroadcastMsg(e.target.value)}
                          placeholder="Write your announcement here…"
                          rows={3}
                          className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Link URL (optional)</label>
                        <input
                          type="url"
                          value={broadcastLink}
                          onChange={e => setBroadcastLink(e.target.value)}
                          placeholder="https://opennotes.in/..."
                          className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                      </div>
                      {broadcastResult && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-400">
                          ✅ Sent to <strong>{broadcastResult.sent}</strong> users ({broadcastResult.failed} failed, {broadcastResult.total} total).
                        </div>
                      )}
                      <button
                        disabled={!broadcastMsg.trim() || broadcastSending}
                        onClick={async () => {
                          if (!broadcastMsg.trim()) return;
                          setBroadcastSending(true);
                          setBroadcastResult(null);
                          try {
                            const res = await apiRequest('/api/admin/broadcast', {
                              method: 'POST',
                              body: JSON.stringify({
                                title: broadcastTitle.trim() || undefined,
                                message: broadcastMsg.trim(),
                                link_url: broadcastLink.trim() || undefined,
                              }),
                            });
                            const data = await res.json();
                            if (res.ok) {
                              setBroadcastResult(data);
                              setBroadcastMsg('');
                              setBroadcastTitle('');
                              setBroadcastLink('');
                            } else {
                              setActionMsg(data.error || 'Broadcast failed');
                            }
                          } catch {
                            setActionMsg('Network error during broadcast');
                          } finally {
                            setBroadcastSending(false);
                          }
                        }}
                        className="flex items-center gap-2 px-5 py-3 bg-violet-500/20 hover:bg-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed border border-violet-500/30 text-violet-300 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                      >
                        {broadcastSending ? (
                          <><span className="h-3.5 w-3.5 border-2 border-violet-400 border-t-transparent animate-spin rounded-full" /> Sending…</>
                        ) : (
                          <><SendIcon className="h-3.5 w-3.5" /> Send Broadcast</>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Chat Transcript Modal ── */}
      <AnimatePresence>
        {selectedChatId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
            onClick={() => setSelectedChatId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.18 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                <h3 className="font-black text-white">Chat Transcript</h3>
                <button onClick={() => setSelectedChatId(null)} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6 h-[420px] overflow-y-auto space-y-4">
                {loadingTranscript ? (
                  <div className="flex justify-center py-12">
                    <span className="h-6 w-6 border-2 border-[#FFC000] border-t-transparent animate-spin rounded-full" />
                  </div>
                ) : transcript.length === 0 ? (
                  <p className="text-center text-slate-500 text-sm py-12">No messages in this conversation</p>
                ) : (
                  transcript.map(m => (
                    <div key={m.id}>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs font-bold text-[#FFC000]">{m.sender_name}</span>
                        <span className="text-[10px] text-slate-500">{new Date(m.created_at).toLocaleString()}</span>
                      </div>
                      <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-sm text-slate-300">
                        {m.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex justify-end">
                <button onClick={() => setSelectedChatId(null)} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-colors">
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Purge Confirmation Modal ── */}
      <AnimatePresence>
        {showPurgeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-red-950/80 backdrop-blur-md"
            onClick={() => { setShowPurgeModal(false); setPurgeConfirm(''); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-red-500/30"
            >
              <div className="p-8">
                <div className="w-14 h-14 bg-red-500/20 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <AlertTriangle className="h-7 w-7 text-red-400" />
                </div>
                <h3 className="text-xl font-black text-white text-center mb-2">Are you absolutely sure?</h3>
                <p className="text-sm text-slate-400 text-center mb-7 leading-relaxed">
                  This permanently deletes all listings, orders, messages, and notifications. User accounts are preserved.
                </p>
                <div className="mb-6">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                    Type <span className="text-red-400">PURGE</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={purgeConfirm}
                    onChange={e => setPurgeConfirm(e.target.value)}
                    placeholder="PURGE"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-center font-black tracking-[0.4em] text-red-400 uppercase focus:outline-none focus:ring-2 focus:ring-red-500/30 placeholder:text-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <button
                    onClick={handlePurge}
                    disabled={purgeConfirm !== 'PURGE'}
                    className="w-full py-3.5 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed border border-red-500/30 text-red-400 rounded-xl font-black text-sm transition-all active:scale-[0.98]"
                  >
                    Confirm Permanent Delete
                  </button>
                  <button
                    onClick={() => { setShowPurgeModal(false); setPurgeConfirm(''); }}
                    className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl font-bold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};