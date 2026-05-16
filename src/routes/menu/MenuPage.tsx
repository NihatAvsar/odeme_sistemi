// src/routes/menu/MenuPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createOrderRequest } from '../../api/order-requests';
import { getMenu, type MenuCategoryDto } from '../../api/menu';
import { validateCoupon, type CouponValidationDto } from '../../api/promotions';
import { getSocket } from '../../lib/socket';
import { getTableContext } from '../../api/tables';

type CartState = Record<string, number>;
type CartMeta = Record<string, { menuItemId: string; name: string; price: number; optionIds: string[]; optionLabel?: string }>;

export function MenuPage() {
  const { tableCode = '12' } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<MenuCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartState>({});
  const [cartMeta, setCartMeta] = useState<CartMeta>({});
  const [optionItem, setOptionItem] = useState<MenuCategoryDto['items'][number] | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [requestedBy, setRequestedBy] = useState('');
  const [note, setNote] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponValidation, setCouponValidation] = useState<CouponValidationDto | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void getTableContext(tableCode)
      .then((context) => getMenu(context.table.code))
      .then((data) => {
        if (!mounted) return;
        setCategories(data.categories);
        setError(null);

        const socket = getSocket();
        socket.connect();
        socket.emit('restaurant:join', data.table.restaurantId);

        const onMenuUpdated = () => {
          void getTableContext(tableCode)
            .then((context) => getMenu(context.table.code))
            .then((next) => mounted && setCategories(next.categories));
        };

        socket.off('menu.updated');
        socket.on('menu.updated', onMenuUpdated);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Menu load failed');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      getSocket().off('menu.updated');
    };
  }, [tableCode]);

  const cartItems = useMemo(() => {
    const items: Array<{ menuItemId: string; quantity: number; name: string; price: number; optionIds?: string[]; optionLabel?: string }> = [];
    Object.entries(cart).forEach(([key, qty]) => {
      const meta = cartMeta[key];
      if (qty > 0 && meta) items.push({ ...meta, quantity: qty });
    });
    return items;
  }, [cart, cartMeta]);

  const total = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const discount = couponValidation?.valid ? couponValidation.discount : 0;
    return Math.max(0, subtotal - discount);
  }, [cartItems, couponValidation]);

  const subtotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity * item.price, 0), [cartItems]);

  useEffect(() => {
    let mounted = true;
    if (!couponCode.trim() || subtotal <= 0) {
      setCouponValidation(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      void validateCoupon({ tableCode, subtotal, couponCode })
        .then((result) => mounted && setCouponValidation(result))
        .catch(() => mounted && setCouponValidation({ valid: false, reason: 'Kupon doğrulanamadı.', discount: 0 }));
    }, 300);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, [couponCode, subtotal, tableCode]);

  const changeQty = (key: string, delta: number) => {
    setCart((current) => {
      const next = Math.max(0, (current[key] ?? 0) + delta);
      return { ...current, [key]: next };
    });
  };

  const addItem = (item: MenuCategoryDto['items'][number], optionIds: string[] = []) => {
    const selected = (item.optionGroups ?? []).flatMap((group) => group.options.filter((option) => optionIds.includes(option.id)).map((option) => ({ group: group.name, option })));
    const optionTotal = selected.reduce((sum, entry) => sum + Number(entry.option.priceDelta), 0);
    const key = `${item.id}:${optionIds.slice().sort().join(',')}`;
    const optionLabel = selected.map((entry) => `${entry.group}: ${entry.option.name}`).join(', ');

    setCartMeta((current) => ({
      ...current,
      [key]: { menuItemId: item.id, name: item.name, price: Number(item.price) + optionTotal, optionIds, optionLabel },
    }));
    changeQty(key, 1);
  };

  const handleSubmit = async () => {
    if (cartItems.length === 0) return;

    const unavailable = categories.some((category) =>
      category.items.some((item) => (cart[item.id] ?? 0) > 0 && (!item.isActive || item.isOutOfStock)),
    );

    if (unavailable) {
      setError('Sepette stokta olmayan veya pasif ürün var.');
      return;
    }

    setSubmitting(true);
    try {
      await createOrderRequest({
        tableId: tableCode,
        requestedBy,
        note,
        couponCode: couponCode || undefined,
        items: cartItems.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity, optionIds: item.optionIds })),
      });
      setCart({});
      setCartMeta({});
      navigate('/table/' + tableCode);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl p-3 pb-28 md:p-8">
      <div className="mb-4 overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-brand-700 p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Masa {tableCode}</p>
              <h1 className="mt-2 text-3xl font-semibold">Menü</h1>
              <p className="mt-2 text-sm text-white/70">Ürünleri seçin, notunuzu ekleyin, sipariş isteğinizi gönderin.</p>
            </div>
            <Link to={`/table/${tableCode}`} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/75 ring-1 ring-white/20">
              Adisyon
            </Link>
          </div>
        </div>
      </div>

      <div className="mb-4 hidden items-center justify-between md:flex">
        <div>
          <h1 className="text-2xl font-semibold">Menü</h1>
          <p className="text-sm text-slate-500">Masa {tableCode}</p>
        </div>
        <Link to={`/table/${tableCode}`} className="rounded-xl border px-3 py-2 text-sm font-medium">
          Adisyona Dön
        </Link>
      </div>

      {loading ? <p className="mb-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Menü yükleniyor...</p> : null}
      {error ? <p className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          {categories.map((category) => (
            <div key={category.id} className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-950">{category.name}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {category.items.map((item) => {
                  const qty = Object.entries(cart).reduce((sum, [key, value]) => (cartMeta[key]?.menuItemId === item.id ? sum + value : sum), 0);
                  const optionCount = item.optionGroups?.length ?? 0;
                  return (
                    <article key={item.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-sm">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="h-40 w-full object-cover" loading="lazy" />
                      ) : null}
                      <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-950">{item.name}</h3>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.description}</p>
                          {optionCount > 0 ? <p className="mt-2 text-xs font-medium text-brand-700">{optionCount} opsiyon grubu</p> : null}
                        </div>
                        <div className="text-right">
                          <span className="whitespace-nowrap text-base font-semibold">{Number(item.price).toFixed(2)} TL</span>
                          {!item.isActive ? <p className="text-xs text-slate-400">Pasif</p> : null}
                          {item.isOutOfStock ? <p className="text-xs font-medium text-rose-600">Stok yok</p> : null}
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => changeQty(Object.keys(cartMeta).find((key) => cartMeta[key].menuItemId === item.id) ?? item.id, -1)}
                          disabled={qty === 0}
                          className="h-11 w-11 rounded-full border bg-white text-lg font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          -
                        </button>
                        <span className="min-w-10 rounded-full bg-white px-3 py-2 text-center font-semibold shadow-sm ring-1 ring-slate-100">{qty}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (optionCount > 0) {
                              setOptionItem(item);
                              setSelectedOptions({});
                            } else {
                              addItem(item);
                            }
                          }}
                          disabled={!item.isActive || item.isOutOfStock}
                          className="h-11 w-11 rounded-full bg-black text-lg font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <aside id="cart-panel" className="h-fit rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Sepet</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{cartItems.length} ürün</span>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {cartItems.length === 0 ? <p className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-500">Sepet boş. Ürünlerdeki + butonuyla başlayın.</p> : null}
            {cartItems.map((item) => (
              <div key={`${item.menuItemId}:${item.optionIds?.join(',') ?? ''}`} className="flex justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2">
                <span>{item.name}{item.optionLabel ? <span className="block text-xs text-slate-500">{item.optionLabel}</span> : null}</span>
                <span>x{item.quantity}</span>
              </div>
            ))}
          </div>

          <label className="mt-4 block text-sm">
            Adınız
            <input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border px-3 py-2 outline-none focus:border-brand-500" />
          </label>
          <label className="mt-3 block text-sm">
            Not
            <textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 min-h-20 w-full rounded-xl border px-3 py-2 outline-none focus:border-brand-500" />
          </label>
          <label className="mt-3 block text-sm">
            Kupon Kodu
            <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} className="mt-1 min-h-12 w-full rounded-xl border px-3 py-2 outline-none focus:border-brand-500" />
          </label>

          {couponCode.trim() ? (
            <div className={`mt-3 rounded-2xl px-4 py-3 text-sm ${couponValidation?.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
              {couponValidation?.valid ? `Kupon aktif. İndirim: ${couponValidation.discount.toFixed(2)} TL` : couponValidation?.reason ?? 'Kupon doğrulanıyor...'}
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <span className="font-medium">Toplam</span>
            <span className="font-semibold">{total.toFixed(2)} TL</span>
          </div>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={cartItems.length === 0 || submitting}
            className="mt-4 min-h-14 w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {submitting ? 'Gönderiliyor...' : 'Sipariş İsteği Gönder'}
          </button>
        </aside>
      </div>

      {optionItem ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-xl sm:rounded-[2rem]">
            <p className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
            <h2 className="text-xl font-semibold">{optionItem.name}</h2>
            <p className="mt-1 text-sm text-slate-500">Seçenekleri belirleyip sepete ekleyin.</p>
            <div className="mt-4 space-y-4">
              {(optionItem.optionGroups ?? []).map((group) => (
                <div key={group.id}>
                  <p className="font-medium">{group.name}{group.isRequired ? ' *' : ''}</p>
                  <div className="mt-2 space-y-2">
                    {group.options.map((option) => {
                      const checked = (selectedOptions[group.id] ?? []).includes(option.id);
                      return (
                          <label key={option.id} className="flex min-h-14 items-center justify-between rounded-2xl border px-4 py-3 text-sm">
                          <span>{option.name}</span>
                          <span className="flex items-center gap-2">
                            {Number(option.priceDelta) !== 0 ? <span>+{Number(option.priceDelta).toFixed(2)} TL</span> : null}
                            <input
                              type={group.type === 'SINGLE' ? 'radio' : 'checkbox'}
                              name={group.id}
                              checked={checked}
                              onChange={(event) => {
                                setSelectedOptions((current) => {
                                  const currentIds = current[group.id] ?? [];
                                  const nextIds = group.type === 'SINGLE'
                                    ? [option.id]
                                    : event.target.checked
                                      ? [...currentIds, option.id].slice(0, group.maxSelect)
                                      : currentIds.filter((id) => id !== option.id);
                                  return { ...current, [group.id]: nextIds };
                                });
                              }}
                            />
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 -mx-5 mt-5 flex gap-2 bg-white px-5 pb-1 pt-3">
              <button type="button" onClick={() => setOptionItem(null)} className="flex-1 rounded-2xl border px-4 py-3 font-medium">Vazgeç</button>
              <button
                type="button"
                onClick={() => {
                  const optionIds = Object.values(selectedOptions).flat();
                  addItem(optionItem, optionIds);
                  setOptionItem(null);
                }}
                className="flex-1 rounded-2xl bg-black px-4 py-3 font-medium text-white"
              >
                Sepete Ekle
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Sepet toplamı</p>
            <p className="text-lg font-semibold text-slate-950">{total.toFixed(2)} TL</p>
          </div>
          <button
            type="button"
            onClick={() => cartItems.length > 0 ? void handleSubmit() : document.getElementById('cart-panel')?.scrollIntoView({ behavior: 'smooth' })}
            disabled={submitting}
            className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {cartItems.length > 0 ? (submitting ? 'Gönderiliyor...' : 'Siparişi Gönder') : 'Sepet Boş'}
          </button>
        </div>
      </div>
    </main>
  );
}
