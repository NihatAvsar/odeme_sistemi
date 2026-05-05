// src/routes/menu/MenuPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createOrderRequest } from '../../api/order-requests';
import { getMenu, type MenuCategoryDto } from '../../api/menu';

type CartState = Record<string, number>;

export function MenuPage() {
  const { tableId = 'table-12' } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<MenuCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartState>({});
  const [requestedBy, setRequestedBy] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void getMenu(tableId)
      .then((data) => {
        if (!mounted) return;
        setCategories(data.categories);
        setError(null);
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
    };
  }, [tableId]);

  const cartItems = useMemo(() => {
    const items: Array<{ menuItemId: string; quantity: number; name: string; price: number }> = [];
    categories.forEach((category) => {
      category.items.forEach((item) => {
        const qty = cart[item.id] ?? 0;
        if (qty > 0) items.push({ menuItemId: item.id, quantity: qty, name: item.name, price: Number(item.price) });
      });
    });
    return items;
  }, [categories, cart]);

  const total = useMemo(() => {
    return categories.reduce((sum, category) => {
      return (
        sum +
        category.items.reduce((inner, item) => {
          const qty = cart[item.id] ?? 0;
          return inner + qty * Number(item.price);
        }, 0)
      );
    }, 0);
  }, [categories, cart]);

  const changeQty = (itemId: string, delta: number) => {
    setCart((current) => {
      const next = Math.max(0, (current[itemId] ?? 0) + delta);
      return { ...current, [itemId]: next };
    });
  };

  const handleSubmit = async () => {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    try {
      await createOrderRequest({
        tableId,
        requestedBy,
        note,
        items: cartItems,
      });
      setCart({});
      navigate('/table/' + tableId);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Menü</h1>
          <p className="text-sm text-slate-500">Masa {tableId}</p>
        </div>
        <Link to={`/table/${tableId}`} className="rounded-xl border px-3 py-2 text-sm font-medium">
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
                  const qty = cart[item.id] ?? 0;
                  return (
                    <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-medium">{item.name}</h3>
                          <p className="text-sm text-slate-500">{item.description}</p>
                        </div>
                        <span className="font-semibold">{Number(item.price).toFixed(2)} TL</span>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <button type="button" onClick={() => changeQty(item.id, -1)} className="h-9 w-9 rounded-full border">
                          -
                        </button>
                        <span className="w-8 text-center font-semibold">{qty}</span>
                        <button type="button" onClick={() => changeQty(item.id, 1)} className="h-9 w-9 rounded-full border">
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
              <div key={item.menuItemId} className="flex justify-between">
                <span>{item.name}</span>
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
    </main>
  );
}
