import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, Star, MessageCircle, MapPin, ChevronLeft, ChevronRight, Users, Package, Clock, CheckCircle2, XCircle, Truck, Hash } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import toast from 'react-hot-toast';
import { statusColors, formatStatus } from '../utils/status.js';

interface OrderItem {
  id: string;
  title: string;
  course_code: string;
  image_url: string;
  quantity: number;
  price_at_purchase: number;
  status: string;
  seller_id: string;
  listing_id: string;
  seller_name?: string;
  seller_email?: string;
  meetup_location?: string;
  condition?: string;
  semester?: string;
  delivery_method?: string;
  material_type?: string;
  location?: string;
}

interface Order {
  id: string;
  total_amount: number;
  platform_fee: number;
  status: string;
  created_at: string;
  delivery_details?: string;
  collection_date?: string;
  meetup_pin?: string;
  items: OrderItem[];
}

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'completed') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === 'cancelled') return <XCircle className="h-3.5 w-3.5" />;
  if (status === 'pending_meetup') return <MapPin className="h-3.5 w-3.5" />;
  if (status === 'processing') return <Truck className="h-3.5 w-3.5" />;
  return <Clock className="h-3.5 w-3.5" />;
};

export const OrdersView = ({ onContactSeller }: { onContactSeller?: (sellerId: string, listingId: string, listingTitle: string) => void; key?: React.Key }) => {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [reviewItem, setReviewItem] = useState<OrderItem | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [pinVisible, setPinVisible] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch('/api/orders/my-orders', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setOrders(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const handleLeaveReview = async () => {
    if (!reviewOrder || !reviewItem || submittingReview || !token) return;
    setSubmittingReview(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          seller_id: reviewItem.seller_id,
          order_id: reviewOrder.id,
          listing_id: reviewItem.listing_id,
          rating,
          comment: reviewComment
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Review submitted! Thank you.');
        setReviewOrder(null);
        setReviewItem(null);
        setReviewComment('');
        setRating(5);
      } else {
        toast.error(data.error || 'Failed to submit review');
      }
    } catch {
      toast.error('Network error');
    }
    setSubmittingReview(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10"
    >
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#003366] dark:text-blue-400 mb-1">Dashboard</p>
          <h1 className="text-3xl sm:text-4xl font-black text-text-main leading-none">My Orders</h1>
        </div>
        {!loading && orders.length > 0 && (
          <span className="text-[11px] font-black text-text-muted bg-surface border border-border px-3 py-1.5 rounded-full">
            {orders.length} {orders.length === 1 ? 'order' : 'orders'}
          </span>
        )}
      </div>

      <div className="bg-surface rounded-3xl border border-border shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-24 gap-4">
            <div className="relative h-12 w-12">
              <span className="absolute inset-0 rounded-full border-4 border-primary/20"></span>
              <span className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></span>
            </div>
            <p className="text-xs font-bold text-text-muted animate-pulse">Loading your orders…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
            <div className="w-20 h-20 rounded-3xl bg-background border border-border flex items-center justify-center mb-5 shadow-inner">
              <ShoppingBag className="h-9 w-9 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="font-black text-xl text-text-main mb-2">No orders yet</p>
            <p className="text-sm text-text-muted max-w-xs leading-relaxed">Items you purchase will appear here with tracking info and meetup details.</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {selectedOrder ? (
              /* ORDER DETAIL VIEW */
              <motion.div
                key="order-details"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              >
                {/* Sticky detail header */}
                <div className="sticky top-0 z-10 flex items-center gap-3 px-4 sm:px-6 py-3.5 bg-surface/90 backdrop-blur-md border-b border-border">
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 rounded-xl border border-border bg-background hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-text-muted shrink-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Hash className="h-3 w-3 text-text-muted shrink-0" />
                      <p className="text-sm font-black text-text-main truncate">{selectedOrder.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <p className="text-[10px] font-medium text-text-muted">
                      {new Date(selectedOrder.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase shrink-0 ${statusColors[selectedOrder.status] || 'bg-surface text-text-muted'}`}>
                    <StatusIcon status={selectedOrder.status} />
                    {formatStatus(selectedOrder.status)}
                  </span>
                </div>

                <div className="p-4 sm:p-6 space-y-4">
                  {/* Delivery / collection banner */}
                  {(selectedOrder.delivery_details || selectedOrder.collection_date) && (
                    <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/40 rounded-2xl px-4 py-3.5">
                      <Truck className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <div className="text-xs font-medium text-blue-800 dark:text-blue-200 space-y-0.5">
                        {selectedOrder.delivery_details && <p><span className="font-black">Delivery:</span> {selectedOrder.delivery_details}</p>}
                        {selectedOrder.collection_date && <p><span className="font-black">Collection:</span> {selectedOrder.collection_date}</p>}
                      </div>
                    </div>
                  )}

                  {/* Items */}
                  <div className="space-y-4">
                    {selectedOrder.items?.map((item: OrderItem) => (
                      <div key={item.id} className="rounded-2xl border border-border overflow-hidden bg-background">
                        {/* Hero image */}
                        <div className="relative w-full h-44 sm:h-60 overflow-hidden">
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                            <span className="inline-block px-2.5 py-1 bg-white/15 backdrop-blur-sm border border-white/20 rounded-lg text-[9px] font-black uppercase tracking-widest text-white mb-2">
                              {item.course_code}
                            </span>
                            <h3 className="text-lg sm:text-2xl font-black text-white leading-tight">{item.title}</h3>
                          </div>
                        </div>

                        {/* Item body */}
                        <div className="p-4 sm:p-5 space-y-4">
                          {/* Tags */}
                          <div className="flex flex-wrap gap-2">
                            {item.semester && <span className="text-[10px] font-black text-text-muted bg-surface border border-border px-2.5 py-1 rounded-lg">Sem {item.semester}</span>}
                            {item.condition && <span className="text-[10px] font-black text-text-muted bg-surface border border-border px-2.5 py-1 rounded-lg">{item.condition}</span>}
                            <span className="text-[10px] font-black text-text-muted bg-surface border border-border px-2.5 py-1 rounded-lg">Qty: {item.quantity}</span>
                            {item.material_type && (
                              <span className="text-[10px] font-black text-[#003366] dark:text-blue-300 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 px-2.5 py-1 rounded-lg">
                                {item.material_type}
                              </span>
                            )}
                          </div>

                          {/* Seller + Price grid */}
                          <div className="grid grid-cols-2 gap-3">
                            {item.seller_name && (
                              <div className="col-span-2 sm:col-span-1 bg-surface rounded-xl border border-border p-4">
                                <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-text-muted mb-2.5">
                                  <Users className="h-3 w-3 text-[#003366] dark:text-blue-400" /> Seller
                                </p>
                                <p className="font-black text-text-main truncate">{item.seller_name}</p>
                                <p className="text-xs text-text-muted mt-0.5 truncate">{item.seller_email}</p>
                                {item.location && (
                                  <p className="text-[10px] text-text-muted mt-2 flex items-center gap-1">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="font-bold text-[#003366] dark:text-blue-400">{item.location}</span>
                                  </p>
                                )}
                              </div>
                            )}
                            <div className={`${item.seller_name ? 'col-span-2 sm:col-span-1' : 'col-span-2'} bg-surface rounded-xl border border-border p-4 flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-start`}>
                              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted sm:mb-1">Item Total</p>
                              <p className="text-2xl sm:text-3xl font-black text-text-main">₹{item.price_at_purchase * item.quantity}</p>
                              <p className="text-[10px] text-text-muted hidden sm:block mt-0.5">₹{item.price_at_purchase} × {item.quantity}</p>
                            </div>
                          </div>

                          {/* Meetup location */}
                          {item.meetup_location && (item.delivery_method === 'in_person' || item.delivery_method === 'both') && (
                            <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/40 rounded-xl p-4">
                              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg text-emerald-600 shrink-0">
                                <MapPin className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-1">Meetup Instructions</p>
                                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 italic leading-relaxed">"{item.meetup_location}"</p>
                              </div>
                            </div>
                          )}

                          {/* Meetup PIN */}
                          {selectedOrder.status === 'pending_meetup' && (item as any).meetup_pin && (
                            <button
                              onClick={() => setPinVisible(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                              className="w-full flex items-center justify-between bg-[#003366] hover:bg-[#002244] active:scale-[0.98] rounded-xl px-5 py-4 transition-all"
                            >
                              <div className="text-left">
                                <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-0.5">Meetup PIN</p>
                                <p className="text-[10px] text-white/40">{pinVisible[item.id] ? 'Tap to hide' : 'Tap to reveal'}</p>
                              </div>
                              <span className="text-xl font-black text-white tracking-[0.3em] bg-white/10 px-5 py-2.5 rounded-lg font-mono">
                                {pinVisible[item.id] ? (item as any).meetup_pin : '• • • •'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer: total + actions */}
                  <div className="space-y-3 pt-1">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/40 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Online Platform Fee</p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-0.5">Paid successfully</p>
                        </div>
                        <p className="text-xl font-black text-emerald-800 dark:text-emerald-300">₹{selectedOrder.platform_fee}</p>
                      </div>
                      
                      <div className="pt-3 border-t border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-[#003366] dark:text-blue-400">Cash Due to Seller</p>
                          <p className="text-[10px] text-text-muted mt-0.5">To be paid at meetup</p>
                        </div>
                        <p className="text-xl font-black text-text-main">₹{selectedOrder.total_amount - selectedOrder.platform_fee}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {selectedOrder.items?.[0]?.seller_id && (
                        <button
                          onClick={() => onContactSeller?.(selectedOrder.items[0].seller_id, selectedOrder.items[0].listing_id, selectedOrder.items[0].title)}
                          className="flex-1 flex items-center justify-center gap-2 py-4 bg-[#003366] hover:bg-[#002244] active:scale-[0.98] text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-[#003366]/20"
                        >
                          <MessageCircle className="h-4 w-4" /> Message Seller
                        </button>
                      )}
                      {selectedOrder.status === 'completed' && (
                        <button
                          onClick={() => { setReviewOrder(selectedOrder); setReviewItem(selectedOrder.items[0]); setRating(5); setReviewComment(''); }}
                          className="flex-1 flex items-center justify-center gap-2 py-4 bg-surface hover:bg-background border border-border active:scale-[0.98] text-text-main hover:text-[#003366] rounded-2xl text-xs font-black transition-all"
                        >
                          <Star className="h-4 w-4" /> Leave Review
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* ORDER LIST VIEW */
              <motion.div
                key="order-list"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                className="divide-y divide-border"
              >
                {orders.map((order, idx) => (
                  <motion.button
                    key={order.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.2 }}
                    onClick={() => setSelectedOrder(order)}
                    className="w-full text-left flex items-center gap-4 px-4 sm:px-6 py-4 hover:bg-background/60 transition-colors group"
                  >
                    {/* Image */}
                    <div className="relative shrink-0 w-14 h-14 sm:w-16 sm:h-16">
                      <div className="w-full h-full rounded-xl overflow-hidden border border-border bg-background shadow-sm">
                        {order.items?.[0] && (
                          <img
                            src={order.items[0].image_url}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        )}
                      </div>
                      {(order.items?.length || 0) > 1 && (
                        <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#003366] text-white text-[8px] font-black flex items-center justify-center border-2 border-surface">
                          +{(order.items?.length || 0) - 1}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#003366] dark:text-blue-400">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase shrink-0 ${statusColors[order.status] || 'bg-surface text-text-muted'}`}>
                          <StatusIcon status={order.status} />
                          {formatStatus(order.status)}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-text-main line-clamp-1 group-hover:text-[#003366] dark:group-hover:text-blue-300 transition-colors">
                        {order.items?.map(i => i.title).join(', ')}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] text-text-muted">
                          {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <span className="text-[10px] font-black text-text-muted flex items-center gap-0.5 group-hover:text-[#003366] transition-colors">
                          View <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* REVIEW MODAL / BOTTOM SHEET */}
      <AnimatePresence>
        {reviewOrder && reviewItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setReviewOrder(null); setReviewItem(null); }}
              className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 sm:inset-0 z-[101] sm:flex sm:items-center sm:justify-center sm:p-4 pointer-events-none"
            >
              <div className="pointer-events-auto bg-surface rounded-t-[2.5rem] sm:rounded-3xl p-6 sm:p-8 w-full sm:max-w-md shadow-2xl">
                <div className="w-10 h-1 bg-border rounded-full mx-auto mb-6 sm:hidden" />

                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-2xl font-black text-text-main leading-tight">Rate this order</h2>
                    <p className="text-xs text-text-muted font-medium mt-0.5 line-clamp-1">"{reviewItem.title}"</p>
                  </div>
                  <button
                    onClick={() => { setReviewOrder(null); setReviewItem(null); }}
                    className="hidden sm:flex p-2 rounded-lg border border-border hover:bg-background text-text-muted transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex justify-center gap-3 mb-6">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="focus:outline-none transition-all active:scale-125 hover:scale-110"
                    >
                      <Star className={`h-9 w-9 transition-colors ${star <= rating ? 'fill-[#FFC000] text-[#FFC000]' : 'text-border dark:text-slate-700'}`} />
                    </button>
                  ))}
                </div>

                <div className="mb-5">
                  <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 ml-1">Your experience</label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={3}
                    placeholder="Condition, communication, meeting point…"
                    className="w-full px-4 py-3.5 bg-background border border-border rounded-2xl text-sm font-medium outline-none focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 text-text-main resize-none transition-all placeholder:text-text-muted/50"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setReviewOrder(null); setReviewItem(null); }}
                    className="sm:hidden flex-1 py-4 text-text-muted font-black text-xs uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLeaveReview}
                    disabled={submittingReview}
                    className="flex-[2] sm:flex-1 py-4 bg-[#003366] hover:bg-[#002244] disabled:opacity-50 active:scale-[0.98] text-white rounded-2xl font-black text-xs uppercase tracking-[0.15em] transition-all shadow-lg shadow-[#003366]/20"
                  >
                    {submittingReview ? 'Posting…' : 'Post Review'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};