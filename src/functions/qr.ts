export function getPublicAppUrl() {
  return import.meta.env.VITE_PUBLIC_APP_URL ?? window.location.origin;
}

export function getTableQrUrl(tableCode: string) {
  return `${getPublicAppUrl().replace(/\/$/, '')}/table/${tableCode}`;
}

export function downloadCanvasPng(canvas: HTMLCanvasElement, fileName: string) {
  const link = document.createElement('a');
  link.download = fileName;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
