const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    let message = `Request failed: ${response.status}`;

    if (contentType.includes('application/json')) {
      try {
        const body = (await response.json()) as { message?: string };
        if (body?.message) {
          message = body.message;
        }
      } catch {
        // Keep default message when body parsing fails.
      }
    } else {
      try {
        const text = await response.text();
        if (text.trim()) {
          message = text;
        }
      } catch {
        // Keep default message when body parsing fails.
      }
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
