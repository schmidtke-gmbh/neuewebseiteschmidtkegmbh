export class UpstreamError extends Error {
  constructor(service, operation, status, cause) {
    super(`${service} ${operation} failed${status ? ` with HTTP ${status}` : ''}`, cause ? { cause } : undefined);
    this.name = 'UpstreamError';
    this.service = service;
    this.operation = operation;
    if (status) this.status = status;
  }
}

export async function fetchWithTimeout(fetchImpl, url, options, { service, operation, timeoutMs }) {
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal });
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError(service, operation, undefined, error);
  }
}
