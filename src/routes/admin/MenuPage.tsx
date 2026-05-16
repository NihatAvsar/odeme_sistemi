// src/routes/admin/MenuPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  createAdminMenuItem,
  getAdminMenuCategories,
  getAdminMenu,
  updateAdminMenuItem,
  updateAdminMenuOptions,
  updateAdminMenuStock,
  type AdminMenuItemDto,
  type AdminMenuCategoryDto,
  type AdminMenuOptionGroupDto,
} from '../../api/admin-menu';
import { requireAdminSecret, getAdminSecret } from '../../api/admin-auth';

type FormState = {
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  imageUrl: string;
  price: string;
  currency: string;
  isActive: boolean;
  isOutOfStock: boolean;
};

type OptionForm = {
  id?: string;
  name: string;
  priceDelta: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: string;
};

type GroupForm = {
  id?: string;
  name: string;
  type: 'SINGLE' | 'MULTIPLE';
  isRequired: boolean;
  minSelect: string;
  maxSelect: string;
  sortOrder: string;
  isActive: boolean;
  options: OptionForm[];
};

const emptyForm: FormState = {
  restaurantId: '',
  categoryId: '',
  name: '',
  description: '',
  imageUrl: '',
  price: '',
  currency: 'TRY',
  isActive: true,
  isOutOfStock: false,
};

const createEmptyOption = (sortOrder = 0): OptionForm => ({
  name: '',
  priceDelta: '0',
  isDefault: false,
  isActive: true,
  sortOrder: String(sortOrder),
});

const createEmptyGroup = (sortOrder = 0): GroupForm => ({
  name: '',
  type: 'SINGLE',
  isRequired: false,
  minSelect: '0',
  maxSelect: '1',
  sortOrder: String(sortOrder),
  isActive: true,
  options: [createEmptyOption()],
});

const OPTION_TEMPLATES: Array<{ label: string; description: string; group: () => GroupForm }> = [
  {
    label: 'Büyük',
    description: 'Tek seçimli boy grubu',
    group: () => ({
      ...createEmptyGroup(),
      name: 'Boy',
      type: 'SINGLE',
      isRequired: true,
      minSelect: '1',
      maxSelect: '1',
      options: [
        { ...createEmptyOption(0), name: 'Küçük', isDefault: false },
        { ...createEmptyOption(1), name: 'Orta', isDefault: true },
        { ...createEmptyOption(2), name: 'Büyük', isDefault: false },
      ],
    }),
  },
  {
    label: 'Orta',
    description: 'Orta boy odaklı boy grubu',
    group: () => ({
      ...createEmptyGroup(),
      name: 'Boy',
      type: 'SINGLE',
      isRequired: true,
      minSelect: '1',
      maxSelect: '1',
      options: [
        { ...createEmptyOption(0), name: 'Küçük', isDefault: false },
        { ...createEmptyOption(1), name: 'Orta', isDefault: true },
        { ...createEmptyOption(2), name: 'Büyük', isDefault: false },
      ],
    }),
  },
  {
    label: 'Küçük',
    description: 'Küçük boy odaklı boy grubu',
    group: () => ({
      ...createEmptyGroup(),
      name: 'Boy',
      type: 'SINGLE',
      isRequired: true,
      minSelect: '1',
      maxSelect: '1',
      options: [
        { ...createEmptyOption(0), name: 'Küçük', isDefault: true },
        { ...createEmptyOption(1), name: 'Orta', isDefault: false },
        { ...createEmptyOption(2), name: 'Büyük', isDefault: false },
      ],
    }),
  },
  {
    label: 'Standart',
    description: 'Genel kullanım için tek seçim',
    group: () => ({
      ...createEmptyGroup(),
      name: 'Seçim',
      type: 'SINGLE',
      isRequired: false,
      minSelect: '0',
      maxSelect: '1',
      options: [
        { ...createEmptyOption(0), name: 'Standart', isDefault: true },
      ],
    }),
  },
  {
    label: 'Ekstra Malzeme',
    description: 'Çok seçimli ekstra eklemeler',
    group: () => ({
      ...createEmptyGroup(),
      name: 'Ekstralar',
      type: 'MULTIPLE',
      isRequired: false,
      minSelect: '0',
      maxSelect: '99',
      options: [
        { ...createEmptyOption(0), name: 'Peynir', priceDelta: '5' },
        { ...createEmptyOption(1), name: 'Mantar', priceDelta: '7' },
        { ...createEmptyOption(2), name: 'Jalapeno', priceDelta: '4' },
      ],
    }),
  },
  {
    label: 'Çıkarılacak Malzeme',
    description: 'Malzeme çıkarma seçenekleri',
    group: () => ({
      ...createEmptyGroup(),
      name: 'Çıkarılacaklar',
      type: 'MULTIPLE',
      isRequired: false,
      minSelect: '0',
      maxSelect: '99',
      options: [
        { ...createEmptyOption(0), name: 'Soğan' },
        { ...createEmptyOption(1), name: 'Domates' },
        { ...createEmptyOption(2), name: 'Turşu' },
      ],
    }),
  },
];

const parseNumber = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isNotNull = <T,>(value: T | null): value is T => value !== null;

const normalizeGroups = (groups: GroupForm[]) =>
  groups
    .map((group, groupIndex) => {
      const trimmedName = group.name.trim();
      if (!trimmedName) return null;

      const type = group.type;
      const minSelect = Math.max(0, Math.floor(parseNumber(group.minSelect, group.isRequired ? 1 : 0)));
      const maxFallback = type === 'SINGLE' ? 1 : Math.max(minSelect, 1);
      const maxSelect = Math.max(type === 'SINGLE' ? 1 : minSelect, Math.floor(parseNumber(group.maxSelect, maxFallback)));

      const options = group.options
        .map((option, optionIndex) => {
          const optionName = option.name.trim();
          if (!optionName) return null;

          return {
            id: option.id,
            name: optionName,
            priceDelta: parseNumber(option.priceDelta, 0),
            isDefault: Boolean(option.isDefault),
            isActive: option.isActive,
            sortOrder: Math.floor(parseNumber(option.sortOrder, optionIndex)),
          };
        })
        .filter(isNotNull);

      return {
        id: group.id,
        name: trimmedName,
        type,
        isRequired: Boolean(group.isRequired),
        minSelect,
        maxSelect,
        sortOrder: Math.floor(parseNumber(group.sortOrder, groupIndex)),
        isActive: group.isActive,
        options,
      };
    })
    .filter(isNotNull);

const mapGroupsToForm = (groups?: AdminMenuOptionGroupDto[] | null): GroupForm[] =>
  (groups ?? []).map((group, groupIndex) => ({
    id: group.id,
    name: group.name,
    type: group.type,
    isRequired: group.isRequired,
    minSelect: String(group.minSelect ?? 0),
    maxSelect: String(group.maxSelect ?? 1),
    sortOrder: String(group.sortOrder ?? groupIndex),
    isActive: group.isActive ?? true,
    options: (group.options ?? []).length > 0
      ? group.options.map((option, optionIndex) => ({
          id: option.id,
          name: option.name,
          priceDelta: String(option.priceDelta ?? 0),
          isDefault: Boolean(option.isDefault),
          isActive: option.isActive ?? true,
          sortOrder: String(option.sortOrder ?? optionIndex),
        }))
      : [createEmptyOption()],
  }));

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
  const [optionGroups, setOptionGroups] = useState<GroupForm[]>([]);

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
      imageUrl: editingItem.imageUrl ?? '',
      price: String(editingItem.price),
      currency: editingItem.currency,
      isActive: editingItem.isActive,
      isOutOfStock: editingItem.isOutOfStock,
    });
    setOptionGroups(mapGroupsToForm(editingItem.optionGroups));
  }, [editingItem]);

  const resetEditor = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOptionGroups([]);
  };

  const addGroup = () => {
    setOptionGroups((current) => [...current, createEmptyGroup(current.length)]);
  };

  const addOption = (groupIndex: number) => {
    setOptionGroups((current) =>
      current.map((group, index) =>
        index === groupIndex ? { ...group, options: [...group.options, createEmptyOption(group.options.length)] } : group,
      ),
    );
  };

  const applyTemplate = (template: () => GroupForm) => {
    setOptionGroups((current) => [...current, template()]);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const effectiveRestaurantId = form.restaurantId || restaurantId || undefined;
      const payload = {
        restaurantId: effectiveRestaurantId,
        categoryId: form.categoryId || undefined,
        name: form.name,
        description: form.description || undefined,
        imageUrl: form.imageUrl.trim() || null,
        price: Number(form.price),
        currency: form.currency,
        isActive: form.isActive,
        isOutOfStock: form.isOutOfStock,
        updatedBy: getAdminSecret(),
      };

      const groups = normalizeGroups(optionGroups);
      if (editingItem) {
        await updateAdminMenuItem(editingItem.id, payload);
        await updateAdminMenuOptions(editingItem.id, groups);
        setStatus('Ürün güncellendi');
      } else {
        const created = await createAdminMenuItem(payload as any);
        await updateAdminMenuOptions(created.id, groups);
        setStatus('Yeni ürün eklendi');
      }

      setEditingId(null);
      setForm({ ...emptyForm, restaurantId: effectiveRestaurantId ?? '' });
      setOptionGroups([]);
      await refresh();
    } finally {
      setSaving(false);
    }
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
            onClick={resetEditor}
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
                  <div className="flex min-w-0 gap-3">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200" />
                    ) : null}
                    <div className="min-w-0">
                    <h3 className="font-medium">{item.name}</h3>
                    <p className="text-sm text-slate-500">{item.description}</p>
                    {item.optionGroups && item.optionGroups.length > 0 ? (
                      <p className="mt-1 text-xs text-brand-700">{item.optionGroups.length} opsiyon grubu</p>
                    ) : null}
                    <div className="mt-2 flex gap-2 text-xs">
                      {!item.isActive ? <span className="rounded-full bg-slate-100 px-2 py-1">Pasif</span> : null}
                      {item.isOutOfStock ? <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">Stok yok</span> : null}
                    </div>
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
            <input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} className="w-full rounded-xl border px-3 py-2" placeholder="Resim URL" />
            {form.imageUrl.trim() ? (
              <img src={form.imageUrl.trim()} alt="Ürün önizleme" className="h-36 w-full rounded-2xl object-cover ring-1 ring-slate-200" />
            ) : null}
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

            <div className="rounded-2xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Opsiyon Grupları</p>
                  <p className="text-xs text-slate-500">Boy, ekstra malzeme, çıkarılacak malzeme gibi yapılandırılmış seçenekler.</p>
                </div>
                <button type="button" onClick={addGroup} className="rounded-xl border px-3 py-2 text-sm font-medium">
                  Grup Ekle
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {OPTION_TEMPLATES.map((template) => (
                  <button
                    key={template.label}
                    type="button"
                    onClick={() => applyTemplate(template.group)}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    {template.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                {optionGroups.length === 0 ? <p className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500">Henüz opsiyon grubu yok.</p> : null}

                {optionGroups.map((group, groupIndex) => (
                  <div key={group.id ?? `${groupIndex}`} className="rounded-2xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">Grup {groupIndex + 1}</p>
                        <p className="text-xs text-slate-500">{group.type === 'SINGLE' ? 'Tek seçim' : 'Çoklu seçim'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOptionGroups((current) => current.filter((_, index) => index !== groupIndex))}
                        className="rounded-xl border px-3 py-2 text-xs font-medium text-rose-600"
                      >
                        Sil
                      </button>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <input
                        value={group.name}
                        onChange={(e) => setOptionGroups((current) => current.map((item, index) => (index === groupIndex ? { ...item, name: e.target.value } : item)))}
                        className="w-full rounded-xl border px-3 py-2"
                        placeholder="Grup adı"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={group.type}
                          onChange={(e) =>
                            setOptionGroups((current) =>
                              current.map((item, index) =>
                                index === groupIndex
                                  ? {
                                      ...item,
                                      type: e.target.value === 'MULTIPLE' ? 'MULTIPLE' : 'SINGLE',
                                      maxSelect: e.target.value === 'MULTIPLE' ? item.maxSelect || item.minSelect || '1' : '1',
                                    }
                                  : item,
                              ),
                            )
                          }
                          className="w-full rounded-xl border px-3 py-2"
                        >
                          <option value="SINGLE">Tek seçim</option>
                          <option value="MULTIPLE">Çoklu seçim</option>
                        </select>
                        <input
                          value={group.sortOrder}
                          onChange={(e) => setOptionGroups((current) => current.map((item, index) => (index === groupIndex ? { ...item, sortOrder: e.target.value } : item)))}
                          className="w-full rounded-xl border px-3 py-2"
                          placeholder="Sıra"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={group.minSelect}
                          onChange={(e) => setOptionGroups((current) => current.map((item, index) => (index === groupIndex ? { ...item, minSelect: e.target.value } : item)))}
                          className="w-full rounded-xl border px-3 py-2"
                          placeholder="Min seçim"
                        />
                        <input
                          value={group.maxSelect}
                          onChange={(e) => setOptionGroups((current) => current.map((item, index) => (index === groupIndex ? { ...item, maxSelect: e.target.value } : item)))}
                          className="w-full rounded-xl border px-3 py-2"
                          placeholder="Max seçim"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={group.isRequired}
                          onChange={(e) =>
                            setOptionGroups((current) =>
                              current.map((item, index) =>
                                index === groupIndex
                                  ? {
                                      ...item,
                                      isRequired: e.target.checked,
                                      minSelect: e.target.checked && item.minSelect === '0' ? '1' : item.minSelect,
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                        Zorunlu seçim
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={group.isActive}
                          onChange={(e) => setOptionGroups((current) => current.map((item, index) => (index === groupIndex ? { ...item, isActive: e.target.checked } : item)))}
                        />
                        Aktif
                      </label>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Seçenekler</p>
                        <button type="button" onClick={() => addOption(groupIndex)} className="rounded-xl border px-3 py-1.5 text-xs font-medium">
                          Seçenek Ekle
                        </button>
                      </div>

                      {group.options.map((option, optionIndex) => (
                        <div key={option.id ?? `${groupIndex}-${optionIndex}`} className="grid gap-2 rounded-2xl bg-slate-50 p-3 md:grid-cols-[1fr_100px_92px_92px_72px] md:items-center">
                          <input
                            value={option.name}
                            onChange={(e) =>
                              setOptionGroups((current) =>
                                current.map((item, index) =>
                                  index === groupIndex
                                    ? {
                                        ...item,
                                        options: item.options.map((entry, entryIndex) =>
                                          entryIndex === optionIndex ? { ...entry, name: e.target.value } : entry,
                                        ),
                                      }
                                    : item,
                                ),
                              )
                            }
                            className="w-full rounded-xl border px-3 py-2"
                            placeholder="Seçenek adı"
                          />
                          <input
                            value={option.priceDelta}
                            onChange={(e) =>
                              setOptionGroups((current) =>
                                current.map((item, index) =>
                                  index === groupIndex
                                    ? {
                                        ...item,
                                        options: item.options.map((entry, entryIndex) =>
                                          entryIndex === optionIndex ? { ...entry, priceDelta: e.target.value } : entry,
                                        ),
                                      }
                                    : item,
                                ),
                              )
                            }
                            className="w-full rounded-xl border px-3 py-2"
                            placeholder="Fiyat"
                          />
                          <input
                            value={option.sortOrder}
                            onChange={(e) =>
                              setOptionGroups((current) =>
                                current.map((item, index) =>
                                  index === groupIndex
                                    ? {
                                        ...item,
                                        options: item.options.map((entry, entryIndex) =>
                                          entryIndex === optionIndex ? { ...entry, sortOrder: e.target.value } : entry,
                                        ),
                                      }
                                    : item,
                                ),
                              )
                            }
                            className="w-full rounded-xl border px-3 py-2"
                            placeholder="Sıra"
                          />
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={option.isDefault}
                              onChange={(e) =>
                                setOptionGroups((current) =>
                                  current.map((item, index) =>
                                    index === groupIndex
                                      ? {
                                          ...item,
                                          options: item.options.map((entry, entryIndex) =>
                                            entryIndex === optionIndex ? { ...entry, isDefault: e.target.checked } : entry,
                                          ),
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                            Varsayılan
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setOptionGroups((current) =>
                                current.map((item, index) =>
                                  index === groupIndex
                                    ? { ...item, options: item.options.filter((_, entryIndex) => entryIndex !== optionIndex) }
                                    : item,
                                ),
                              )
                            }
                            className="rounded-xl border px-3 py-2 text-xs font-medium text-rose-600"
                          >
                            Sil
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
