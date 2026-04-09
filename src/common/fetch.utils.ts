export const DEFAULT_FETCH_TIMEOUT_MS = 8000;

export const fetchWithTimeout = async <T>(
  url: string,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
  options: RequestInit = {},
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchJsonWithTimeout = async <T>(
  url: string,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<T> => {
  return fetchWithTimeout<T>(url, timeoutMs);
};
