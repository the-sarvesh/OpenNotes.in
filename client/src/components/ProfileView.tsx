import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package, DollarSign, Settings,
  Clock, MapPin, Edit3, Eye,
  TrendingUp, Star, MessageCircle,
  AlertCircle, Users, Check, X,
  ChevronRight, ShieldAlert, LayoutDashboard,
  PlusCircle, ShoppingBag, CheckCircle2, Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { apiRequest } from '../utils/api.js';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { TelegramConnect } from '../components/TelegramConnect';
import { statusColors, formatStatus } from '../utils/status';
import { formatSemester } from '../utils/formatters';
import { View, Listing, Order, OrderItem } from '../types';


type ProfileTab = 'overview' | 'listings' | 'earnings' | 'settings';



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
  icon: React.ReactNode;
  color: 'emerald' | 'blue' | 'amber' | 'primary';
}> = ({ label, value, icon, color }) => {
  const styles = {
    emerald: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-500/5 border-blue-500/20 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400',
    primary: 'bg-primary/5 border-primary/20 text-primary',
  };

  return (
    <div className={`rounded-3xl p-6 border transition-all hover:shadow-md ${styles[color]}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-white dark:bg-black/20 shadow-sm">
          {icon}
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{label}</p>
      </div>
      <p className="text-3xl font-black text-text-main tracking-tight">{value}</p>
    </div>
  );
};

const QuickAction: React.FC<{
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}> = ({ label, description, icon, onClick, primary }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-4 p-5 rounded-[2rem] border transition-all text-left active:scale-[0.98] ${primary
        ? 'bg-primary border-transparent text-black shadow-lg shadow-primary/20 hover:bg-primary-hover'
        : 'bg-surface border-border text-text-main hover:bg-background hover:border-primary/30'
      }`}
  >
    <div className={`p-3.5 rounded-2xl ${primary ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-black uppercase tracking-wider leading-none mb-1">{label}</p>
      <p className={`text-[11px] font-medium ${primary ? 'text-black/70' : 'text-text-muted'} line-clamp-1`}>{description}</p>
    </div>
    <ChevronRight className={`h-5 w-5 ${primary ? 'text-black/40' : 'text-text-muted/40'}`} />
  </button>
);

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
  initialTab = 'overview',
}: {
  onContactSeller?: (sellerId: string, listingId: string, listingTitle: string) => void;
  initialTab?: ProfileTab;
  key?: React.Key;
}) => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);

  // Sync tab if prop changes or location state changes (e.g. from navbar or chat)
  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab as ProfileTab);
    } else {
      setActiveTab(initialTab);
    }
  }, [initialTab, location.state]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);

  // Settings
  const [editName, setEditName] = useState(user?.name || '');
  const [editUpi, setEditUpi] = useState(user?.upi_id || '');
  const [editMobile, setEditMobile] = useState(user?.mobile_number || '');
  const [editLocation, setEditLocation] = useState(user?.location || '');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState(user?.profile_image_url || '');
  const [currentPassword, setCurrentPassword] = useState('');

  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditUpi(user.upi_id || '');
      setEditMobile(user.mobile_number || '');
      setEditLocation(user.location || '');
      setProfileImagePreview(user.profile_image_url || '');
    }
  }, [user]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);


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
      const formData = new FormData();
      formData.append('name', editName);
      formData.append('upi_id', editUpi);
      formData.append('mobile_number', editMobile);
      formData.append('location', editLocation);
      if (profileImage) {
        formData.append('profile_image', profileImage);
      }

      const res = await apiRequest('/api/users/me', {
        method: 'PUT',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Profile updated!');
        await refreshUser();
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch { toast.error('Network error'); }
  };


  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSubmittingPassword(true);

    try {
      const res = await apiRequest('/api/users/me/password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: user?.has_password ? currentPassword : '',
          new_password: newPassword
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(user?.has_password ? 'Password updated!' : 'Password created!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        await refreshUser();
      } else {
        toast.error(data.error || 'Change failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmittingPassword(false);
    }
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
    { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
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
        <div className="relative group">
          <div className="w-16 h-16 rounded-2xl bg-[#003366] flex items-center justify-center text-white text-xl font-black shrink-0 shadow-md overflow-hidden">
            {profileImagePreview ? (
              <img src={profileImagePreview} alt={user?.name} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 cursor-pointer rounded-2xl transition-opacity">
            <Edit3 className="h-4 w-4" />
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setProfileImage(file);
                  setProfileImagePreview(URL.createObjectURL(file));
                }
              }}
            />
          </label>
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
          {/* ── Dashboard Overview ── */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  label="Net Earnings"
                  value={salesData?.summary.netEarnings || 0}
                  icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
                  color="emerald"
                />
                <StatCard
                  label="Active Listings"
                  value={listings.filter(l => l.status === 'active').length}
                  icon={<Package className="h-5 w-5 text-blue-600" />}
                  color="blue"
                />
                <StatCard
                  label="Total Views"
                  value={listings.reduce((acc, l) => acc + (Number((l as any).views) || 0), 0)}
                  icon={<Eye className="h-5 w-5 text-amber-600" />}
                  color="amber"
                />
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <QuickAction
                  label="List New Item"
                  description="Upload your study materials"
                  icon={<PlusCircle className="h-6 w-6" />}
                  onClick={() => navigate('/sell')}
                  primary
                />
                <QuickAction
                  label="View Messages"
                  description="Check your chat inbox"
                  icon={<MessageCircle className="h-6 w-6" />}
                  onClick={() => navigate('/messages')}
                />
              </div>

              {/* Recent Activity Mini-Card */}
              <div className="bg-surface border border-border rounded-[2.5rem] p-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-text-muted mb-6">Recent Sales Activity</h3>
                {!salesData || salesData.sales.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-background rounded-3xl flex items-center justify-center mx-auto mb-4 border border-border/50">
                      <ShoppingBag className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-sm font-bold text-text-muted">No recent sales to show</p>
                    <button onClick={() => navigate('/browse')} className="text-xs font-black text-primary uppercase mt-2 hover:underline">Browse Items</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {salesData.sales.slice(0, 3).map(sale => (
                      <div key={sale.id} className="flex items-center gap-4 p-4 bg-background rounded-2xl border border-border/50">
                        <img src={sale.image_url} className="w-12 h-12 rounded-xl object-cover" alt="" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-text-main truncate">{sale.title}</p>
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">Sold to {sale.buyer_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-text-main">{sale.listing_price === 0 ? 'FREE' : `₹${sale.listing_price}`}</p>
                          <p className="text-[9px] font-medium text-text-muted">{new Date(sale.order_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setActiveTab('earnings')} className="w-full py-3 text-xs font-black text-primary uppercase tracking-widest hover:bg-primary/5 rounded-xl transition-colors mt-2">
                      View All Sales
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── My Listings ── */}
          {activeTab === 'listings' && (
            <motion.div key="listings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {listings.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Total Listings</p>
                    <p className="text-2xl font-black text-text-main">{listings.length}</p>
                  </div>
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Views</p>
                    <p className="text-2xl font-black text-text-main">
                      {listings.reduce((acc, l) => acc + (Number((l as any).views) || 0), 0)}
                    </p>
                  </div>
                </div>
              )}

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
                          <div className="flex items-center gap-3">
                            <span className="text-base font-black text-primary">{listing.price === 0 ? 'FREE' : `₹${listing.price}`}</span>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-text-muted">
                              <Eye className="h-3 w-3" /> {(listing as any).views || 0}
                            </span>
                          </div>
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
                    <StatCard label="Net Income" value={salesData.summary.netEarnings} color="emerald" icon={<DollarSign className="h-5 w-5" />} />
                    <StatCard label="Total Sales" value={salesData.summary.totalEarnings} color="blue" icon={<TrendingUp className="h-5 w-5" />} />
                    <StatCard label="Platform Fees" value={salesData.summary.platformFeeTotal} color="amber" icon={<ShieldAlert className="h-5 w-5" />} />
                  </div>

                  {/* Seller "Next Steps" Guide */}
                  <div className="bg-primary/5 border border-primary/20 rounded-[2rem] p-8 overflow-hidden relative">
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-primary rounded-xl shadow-lg shadow-primary/20">
                        <Check className="h-4 w-4 text-black" />
                      </div>
                      <h3 className="text-sm font-black text-text-main uppercase tracking-widest">Sold! What's next?</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-primary uppercase">Step 1</p>
                        <p className="text-xs font-bold text-text-main">Coordinate via Chat</p>
                        <p className="text-[10px] text-text-muted leading-relaxed font-medium">Message the buyer to fix a meetup time at your specified campus location.</p>
                      </div>
                      <div className="space-y-2 border-t sm:border-t-0 sm:border-l border-border pt-4 sm:pt-0 sm:pl-6">
                        <p className="text-[10px] font-black text-primary uppercase">Step 2</p>
                        <p className="text-xs font-bold text-text-main">Verify the PIN</p>
                        <p className="text-[10px] text-text-muted leading-relaxed font-medium">In person, ask the buyer for their 4-digit PIN and enter it below to confirm handover.</p>
                      </div>
                      <div className="space-y-2 border-t sm:border-t-0 sm:border-l border-border pt-4 sm:pt-0 sm:pl-6">
                        <p className="text-[10px] font-black text-primary uppercase">Step 3</p>
                        <p className="text-xs font-bold text-text-main">Collect your Cash</p>
                        <p className="text-[10px] text-text-muted leading-relaxed font-medium">Once the PIN is verified, collect the full notes price in cash directly from the buyer.</p>
                      </div>
                    </div>
                  </div>

                  {/* Transaction list */}
                  <div>
                    <p className="text-xs font-black text-text-muted uppercase tracking-widest mb-3 px-1">Transaction History</p>
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
                                    <MapPin className="h-2.5 w-2.5" /> {sale.meetup_location} (Yours)
                                  </span>
                                )}
                                {sale.buyer_preferred_spot && (
                                  <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-1">
                                    <CheckCircle2 className="h-2.5 w-2.5" /> {sale.buyer_preferred_spot} (Buyer)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${sale.status === 'delivered' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
                                  sale.status === 'shipped' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                                    sale.status === 'pending_meetup' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' :
                                      'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                }`}>
                                {sale.status === 'pending_meetup' ? 'Arrange Meetup' : sale.status?.replace('_', ' ')}
                              </span>
                              <span className="text-sm font-black text-primary">
                                {sale.price_at_purchase === 0 ? 'FREE' : `+₹${sale.price_at_purchase * sale.quantity}`}
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
                          {(sale.status === 'pending_meetup' || sale.status === 'acknowledged') && (
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
                                className="w-full sm:w-auto mt-2 sm:mt-6 px-6 py-3 bg-primary hover:bg-primary-hover text-black font-black text-sm uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0 shadow-sm"
                              >
                                {verifyingOrderId === sale.id ? (
                                  <span className="h-4 w-4 rounded-full border-2 border-black/40 border-t-black animate-spin" />
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
            <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-2xl mx-auto">

              {/* Account Section */}
              <div className="bg-surface border border-border rounded-[2rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2.5 bg-primary/10 rounded-2xl text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-text-main uppercase tracking-widest">Account Profile</h3>
                    <p className="text-[10px] font-bold text-text-muted uppercase mt-0.5">Your public identity</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <Label>Display Name</Label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className={inputClass} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <Label>Mobile Number</Label>
                      <input type="tel" value={editMobile} onChange={e => setEditMobile(e.target.value)} placeholder="+91 ..." className={inputClass} />
                    </div>
                    <div>
                      <Label>Hostel / Campus Location</Label>
                      <input type="text" value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="e.g. SR Bhavan, Room 123" className={inputClass} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payout Section */}
              <div className="bg-surface border border-border rounded-[2rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2.5 bg-emerald-500/10 rounded-2xl text-emerald-600">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-text-main uppercase tracking-widest">Payout Details</h3>
                    <p className="text-[10px] font-bold text-text-muted uppercase mt-0.5">Where you get paid</p>
                  </div>
                </div>

                <div>
                  <Label>UPI ID for Payouts</Label>
                  <input type="text" value={editUpi} onChange={e => setEditUpi(e.target.value)} placeholder="username@upi" className={inputClass} />
                  <p className="text-[9px] text-text-muted mt-3 font-medium px-1 flex items-center gap-1.5">
                    <ShieldAlert className="h-3 w-3" /> Encrypted and only used for legitimate earnings transfer.
                  </p>
                </div>
              </div>

              {/* Save Button for Profile */}
              <button
                onClick={handleProfileUpdate}
                className="w-full py-5 bg-primary hover:bg-primary-hover text-black rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
              >
                Save Profile Changes
              </button>

              {/* Security */}
              <div className="bg-surface border border-border rounded-[2rem] p-8 shadow-sm mt-12 opacity-80 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2.5 bg-amber-500/10 rounded-2xl text-amber-600">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-text-main uppercase tracking-widest">
                      {user?.has_password ? 'Update Password' : 'Create Password'}
                    </h3>
                    <p className="text-[10px] font-bold text-text-muted uppercase mt-0.5">
                      {user?.has_password
                        ? 'Secure your account with a new password'
                        : 'Set a password to enable email login alongside Google'}
                    </p>
                  </div>
                </div>

                <div className="space-y-6 mb-8">
                  {user?.has_password && (
                    <div>
                      <Label>Current Password</Label>
                      <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputClass} placeholder="Enter your current password" />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <Label>New Password</Label>
                      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} placeholder="At least 6 characters" />
                    </div>
                    <div>
                      <Label>Confirm New Password</Label>
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} placeholder="Repeat new password" />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handlePasswordChange}
                  disabled={submittingPassword || !newPassword || newPassword.length < 6 || newPassword !== confirmPassword || (user?.has_password && !currentPassword)}
                  className="w-full py-5 bg-background hover:bg-surface border border-border text-text-main rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {submittingPassword && <span className="h-3.5 w-3.5 rounded-full border-2 border-text-main/40 border-t-text-main animate-spin" />}
                  {submittingPassword ? 'Updating...' : (user?.has_password ? 'Update Password' : 'Set Password')}
                </button>
              </div>


              <TelegramConnect />

              {/* PWA Install */}
              {!window.matchMedia('(display-mode: standalone)').matches && (
                <div className="bg-primary/5 border border-primary/20 rounded-[2rem] p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary rounded-xl">
                      <Package className="h-4 w-4 text-black" />
                    </div>
                    <h3 className="text-sm font-black text-text-main uppercase tracking-wider">Install OpenNotes App</h3>
                  </div>
                  <p className="text-[11px] text-text-muted mb-6 leading-relaxed font-medium">
                    Install on your home screen for a seamless mobile experience and real-time push notifications.
                  </p>
                  <button
                    onClick={handleInstallApp}
                    className="px-8 py-4 bg-primary hover:bg-primary-hover text-black rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md"
                  >
                    Add to Home Screen
                  </button>
                </div>
              )}

              {/* Debug Tools */}
              <div className="p-8 bg-red-500/5 border border-red-500/10 rounded-[2rem] flex flex-col items-center text-center">
                <p className="text-[10px] font-mono text-text-muted mb-4 opacity-40">User ID: {user?.id}</p>
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
                  className="flex-[2] py-3 bg-primary text-black hover:bg-primary-hover rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                  {submittingReview && <span className="h-3.5 w-3.5 rounded-full border-2 border-black/40 border-t-black animate-spin" />}
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
                  <div className="bg-surface/50 border border-border rounded-xl p-4 space-y-4">

                    {/* Seller Side (You) */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-surface border border-border rounded-lg shrink-0">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-0.5">Your Location</p>
                          <p className="text-sm font-bold text-text-main">
                            {selectedListing?.location || selectedSale?.location || 'Not specified'}
                          </p>
                        </div>
                      </div>
                      {(selectedListing?.meetup_location || selectedSale?.meetup_location) && (
                        <div className="flex items-start gap-3 pl-11">
                          <div>
                            <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-0.5">Your Hand-over Instructions</p>
                            <p className="text-xs font-semibold text-text-main italic leading-snug">
                              "{selectedListing?.meetup_location || selectedSale?.meetup_location}"
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Buyer Side — ONLY FOR SALES */}
                    {selectedSale && selectedSale.buyer_preferred_spot && (
                      <div className="pt-4 border-t border-border space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg shrink-0">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Buyer's Preferred Spot</p>
                            <p className="text-sm font-bold text-text-main">
                              {selectedSale.buyer_preferred_spot}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 pl-11">
                          <div className="flex-1">
                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Buyer's Availability & Notes</p>
                            <p className="text-xs font-semibold text-text-main leading-snug">
                              {selectedSale.collection_date}
                            </p>
                            {selectedSale.buyer_meetup_details && (
                              <p className="text-xs text-text-muted italic mt-1.5 p-2 bg-background rounded-lg border border-border/50">
                                "{selectedSale.buyer_meetup_details}"
                              </p>
                            )}
                          </div>
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
