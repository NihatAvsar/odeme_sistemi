// src/routes/admin/MenuPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  createAdminMenuItem,
  deleteAdminMenuItem,
  getAdminMenuCategories,
  getAdminMenu,
  updateAdminMenuItem,
  updateAdminMenuStock,
  type AdminMenuItemDto,
  type AdminMenuCategoryDto,
} from '../../api/admin-menu';
import { requireAdminSecret, getAdminSecret } from '../../api/admin-auth';

type FormState = {
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  isActive: boolean;
  isOutOfStock: boolean;
};

const emptyForm: FormState = {
  restaurantId: '',
  categoryId: '',
  name: '',
  description: '',
  price: '',
  currency: 'TRY',
  isActive: true,
  isOutOfStock: false,
};

export function MenuPage() {
  const { itemId } = useParams();
  const [items, setItems] = useState<AdminMenuItemDto[]>([]);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(itemId ?? null);
  const [restaurantId, setRestaurantId] = useState('');
  const [categories, setCategories] = useState<AdminMenuCategoryDto[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const data = await getAdminMenu();
    setItems(data);
    if (data.length > 0) {
      const rid = data[0].restaurantId;
      setRestaurantId(rid);
      // Formdaki restaurantId boşsa otomatik doldur (yeni ürün modu)
      setForm((f) => ({ ...f, restaurantId: f.restaurantId || rid }));
    }
    const categoryData = await getAdminMenuCategories();
    setCategories(categoryData);
  };

  useEffect(() => {
    requireAdminSecret();
    void refresh();
  }, []);

  useEffect(() => {
    if (!itemId) return;
    setEditingId(itemId);
  }, [itemId]);

  const filteredItems = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.name.toLowerCase().includes(query) || item.description?.toLowerCase().includes(query));
  }, [items, filter]);

  const editingItem = editingId ? items.find((item) => item.id === editingId) ?? null : null;

  useEffect(() => {
    if (!editingItem) return;
    setForm({
      restaurantId: editingItem.restaurantId,
      categoryId: editingItem.categoryId ?? '',
      name: editingItem.name,
      description: editingItem.description ?? '',
      price: String(editingItem.price),
      currency: editingItem.currency,
      isActive: editingItem.isActive,
      isOutOfStock: editingItem.isOutOfStock,
    });
  }, [editingItem]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);

    const effectiveRestaurantId = form.restaurantId || restaurantId || undefined;
    const payload = {
      restaurantId: effectiveRestaurantId,
      categoryId: form.categoryId || undefined,
      name: form.name,
      description: form.description || undefined,
      price: Number(form.price),
      currency: form.currency,
      isActive: form.isActive,
      isOutOfStock: form.isOutOfStock,
      updatedBy: getAdminSecret(),
    };

    if (editingItem) {
      await updateAdminMenuItem(editingItem.id, payload);
      setStatus('Ürün güncellendi');
    } else {
      await createAdminMenuItem(payload as any);
      setStatus('Yeni ürün eklendi');
    }

    setEditingId(null);
    setForm({ ...emptyForm, restaurantId: effectiveRestaurantId ?? '' });
    await refresh();
    setSaving(false);
  };

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Menu Management</h1>
          <p className="text-sm text-slate-500">Ürün ekle, düzenle, stok kapat/aç</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/dashboard" className="rounded-xl border px-3 py-2 text-sm font-medium">Dashboard</Link>
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
            }}
            className="rounded-xl bg-black px-3 py-2 text-sm font-medium text-white"
          >
            Yeni Ürün
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Ürün ara"
          className="w-full rounded-xl border px-4 py-3"
        />
      </div>

      {status ? <div className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{status}</div> : null}
      {error ? <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{item.name}</h3>
                    <p className="text-sm text-slate-500">{item.description}</p>
                    <div className="mt-2 flex gap-2 text-xs">
                      {!item.isActive ? <span className="rounded-full bg-slate-100 px-2 py-1">Pasif</span> : null}
                      {item.isOutOfStock ? <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">Stok yok</span> : null}
                    </div>
                  </div>
                  <span className="font-semibold">{Number(item.price).toFixed(2)} TL</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditingId(item.id)} className="rounded-xl border px-3 py-2 text-sm font-medium">
                    Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateAdminMenuStock(item.id, !item.isOutOfStock, getAdminSecret());
                      await refresh();
                    }}
                    className="rounded-xl border px-3 py-2 text-sm font-medium"
                  >
                    {item.isOutOfStock ? 'Stoğu Aç' : 'Stok Yok'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateAdminMenuItem(item.id, {
                        isActive: !item.isActive,
                        updatedBy: getAdminSecret(),
                      });
                      setStatus(item.isActive ? 'Ürün pasifleştirildi' : 'Ürün aktifleştirildi');
                      await refresh();
                    }}
                    className="rounded-xl border px-3 py-2 text-sm font-medium text-rose-600"
                  >
                    {item.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="h-fit rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">{editingItem ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}</h2>

          <div className="mt-4 space-y-3">
            <input value={form.restaurantId || restaurantId} onChange={(e) => setForm((f) => ({ ...f, restaurantId: e.target.value }))} className="w-full rounded-xl border px-3 py-2" placeholder="Restaurant ID (otomatik)" />
            <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} className="w-full rounded-xl border px-3 py-2">
              <option value="">Kategori seç (opsiyonel)</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-xl border px-3 py-2" placeholder="Ürün adı" />
            <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-xl border px-3 py-2" placeholder="Açıklama" />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="w-full rounded-xl border px-3 py-2" placeholder="Fiyat" />
              <input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className="w-full rounded-xl border px-3 py-2" placeholder="TRY" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              Aktif
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isOutOfStock} onChange={(e) => setForm((f) => ({ ...f, isOutOfStock: e.target.checked }))} />
              Stok yok
            </label>

            <button
              type="button"
              onClick={() => void handleSave().catch((err) => setError(err instanceof Error ? err.message : 'Kaydedilemedi'))}
              disabled={saving}
              className="w-full rounded-2xl bg-black px-4 py-3 text-white disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor...' : editingItem ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
