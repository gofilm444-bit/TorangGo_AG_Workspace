import { Injectable, Logger, Optional } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, unlink, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve, dirname, normalize } from 'node:path';
import type {
  PrivateDocumentStorage,
  StoredDocument,
} from './storage.interface.js';

@Injectable()
export class LocalDocumentStorage implements PrivateDocumentStorage {
  private readonly logger = new Logger(LocalDocumentStorage.name);
  private readonly baseDir: string;

  constructor(@Optional() baseDir?: string) {
    this.baseDir = resolve(
      baseDir ||
        process.env.PRIVATE_DOCUMENT_STORAGE_DIR ||
        resolve(process.cwd(), '.private_storage'),
    );
  }

  private resolveSafePath(key: string): string {
    const normalizedKey = normalize(key).replace(/^[/\\]+/, '');
    if (normalizedKey.includes('..') || /[\0]/.test(normalizedKey)) {
      throw new Error(`Path traversal detected in storage key`);
    }
    const fullPath = resolve(this.baseDir, normalizedKey);
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error(`Path escape detected in storage key`);
    }
    return fullPath;
  }

  async put(key: string, data: Buffer, _mimeType: string): Promise<void> {
    const targetPath = this.resolveSafePath(key);
    const parentDir = dirname(targetPath);
    await mkdir(parentDir, { recursive: true });
    await writeFile(targetPath, data);
  }

  async get(key: string): Promise<StoredDocument | null> {
    const targetPath = this.resolveSafePath(key);
    if (!existsSync(targetPath)) {
      return null;
    }
    const fileStat = await stat(targetPath);
    return {
      stream: createReadStream(targetPath),
      sizeBytes: fileStat.size,
    };
  }

  async delete(key: string): Promise<void> {
    const targetPath = this.resolveSafePath(key);
    if (existsSync(targetPath)) {
      try {
        await unlink(targetPath);
      } catch (err: unknown) {
        this.logger.warn(`Failed to unlink storage file: ${targetPath}: ${String(err)}`);
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const targetPath = this.resolveSafePath(key);
    return existsSync(targetPath);
  }
}
