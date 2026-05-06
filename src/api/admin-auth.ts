const ADMIN_SECRET_KEY = 'admin_secret';
const ENV_ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET ?? '';

export function getAdminSecret() {
  return localStorage.getItem(ADMIN_SECRET_KEY) ?? ENV_ADMIN_SECRET;
}

export function setAdminSecret(secret: string) {
  localStorage.setItem(ADMIN_SECRET_KEY, secret);
}

export function clearAdminSecret() {
  localStorage.removeItem(ADMIN_SECRET_KEY);
}

export function requireAdminSecret() {
  const secret = getAdminSecret();
  if (!secret) {
    const next = window.prompt('Admin secret girin');
    if (next) setAdminSecret(next);
    return next ?? '';
  }

  if (!localStorage.getItem(ADMIN_SECRET_KEY) && ENV_ADMIN_SECRET) {
    setAdminSecret(ENV_ADMIN_SECRET);
  }

  return secret;
}
