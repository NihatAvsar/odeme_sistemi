export function getTableStatusLabel(status: string) {
  switch (status) {
    case 'OCCUPIED':
      return 'Müşteri var';
    case 'AVAILABLE':
      return 'Müşteri yok';
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
        card: 'border-emerald-200 bg-emerald-50 text-emerald-900',
        badge: 'bg-emerald-100 text-emerald-800',
      };
    case 'AVAILABLE':
      return {
        card: 'border-rose-200 bg-rose-50 text-rose-900',
        badge: 'bg-rose-100 text-rose-800',
      };
    case 'RESERVED':
      return {
        card: 'border-amber-200 bg-amber-50 text-amber-900',
        badge: 'bg-amber-100 text-amber-800',
      };
    case 'DISABLED':
      return {
        card: 'border-rose-200 bg-rose-50 text-rose-900',
        badge: 'bg-rose-100 text-rose-800',
      };
    default:
      return {
        card: 'border-slate-200 bg-slate-100 text-slate-700',
        badge: 'bg-slate-200 text-slate-700',
      };
  }
}
