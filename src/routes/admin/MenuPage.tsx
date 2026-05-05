// src/routes/admin/MenuPage.tsx
const items = [
  { name: 'Lahmacun', price: 65 },
  { name: 'Ayran', price: 20 },
  { name: 'Künefe', price: 95 },
];

export function MenuPage() {
  return (
    <main className="mx-auto min-h-full max-w-3xl p-4 md:p-8">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold">Menü Yönetimi</h1>
        <div className="mt-6 space-y-3">
          {items.map((item) => (
            <div key={item.name} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <span className="font-medium">{item.name}</span>
              <span>{item.price} TL</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
