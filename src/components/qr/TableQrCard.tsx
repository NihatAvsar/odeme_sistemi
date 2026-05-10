import { QRCodeCanvas } from 'qrcode.react';

type TableQrCardProps = {
  tableCode: string;
  tableName?: string | null;
  restaurantName?: string | null;
  url: string;
  canvasId?: string;
};

export function TableQrCard({ tableCode, tableName, restaurantName, url, canvasId }: TableQrCardProps) {
  return (
    <div className="table-qr-card rounded-3xl border border-slate-200 bg-white p-5 text-center text-slate-900 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">{restaurantName ?? 'Restoran'}</p>
      <h2 className="mt-2 text-2xl font-semibold">Masa {tableCode}</h2>
      <p className="mt-1 text-sm text-slate-500">{tableName ?? 'QR Menü ve Ödeme'}</p>
      <div className="mx-auto mt-5 flex w-fit rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <QRCodeCanvas id={canvasId} value={url} size={192} level="H" includeMargin />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-700">Menüyü görmek ve ödeme yapmak için okutun</p>
      <p className="mt-3 break-all rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">{url}</p>
    </div>
  );
}
