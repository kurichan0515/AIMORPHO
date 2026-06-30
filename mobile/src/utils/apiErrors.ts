export const isLimitError = (err: unknown): boolean =>
  (err as any)?.response?.status === 429;
