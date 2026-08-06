// Extracts a human-readable message from an unknown thrown value — most
// commonly an axios error shaped like { response: { data: { error | message } } }
// — without resorting to `any`, so call sites can type catch params as `unknown`.
export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (error && typeof error === 'object') {
    if ('response' in error) {
      const response = (error as { response?: unknown }).response;
      if (response && typeof response === 'object' && 'data' in response) {
        const data = (response as { data?: unknown }).data;
        if (data && typeof data === 'object') {
          const { error: dataError, message: dataMessage } = data as { error?: unknown; message?: unknown };
          if (typeof dataError === 'string') return dataError;
          if (typeof dataMessage === 'string') return dataMessage;
        }
      }
    }
    if ('message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
  }
  return fallback;
}
