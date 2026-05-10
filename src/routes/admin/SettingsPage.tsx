import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createAdminPromotion, getAdminPromotions, getAdminSettings, updateAdminPromotion, updateAdminSettings, type PromotionDto, type RestaurantSettingsDto } from '../../api/admin-settings';
import { requireAdminSecret } from '../../api/admin-auth';
import { adminButtonClass, adminPageClass, adminSecondaryButtonClass, adminSectionClass } from './admin-theme';

export function SettingsPage() {
  const [settings, setSettings] = useState<RestaurantSettingsDto | null>(null);
  const [promotions, setPromotions] = useState<PromotionDto[]>([]);
  const [promoName, setPromoName] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoValue, setPromoValue] = useState('10');

  const refresh = async () => {
    setSettings(await getAdminSettings());
    setPromotions(await getAdminPromotions());
  };

  useEffect(() => {
    requireAdminSecret();
    void refresh();
  }, []);

  return (
    <main className={adminPageClass}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-700">Admin / Ayarlar</p>
          <h1 className="mt-2 text-3xl font-semibold">Servis Ücreti ve Kampanyalar</h1>
        </div>
        <Link to="/admin/dashboard" className={adminSecondaryButtonClass}>Dashboard</Link>
      </div>

      <section className={adminSectionClass}>
        <h2 className="text-lg font-semibold">Servis Ücreti</h2>
        {settings ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="text-sm">Aktif
              <input type="checkbox" checked={settings.isServiceFeeEnabled} onChange={(e) => setSettings({ ...settings, isServiceFeeEnabled: e.target.checked })} className="ml-2" />
            </label>
            <select value={settings.serviceFeeType} onChange={(e) => setSettings({ ...settings, serviceFeeType: e.target.value as 'PERCENT' | 'FIXED' })} className="rounded-xl border px-3 py-2">
              <option value="PERCENT">Yüzde</option>
              <option value="FIXED">Sabit</option>
            </select>
            <input value={String(settings.serviceFeeValue)} onChange={(e) => setSettings({ ...settings, serviceFeeValue: e.target.value })} className="rounded-xl border px-3 py-2" />
            <button type="button" onClick={() => void updateAdminSettings(settings).then(setSettings)} className={adminButtonClass}>Kaydet</button>
          </div>
        ) : null}
      </section>

      <section className={adminSectionClass}>
        <h2 className="text-lg font-semibold">Kampanya / Kupon</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input value={promoName} onChange={(e) => setPromoName(e.target.value)} placeholder="Kampanya adı" className="rounded-xl border px-3 py-2" />
          <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Kupon kodu" className="rounded-xl border px-3 py-2" />
          <input value={promoValue} onChange={(e) => setPromoValue(e.target.value)} placeholder="İndirim" className="rounded-xl border px-3 py-2" />
          <button type="button" onClick={() => void createAdminPromotion({ name: promoName, code: promoCode || undefined, discountType: 'PERCENT', discountValue: Number(promoValue), minOrderAmount: 0, isActive: true }).then(refresh)} className={adminButtonClass}>Ekle</button>
        </div>
        <div className="mt-4 space-y-2">
          {promotions.map((promotion) => (
            <div key={promotion.id} className="flex items-center justify-between rounded-2xl border bg-white/80 px-4 py-3 text-sm">
              <span>{promotion.name} {promotion.code ? `(${promotion.code})` : ''} - {String(promotion.discountValue)}%</span>
              <button type="button" onClick={() => void updateAdminPromotion(promotion.id, { isActive: !promotion.isActive }).then(refresh)} className={adminSecondaryButtonClass}>
                {promotion.isActive ? 'Pasifleştir' : 'Aktifleştir'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
