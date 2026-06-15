export type StartupTimeoutCode = 'SESSION_TIMEOUT' | 'PROFILE_TIMEOUT' | 'NETWORK_TIMEOUT';

export class OperationTimeoutError extends Error {
  readonly code: StartupTimeoutCode;

  constructor(code: StartupTimeoutCode, timeoutMs: number) {
    super(`${code} after ${timeoutMs}ms`);
    this.name = 'OperationTimeoutError';
    this.code = code;
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  code: StartupTimeoutCode
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new OperationTimeoutError(code, timeoutMs)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export function isOperationTimeoutError(
  error: unknown,
  code?: StartupTimeoutCode
): error is OperationTimeoutError {
  return error instanceof OperationTimeoutError && (!code || error.code === code);
}
