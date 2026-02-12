const API_BASE = '/api/v1';

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      // Session expired — clear auth state and redirect to login
      const { useAuthStore } = await import('../stores/auth');
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
    }

    const body = await res.json().catch(() => ({}));
    const error = body.error ?? {};
    throw new ApiError(res.status, error.code ?? 'UNKNOWN_ERROR', error.message ?? res.statusText);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', ...(data ? { body: JSON.stringify(data) } : {}) }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export { ApiError };
