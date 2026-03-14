import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package, DollarSign, Settings,
  Clock, MapPin, Edit3, Eye,
  TrendingUp, Star, MessageCircle,
  AlertCircle, Users, Check, X,
  ChevronRight, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { apiRequest } from '../utils/api.js';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { statusColors, formatStatus } from '../utils/status';
import { formatSemester } from '../utils/formatters';
import { View, Listing, Order, OrderItem } from '../types';


type ProfileTab = 'listings' | 'earnings' | 'settings';



interface SalesData {
  sales: (OrderItem & {
    order_status: string;
    order_date: string;
    buyer_id: string;
    delivery_details?: string;
    collection_date?: string;
    buyer_name: string;
    buyer_email: string;
    listing_price: number;
  })[];
  summary: {
    totalEarnings: number;
    platformFeeTotal: number;
    netEarnings: number;
    totalSales: number;
  };
}



// ── Small reusable pieces ─────────────────────────────────────────

const inputClass =
  'w-full px-4 py-3 bg-surface/80 border border-border rounded-xl text-sm font-medium text-text-main placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all';

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">{children}</p>
);

const StatCard: React.FC<{
  label: string;
  value: string | number;
  color: 'emerald' | 'blue' | 'slate';
}> = ({ label, value, color }) => {
  const styles = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
    slate: 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400',
  };
  return (
    <div className={`rounded-2xl p-5 border ${styles[color]}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2">{label}</p>
      <p className="text-2xl font-black">₹{value}</p>
    </div>
  );
};

const BuggyButton = () => {
  const [shouldCrash, setShouldCrash] = React.useState(false);
  if (shouldCrash) throw new Error('Test crash triggered from settings');
  return (
    <button
      onClick={() => setShouldCrash(true)}
      className="px-6 py-3 bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white border border-red-600/20 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
    >
      Trigger Test Crash
    </button>
  );
};

export const ProfileView = ({
  onContactSeller,
  initialTab = 'listings',
}: {
  onContactSeller?: (sellerId: string, listingId: string, listingTitle: string) => void;
  initialTab?: ProfileTab;
  key?: React.Key;
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  
  // Sync tab if prop changes externally (e.g. from navbar click)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);

  // Settings
  const [editName, setEditName] = useState(user?.name || '');
  const [editUpi, setEditUpi] = useState(user?.upi_id || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // PIN verification
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const [pinErrors, setPinErrors] = useState<Record<string, string>>({});
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);

  // Review modal
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [reviewItem, setReviewItem] = useState<OrderItem | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Detail modal
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      apiRequest('/api/listings/me').then(r => r.json()),
      apiRequest('/api/orders/my-sales').then(r => r.json()),
    ])
      .then(([listingsData, sales]) => {
        if (Array.isArray(listingsData)) setListings(listingsData);
        setSalesData(sales);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const handleInstallApp = async () => {
    const prompt = (window as any).deferredPrompt;
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        (window as any).deferredPrompt = null;
      }
    } else {
      toast("To install on mobile, use your browser menu and select 'Add to Home Screen'.", {
        duration: 5000,
        icon: '📱'
      });
    }
  };

  const handleProfileUpdate = async () => {
    try {
      const res = await apiRequest('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({ name: editName, upi_id: editUpi }),
      });
      const data = await res.json();
      res.ok ? toast.success('Profile updated!') : toast.error(data.error || 'Update failed');
    } catch { toast.error('Network error'); }
  };

  const handlePasswordChange = async () => {
    try {
      const res = await apiRequest('/api/users/me/password', {
        method: 'PUT',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Password changed!');
        setCurrentPassword(''); setNewPassword('');
      } else { toast.error(data.error || 'Change failed'); }
    } catch { toast.error('Network error'); }
  };

  const handleVerifyPin = async (itemId: string) => {
    if (!user) return;
    const pin = pinInputs[itemId];
    if (!pin || pin.length !== 4) {
      setPinErrors(p => ({ ...p, [itemId]: 'Please enter a 4-digit PIN' }));
      return;
    }
    setVerifyingOrderId(itemId);
    setPinErrors(p => ({ ...p, [itemId]: '' }));
    try {
      const res = await apiRequest(`/api/orders/items/${itemId}/verify-pin`, {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.orderCompleted
          ? 'All items exchanged! Order fully completed.'
          : 'Item verified! Waiting for remaining items.');
        setPinInputs(p => { const n = { ...p }; delete n[itemId]; return n; });
        setPinErrors(p => { const n = { ...p }; delete n[itemId]; return n; });
        const sRes = await apiRequest('/api/orders/my-sales');
        const sData = await sRes.json();
        if (sRes.ok) setSalesData(sData);
      } else {
        setPinErrors(p => ({ ...p, [itemId]: data.error || 'Invalid PIN' }));
        toast.error(data.error || 'Invalid PIN');
      }
    } catch {
      setPinErrors(p => ({ ...p, [itemId]: 'Network error' }));
    } finally {
      setVerifyingOrderId(null);
    }
  };

  const handleLeaveReview = async () => {
    if (!reviewOrder || !reviewItem || submittingReview) return;
    setSubmittingReview(true);
    try {
      const res = await apiRequest('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          seller_id: reviewItem.seller_id,
          order_id: reviewOrder.id,
          listing_id: reviewItem.listing_id,
          rating,
          comment: reviewComment,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Review submitted!');
        setReviewOrder(null); setReviewItem(null);
        setReviewComment(''); setRating(5);
      } else { toast.error(data.error || 'Failed to submit review'); }
    } catch { toast.error('Network error'); }
    setSubmittingReview(false);
  };

  const tabs: { id: ProfileTab; label: string; icon: React.ReactNode }[] = [
    { id: 'listings', label: 'My Listings', icon: <Package className="h-3.5 w-3.5" /> },
    { id: 'earnings', label: 'My Sales', icon: <DollarSign className="h-3.5 w-3.5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-3.5 w-3.5" /> },
  ];

  // Avatar initials
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24"
    >
      {/* ── Profile hero ── */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-[#003366] flex items-center justify-center text-white text-xl font-black shrink-0 shadow-md">
          {initials}
        </div>
        <div>
          <h1 className="text-xl font-black text-text-main tracking-tight leading-tight">{user?.name}</h1>
          <p className="text-xs text-text-muted font-medium mt-0.5">{user?.email}</p>
        </div>
      </div>

      {/* ── Tab nav ── */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${activeTab === tab.id
                ? 'bg-[#003366] text-white shadow-md shadow-[#003366]/20 border border-transparent'
                : 'bg-surface text-text-muted border border-border hover:bg-background hover:bg-primary-hover'
              }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex justify-center py-24">
          <span className="h-8 w-8 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <AnimatePresence mode="wait">

          {/* ── My Listings ── */}
          {activeTab === 'listings' && (
            <motion.div key="listings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {listings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mb-4">
                    <Package className="h-8 w-8 text-slate-300 " />
                  </div>
                  <p className="font-black text-text-main mb-1">No listings yet</p>
                  <p className="text-sm text-text-muted">Items you sell will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {listings.map(listing => (
                    <button
                      key={listing.id}
                      onClick={() => setSelectedListing(listing)}
                      className="flex gap-4 p-4 bg-surface border border-border rounded-2xl hover:border-primary/30 dark:hover:border-primary/30 hover:shadow-md transition-all text-left group"
                    >
                      <div className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden">
                        <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                          <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-black text-text-main truncate group-hover:text-black dark:group-hover:text-primary transition-colors leading-tight">
                              {listing.title}
                            </p>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase shrink-0 ${statusColors[listing.status] || 'bg-surface text-text-muted'}`}>
                              {formatStatus(listing.status)}
                            </span>
                          </div>
                          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide truncate">{listing.course_code}</p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-base font-black text-primary">₹{listing.price}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${listing.quantity > 0
                              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                              : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                            }`}>
                            {listing.quantity > 0 ? `${listing.quantity} left` : 'Sold out'}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── My Sales ── */}
          {activeTab === 'earnings' && (
            <motion.div key="earnings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              {!salesData || salesData.summary.totalSales === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mb-4">
                    <TrendingUp className="h-8 w-8 text-slate-300 " />
                  </div>
                  <p className="font-black text-text-main mb-1">No sales yet</p>
                  <p className="text-sm text-text-muted">Your earnings will appear here once buyers place orders.</p>
                </div>
              ) : (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <StatCard label="Net Income" value={salesData.summary.netEarnings} color="emerald" />
                    <StatCard label="Total Sales" value={salesData.summary.totalEarnings} color="blue" />
                    <StatCard label="Platform Fees" value={salesData.summary.platformFeeTotal} color="slate" />
                  </div>

                  {/* Seller "Next Steps" Guide */}
                  <div className="bg-[#003366]/5 border border-[#003366]/20 rounded-2xl p-5 overflow-hidden relative">
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#003366]/5 rounded-full blur-2xl pointer-events-none" />
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-[#003366] rounded-xl shadow-lg shadow-[#003366]/20">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                      <h3 className="text-sm font-black text-[#003366] dark:text-blue-400 uppercase tracking-widest">Sold! What's next?</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-[#003366]/60 dark:text-blue-400/60 uppercase">Step 1</p>
                        <p className="text-xs font-bold text-text-main">Coordinate via Chat</p>
                        <p className="text-[10px] text-text-muted leading-relaxed">Message the buyer to fix a meetup time at your specified campus location.</p>
                      </div>
                      <div className="space-y-1.5 border-t sm:border-t-0 sm:border-l border-[#003366]/10 pt-3 sm:pt-0 sm:pl-4">
                        <p className="text-[10px] font-black text-[#003366]/60 dark:text-blue-400/60 uppercase">Step 2</p>
                        <p className="text-xs font-bold text-text-main">Verify the PIN</p>
                        <p className="text-[10px] text-text-muted leading-relaxed">In person, ask the buyer for their 4-digit PIN and enter it below to confirm handover.</p>
                      </div>
                      <div className="space-y-1.5 border-t sm:border-t-0 sm:border-l border-[#003366]/10 pt-3 sm:pt-0 sm:pl-4">
                        <p className="text-[10px] font-black text-[#003366]/60 dark:text-blue-400/60 uppercase">Step 3</p>
                        <p className="text-xs font-bold text-text-main">Collect your Cash</p>
                        <p className="text-[10px] text-text-muted leading-relaxed">Once the PIN is verified, collect the full notes price in cash directly from the buyer.</p>
                      </div>
                    </div>
                  </div>

                  {/* Transaction list */}
                  <div>
                    <p className="text-xs font-black text-text-muted uppercase tracking-widest mb-3">Transaction History</p>
                    <div className="space-y-2">
                      {salesData.sales.map((sale: any) => (
                        <div key={sale.id}>
                          {/* Sale row */}
                          <div
                            onClick={() => setSelectedSale(sale)}
                            className="flex items-center gap-3 p-4 bg-surface border border-border rounded-2xl cursor-pointer hover:border-primary/30 dark:hover:border-primary/30 hover:shadow-sm transition-all group"
                          >
                            <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                              <img src={sale.image_url} alt={sale.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-text-main truncate group-hover:text-black dark:group-hover:text-primary transition-colors">
                                {sale.title}
                              </p>
                              <p className="text-[10px] text-text-muted font-semibold truncate mt-0.5">
                                {sale.buyer_name} · Qty {sale.quantity}
                              </p>
                              {/* Logistics mini-info */}
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                {sale.delivery_details && (
                                  <span className="text-[9px] text-text-muted flex items-center gap-1">
                                    <Package className="h-2.5 w-2.5" /> {sale.delivery_details}
                                  </span>
                                )}
                                {sale.collection_date && (
                                  <span className="text-[9px] text-text-muted flex items-center gap-1">
                                    <Clock className="h-2.5 w-2.5" /> {sale.collection_date}
                                  </span>
                                )}
                                {sale.meetup_location && (
                                  <span className="text-[9px] text-primary font-semibold flex items-center gap-1">
                                    <MapPin className="h-2.5 w-2.5" /> {sale.meetup_location}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                sale.status === 'delivered' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
                                  sale.status === 'shipped' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                                    sale.status === 'pending_meetup' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' :
                                      'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                }`}>
                                {sale.status === 'pending_meetup' ? 'Arrange Meetup' : sale.status?.replace('_', ' ')}
                              </span>
                              <span className="text-sm font-black text-primary text-primary">
                                +₹{sale.price_at_purchase * sale.quantity}
                              </span>
                              <button
                                onClick={e => { e.stopPropagation(); onContactSeller?.(sale.buyer_id, sale.listing_id, sale.title); }}
                                className="p-1.5 bg-surface hover:bg-primary dark:hover:bg-primary text-text-muted hover:text-white dark:hover:text-black rounded-lg transition-all"
                                title="Message Buyer"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* PIN verification — pending meetup */}
                          {sale.status === 'pending_meetup' && (
                            <div className="mt-2 p-4 bg-primary/5 border-2 border-primary/20 rounded-xl flex flex-col sm:flex-row items-center gap-3">
                              <div className="flex-1 w-full relative">
                                <label className="block text-xs font-black text-primary uppercase tracking-widest mb-1.5 ml-1">
                                  Verify Buyer's PIN
                                </label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="Enter 4-digit PIN"
                                  maxLength={4}
                                  value={pinInputs[sale.id] || ''}
                                  onChange={e => setPinInputs(p => ({ ...p, [sale.id]: e.target.value.replace(/\D/g, '') }))}
                                  className={`w-full text-center text-lg font-black tracking-[0.4em] px-4 py-3 bg-surface border-2 rounded-xl outline-none transition-all placeholder:text-sm placeholder:tracking-normal placeholder:font-normal text-text-main ${pinErrors[sale.id]
                                      ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/20'
                                      : 'border-border focus:border-primary focus:ring-4 focus:ring-primary/20'
                                    }`}
                                />
                                {pinErrors[sale.id] && (
                                  <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">{pinErrors[sale.id]}</p>
                                )}
                              </div>
                              <button
                                onClick={() => handleVerifyPin(sale.id)}
                                disabled={verifyingOrderId === sale.id || (pinInputs[sale.id]?.length !== 4)}
                                className="w-full sm:w-auto mt-2 sm:mt-6 px-6 py-3 bg-primary hover:bg-primary-hover text-primary-foreground font-black text-sm uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0 shadow-sm"
                              >
                                {verifyingOrderId === sale.id ? (
                                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                                Verify
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ── Settings ── */}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-2xl">

              {/* Profile preferences */}
              <div className="bg-surface border border-border rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-accent rounded-xl">
                    <Edit3 className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-black text-text-main uppercase tracking-wider">Profile Preferences</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                  <div>
                    <Label>Display Name</Label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <Label>UPI ID for Payouts</Label>
                    <input type="text" value={editUpi} onChange={e => setEditUpi(e.target.value)} placeholder="username@upi" className={inputClass} />
                  </div>
                </div>
                <button
                  onClick={handleProfileUpdate}
                  className="px-6 py-3 bg-[#003366] hover:bg-[#002244] text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-sm"
                >
                  Update Profile
                </button>
              </div>

              {/* Security */}
              <div className="bg-surface border border-border rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-surface dark:bg-red-950/30 rounded-xl">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-black text-text-main uppercase tracking-wider">Security & Privacy</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                  <div>
                    <Label>Current Password</Label>
                    <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <Label>New Password</Label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <button
                  onClick={handlePasswordChange}
                  className="px-6 py-3 bg-surface  hover:bg-primary text-text-main hover:text-primary-foreground rounded-xl font-black text-xs uppercase tracking-wider transition-all"
                >
                  Change Password
                </button>
              </div>

              {/* PWA Install */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-primary rounded-xl">
                    <Package className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <h3 className="text-sm font-black text-text-main uppercase tracking-wider">Install App</h3>
                </div>
                <p className="text-xs text-text-muted mb-5 leading-relaxed">
                  Install OpenNotes on your home screen for a better experience, offline access, and faster notifications.
                </p>
                <button
                  onClick={handleInstallApp}
                  className="px-6 py-3 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md"
                >
                  Add to Home Screen
                </button>
              </div>

              {/* Account info */}
              <div className="p-5 bg-surface/50 border border-border rounded-2xl">
                <p className="text-[10px] text-text-muted font-mono mt-1">{user?.id}</p>
              </div>

              {/* Debug Tools */}
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-red-500/10 rounded-xl">
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                  </div>
                  <h3 className="text-sm font-black text-red-500 uppercase tracking-wider">Developer Debug Tools</h3>
                </div>
                <p className="text-xs text-text-muted mb-5 leading-relaxed">
                  Use this to verify the Global Error Boundary is working. This will force the application to crash and show the fallback UI.
                </p>
                <BuggyButton />
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      )}

      {/* ── Review Modal ── */}
      <AnimatePresence>
        {reviewOrder && reviewItem && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="bg-surface rounded-t-3xl sm:rounded-2xl w-full max-w-lg p-6 sm:p-8 shadow-2xl"
            >
              {/* Mobile drag handle */}
              <div className="w-10 h-1 bg-surface  rounded-full mx-auto mb-6 sm:hidden" />

              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-xl font-black text-text-main">How was it?</h2>
                  <p className="text-xs text-text-muted mt-1 font-medium truncate max-w-xs">"{reviewItem.title}"</p>
                </div>
                <button
                  onClick={() => { setReviewOrder(null); setReviewItem(null); }}
                  className="p-2 rounded-xl hover:bg-primary-hover hover:bg-primary-hover text-text-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Star rating */}
              <div className="flex justify-center gap-3 mb-6">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="transition-transform active:scale-125 focus:outline-none"
                  >
                    <Star className={`h-9 w-9 transition-colors ${star <= rating ? 'fill-[#FFC000] text-[#FFC000]' : 'text-slate-200'}`} />
                  </button>
                ))}
              </div>

              <div className="mb-6">
                <Label>Your Experience</Label>
                <textarea
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  rows={3}
                  placeholder="Condition, communication, meeting point..."
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setReviewOrder(null); setReviewItem(null); }}
                  className="flex-1 py-3 bg-surface text-text-muted rounded-xl font-bold text-xs uppercase tracking-wider transition-all hover:bg-primary-hover hover:bg-primary-hover sm:hidden"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeaveReview}
                  disabled={submittingReview}
                  className="flex-[2] py-3 bg-[#003366] hover:bg-[#002244] text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                  {submittingReview && <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                  {submittingReview ? 'Sending...' : 'Post Review'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {(selectedListing || selectedSale) && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="bg-surface rounded-t-3xl sm:rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden"
            >
              {/* Image hero */}
              <div className="relative h-44 sm:h-56 shrink-0">
                <img
                  src={selectedListing?.image_url || selectedSale?.image_url}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <button
                  onClick={() => { setSelectedListing(null); setSelectedSale(null); }}
                  className="absolute top-4 right-4 p-2.5 bg-black/30 hover:bg-black/50 backdrop-blur-md rounded-xl text-white transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
                {/* Mobile drag handle */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-8 h-1 bg-surface/30 rounded-full sm:hidden" />
                <div className="absolute bottom-4 left-5 right-16">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2 py-0.5 bg-surface/15 backdrop-blur-md text-white text-[9px] font-black uppercase rounded-full border border-white/20">
                      {formatStatus(selectedListing?.status || selectedSale?.status)}
                    </span>
                    <span className="text-[9px] font-black text-white/70 bg-surface/10 backdrop-blur-sm px-2 py-0.5 rounded-full">
                      {selectedListing?.course_code || selectedSale?.course_code}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white leading-tight line-clamp-2">
                    {selectedListing?.title || selectedSale?.title}
                  </h2>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">

                {/* Buyer info — sale view */}
                {selectedSale && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-accent border border-accent rounded-xl">
                      <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Users className="h-3 w-3" /> Buyer
                      </p>
                      <p className="text-sm font-bold text-text-main">{selectedSale.buyer_name}</p>
                      <p className="text-[10px] text-text-muted truncate mt-0.5">{selectedSale.buyer_email}</p>
                    </div>
                    <div className="p-4 bg-surface/50 border border-border rounded-xl">
                      <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Sale Date
                      </p>
                      <p className="text-sm font-bold text-text-main">
                        {new Date(selectedSale.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}

                {/* Logistics */}
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Logistics & Location</p>
                  <div className="bg-surface/50 border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-surface border border-border rounded-lg shrink-0">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-0.5">Location</p>
                        <p className="text-sm font-bold text-text-main italic">
                          "{selectedListing?.location || selectedSale?.location || 'Not specified'}"
                        </p>
                      </div>
                    </div>
                    {(selectedListing?.meetup_location || selectedSale?.meetup_location) && (
                      <div className="flex items-start gap-3 pt-3 border-t border-border">
                        <div className="p-2 bg-surface dark:bg-amber-950/30 border border-border rounded-lg shrink-0">
                          <Eye className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-primary text-primary uppercase tracking-widest mb-0.5">Hand-over Instructions</p>
                          <p className="text-sm font-bold text-text-main italic leading-snug">
                            "{selectedListing?.meetup_location || selectedSale?.meetup_location}"
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Price', value: `₹${selectedListing?.price || selectedSale?.price_at_purchase}` },
                    { label: 'Stock', value: `${selectedListing?.quantity || selectedSale?.quantity} unit${(selectedListing?.quantity || selectedSale?.quantity) > 1 ? 's' : ''}` },
                    { label: 'Semester', value: selectedListing?.semester ? formatSemester(selectedListing.semester) : 'N/A' },
                    { label: 'Condition', value: selectedListing?.condition || 'Good' },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 bg-surface/50 border border-border rounded-xl">
                      <p className="text-[8px] font-black text-text-muted uppercase mb-1">{label}</p>
                      <p className="text-xs font-black text-text-main">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Sales history for a listing */}
                {selectedListing && salesData?.sales.some((s: any) => s.listing_id === selectedListing.id) && (
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Sales History</p>
                    <div className="space-y-2">
                      {salesData.sales
                        .filter((s: any) => s.listing_id === selectedListing.id)
                        .map((sale: any) => (
                          <div key={sale.id} className="flex items-center justify-between gap-3 p-4 bg-surface/50 border border-border rounded-xl">
                            <div>
                              <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1 flex items-center gap-1">
                                <Users className="h-3 w-3" /> {sale.buyer_name}
                              </p>
                              {sale.delivery_details && <p className="text-[9px] text-text-muted">Ship: {sale.delivery_details}</p>}
                              {sale.collection_date && <p className="text-[9px] text-text-muted">Date: {sale.collection_date}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[9px] text-text-muted mb-1">
                                {new Date(sale.order_date).toLocaleDateString()}
                              </p>
                              <p className="text-sm font-black text-primary text-primary">
                                ₹{sale.price_at_purchase * sale.quantity}
                              </p>
                              <span className="text-[8px] font-black text-text-muted bg-surface  px-1.5 py-0.5 rounded mt-1 inline-block">
                                Qty {sale.quantity}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Close bar */}
              <div className="p-4 sm:p-5 bg-background/50 border-t border-border shrink-0">
                <button
                  onClick={() => { setSelectedListing(null); setSelectedSale(null); }}
                  className="w-full py-3 bg-surface hover:bg-primary text-text-main hover:text-primary-foreground rounded-xl font-black text-xs uppercase tracking-wider transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};