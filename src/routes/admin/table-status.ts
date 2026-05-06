export function getTableStatusLabel(status: string) {
  switch (status) {
    case 'OCCUPIED':
      return 'Müşteri var';
    case 'AVAILABLE':
      return 'Müşteri yok';
    case 'CLEANING':
      return 'Temizleniyor';
    case 'RESERVED':
      return 'Rezerve';
    case 'DISABLED':
      return 'Kapalı';
    default:
      return 'Bilinmiyor';
  }
}

export function getTableStatusStyles(status: string) {
  switch (status) {
    case 'OCCUPIED':
      return {
        card: 'border-sky-200/80 bg-sky-50/80 text-sky-900',
        badge: 'bg-sky-100/90 text-sky-800',
      };
    case 'AVAILABLE':
      return {
        card: 'border-rose-200/80 bg-rose-50/80 text-rose-900',
        badge: 'bg-rose-100/90 text-rose-800',
      };
    case 'CLEANING':
      return {
        card: 'border-violet-200/80 bg-violet-50/80 text-violet-900',
        badge: 'bg-violet-100/90 text-violet-800',
      };
    case 'RESERVED':
      return {
        card: 'border-amber-200/80 bg-amber-50/80 text-amber-900',
        badge: 'bg-amber-100/90 text-amber-800',
      };
    case 'DISABLED':
      return {
        card: 'border-slate-200 bg-slate-100/80 text-slate-700',
        badge: 'bg-slate-200 text-slate-700',
      };
    default:
      return {
        card: 'border-slate-200 bg-slate-100/80 text-slate-700',
        badge: 'bg-slate-200 text-slate-700',
      };
  }
}
