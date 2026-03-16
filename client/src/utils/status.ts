export const statusColors: Record<string, string> = {
  pending_payment: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  paid: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  shipped: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  delivered: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  buyer_confirmed: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  completed: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  pending_delivery: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  pending_meetup: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  acknowledged: 'bg-primary/10 text-primary border-primary/20',
  active: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  archived: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  deleted: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  rejected: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  flagged: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  resolved: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
};

export const formatStatus = (s: string) => {
  if (s === 'pending_delivery') return 'Action Required';
  if (s === 'pending_meetup') return 'Meetup Pending';
  if (s === 'acknowledged') return 'Ready for Meetup';
  if (s === 'shipped') return 'In Transit / Ready';
  if (s === 'delivered') return 'Verify Delivery';
  if (s === 'buyer_confirmed') return 'Received (Escrow Pending)';
  if (s === 'completed') return 'Completed';
  return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};
