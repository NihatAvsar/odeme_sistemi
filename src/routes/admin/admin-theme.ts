export const adminPageClass =
  'mx-auto max-w-6xl p-4 md:p-8 space-y-6 bg-gradient-to-br from-orange-50 via-white to-rose-50';

export const adminSectionClass =
  'rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg ring-1 ring-orange-100/60 backdrop-blur-md';

export const adminCardClass =
  'rounded-3xl border border-white/50 p-5 shadow-lg ring-1 ring-white/70 backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl';

export const adminButtonClass =
  'rounded-2xl bg-gradient-to-r from-brand-600 to-rose-500 px-4 py-2.5 font-medium text-white transition-all duration-300 ease-out hover:from-brand-700 hover:to-rose-600 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50';

export const adminSecondaryButtonClass =
  'rounded-2xl border border-orange-100 bg-white/75 px-4 py-2.5 font-medium text-slate-700 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:border-orange-200';

export const adminStatCardClass =
  'rounded-3xl border border-white/60 bg-white/75 p-4 shadow-lg ring-1 ring-white/70 backdrop-blur-md';

export function getAdminSummaryToneClasses(tone: 'brand' | 'sky' | 'rose' | 'amber' | 'violet') {
  switch (tone) {
    case 'brand':
      return {
        card: 'border-brand-200/70 bg-gradient-to-br from-brand-50/90 via-white to-orange-50/80 text-brand-700',
        accent: 'bg-gradient-to-b from-brand-500 to-orange-400',
        value: 'text-brand-700',
      };
    case 'sky':
      return {
        card: 'border-sky-200/70 bg-gradient-to-br from-sky-50/90 via-white to-cyan-50/80 text-sky-700',
        accent: 'bg-gradient-to-b from-sky-500 to-cyan-400',
        value: 'text-sky-700',
      };
    case 'rose':
      return {
        card: 'border-rose-200/70 bg-gradient-to-br from-rose-50/90 via-white to-pink-50/80 text-rose-700',
        accent: 'bg-gradient-to-b from-rose-500 to-pink-400',
        value: 'text-rose-700',
      };
    case 'amber':
      return {
        card: 'border-amber-200/70 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/80 text-amber-700',
        accent: 'bg-gradient-to-b from-amber-500 to-orange-400',
        value: 'text-amber-700',
      };
    case 'violet':
      return {
        card: 'border-violet-200/70 bg-gradient-to-br from-violet-50/90 via-white to-fuchsia-50/80 text-violet-700',
        accent: 'bg-gradient-to-b from-violet-500 to-fuchsia-400',
        value: 'text-violet-700',
      };
  }
}
