export interface IdempotencyRecord {
  fingerprint: string;
  statusCode: number;
  responseBody: unknown;
  createdAt: number;
}

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | undefined> | IdempotencyRecord | undefined;
  set(key: string, record: IdempotencyRecord): Promise<void> | void;
  delete?(key: string): Promise<void> | void;
}

export const IDEMPOTENCY_STORE_TOKEN = Symbol('IdempotencyStore');