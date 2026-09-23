import type { Readable } from 'node:stream';

export const PRIVATE_DOCUMENT_STORAGE = Symbol('PRIVATE_DOCUMENT_STORAGE');

export interface StoredDocument {
  stream: Readable;
  sizeBytes?: number;
  mimeType?: string;
}

export interface PrivateDocumentStorage {
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<StoredDocument | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
