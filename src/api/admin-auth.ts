const LEGACY_ADMIN_SECRET_KEY = 'admin_secret';
const ADMIN_SECRET_KEY = 'admin_secret_v2';
const ADMIN_SESSION_KEY = 'admin_unlocked';

function removeLegacyAdminSecret() {
  localStorage.removeItem(LEGACY_ADMIN_SECRET_KEY);
}

export function getAdminSecret() {
  removeLegacyAdminSecret();
  return localStorage.getItem(ADMIN_SECRET_KEY) ?? '';
}

export function setAdminSecret(secret: string) {
  localStorage.setItem(ADMIN_SECRET_KEY, secret);
  sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
}

export function clearAdminSecret() {
  removeLegacyAdminSecret();
  localStorage.removeItem(ADMIN_SECRET_KEY);
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export function requireAdminSecret() {
  removeLegacyAdminSecret();
  const existing = getAdminSecret();
  if (existing && sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true') {
    return existing;
  }

  const next = window.prompt('Admin şifresini girin');
  if (!next) {
    clearAdminSession();
    return '';
  }

  setAdminSecret(next);
  return next;
}
