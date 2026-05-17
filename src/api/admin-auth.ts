const LEGACY_ADMIN_SECRET_KEY = 'admin_secret';
const ADMIN_SECRET_KEY = 'admin_secret_v2';
const ADMIN_SESSION_KEY = 'admin_unlocked';
const ADMIN_PROMPT_KEY = 'admin_prompt_seen';
let adminPromptShown = false;

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
  adminPromptShown = false;
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(ADMIN_PROMPT_KEY);
}

export function hasAdminSession() {
  return Boolean(getAdminSecret()) && sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
}

export function requireAdminSecret() {
  removeLegacyAdminSecret();
  const existing = getAdminSecret();
  if (existing && sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true') {
    return existing;
  }

  if (adminPromptShown || sessionStorage.getItem(ADMIN_PROMPT_KEY) === 'true') return '';
  adminPromptShown = true;
  sessionStorage.setItem(ADMIN_PROMPT_KEY, 'true');

  const next = window.prompt('Admin şifresini girin');
  if (!next?.trim()) {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    return '';
  }

  setAdminSecret(next.trim());
  return next.trim();
}
