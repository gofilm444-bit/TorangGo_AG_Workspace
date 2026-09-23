import { Module, Global } from '@nestjs/common';
import { PRIVATE_DOCUMENT_STORAGE } from './storage.interface.js';
import { LocalDocumentStorage } from './local-document-storage.js';

@Global()
@Module({
  providers: [
    {
      provide: PRIVATE_DOCUMENT_STORAGE,
      useFactory: () => new LocalDocumentStorage(),
    },
    {
      provide: LocalDocumentStorage,
      useFactory: () => new LocalDocumentStorage(),
    },
  ],
  exports: [PRIVATE_DOCUMENT_STORAGE, LocalDocumentStorage],
})
export class StorageModule {}
