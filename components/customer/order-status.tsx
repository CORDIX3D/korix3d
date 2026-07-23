const statuses: Record<string, { label: string; className: string }> = {
  new: { label: 'Oczekuje na wycenę', className: 'bg-slate-500/15 text-slate-300' },
  pending: { label: 'Nowe', className: 'bg-slate-500/15 text-slate-300' },
  quoted: { label: 'Wycena gotowa', className: 'bg-blue-500/15 text-blue-300' },
  accepted: { label: 'Zaakceptowane', className: 'bg-cyan-500/15 text-cyan-300' },
  paid: { label: 'Opłacone', className: 'bg-cyan-500/15 text-cyan-300' },
  queued: { label: 'W kolejce', className: 'bg-amber-500/15 text-amber-300' },
  processing: { label: 'W realizacji', className: 'bg-amber-500/15 text-amber-300' },
  printing: { label: 'Drukowanie', className: 'bg-orange-500/15 text-orange-300' },
  post_processing: { label: 'Obróbka', className: 'bg-violet-500/15 text-violet-300' },
  packed: { label: 'Spakowane', className: 'bg-indigo-500/15 text-indigo-300' },
  shipped: { label: 'Wysłane', className: 'bg-sky-500/15 text-sky-300' },
  completed: { label: 'Zrealizowane', className: 'bg-green-500/15 text-green-300' },
  delivered: { label: 'Dostarczone', className: 'bg-green-500/15 text-green-300' },
  cancelled: { label: 'Anulowane', className: 'bg-red-500/15 text-red-300' },
  refunded: { label: 'Zwrócone', className: 'bg-red-500/15 text-red-300' },
};

export function OrderStatus({ status }: { status: string }) {
  const item = statuses[status] ?? { label: status, className: 'bg-secondary text-muted-foreground' };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${item.className}`}>{item.label}</span>;
}
