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
    <main className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Menü</h1>
          <p className="text-sm text-slate-500">Masa {tableCode}</p>
        </div>
        <Link to={`/table/${tableCode}`} className="rounded-xl border px-3 py-2 text-sm font-medium">
          Adisyona Dön
        </Link>
      </div>

      {loading ? <p>Menü yükleniyor...</p> : null}
      {error ? <p className="text-rose-600">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          {categories.map((category) => (
            <div key={category.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold">{category.name}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {category.items.map((item) => {
                  const qty = Object.entries(cart).reduce((sum, [key, value]) => (cartMeta[key]?.menuItemId === item.id ? sum + value : sum), 0);
                  const optionCount = item.optionGroups?.length ?? 0;
                  return (
                    <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-medium">{item.name}</h3>
                          <p className="text-sm text-slate-500">{item.description}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold">{Number(item.price).toFixed(2)} TL</span>
                          {!item.isActive ? <p className="text-xs text-slate-400">Pasif</p> : null}
                          {item.isOutOfStock ? <p className="text-xs font-medium text-rose-600">Stok yok</p> : null}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <button type="button" onClick={() => changeQty(Object.keys(cartMeta).find((key) => cartMeta[key].menuItemId === item.id) ?? item.id, -1)} className="h-9 w-9 rounded-full border">
                          -
                        </button>
                        <span className="w-8 text-center font-semibold">{qty}</span>
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
                          className="h-9 w-9 rounded-full border disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <aside className="h-fit rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">Sepet</h2>
          <div className="mt-4 space-y-2 text-sm">
            {cartItems.length === 0 ? <p className="text-slate-500">Sepet boş</p> : null}
            {cartItems.map((item) => (
              <div key={`${item.menuItemId}:${item.optionIds?.join(',') ?? ''}`} className="flex justify-between gap-3">
                <span>{item.name}{item.optionLabel ? <span className="block text-xs text-slate-500">{item.optionLabel}</span> : null}</span>
                <span>x{item.quantity}</span>
              </div>
            ))}
          </div>

          <label className="mt-4 block text-sm">
            Adınız
            <input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <label className="mt-3 block text-sm">
            Not
            <textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <label className="mt-3 block text-sm">
            Kupon Kodu
            <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
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
            className="mt-4 w-full rounded-2xl bg-black px-4 py-3 text-white disabled:opacity-50"
          >
            {submitting ? 'Gönderiliyor...' : 'Sipariş İsteği Gönder'}
          </button>
        </aside>
      </div>

      {optionItem ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-4 sm:items-center sm:justify-center">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">{optionItem.name} seçenekleri</h2>
            <div className="mt-4 space-y-4">
              {(optionItem.optionGroups ?? []).map((group) => (
                <div key={group.id}>
                  <p className="font-medium">{group.name}{group.isRequired ? ' *' : ''}</p>
                  <div className="mt-2 space-y-2">
                    {group.options.map((option) => {
                      const checked = (selectedOptions[group.id] ?? []).includes(option.id);
                      return (
                        <label key={option.id} className="flex items-center justify-between rounded-2xl border px-3 py-2 text-sm">
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
            <div className="mt-5 flex gap-2">
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
    </main>
  );
}
