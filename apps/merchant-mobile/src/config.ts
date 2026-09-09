import { resolveClientConfig, type ClientAppConfig } from '@platform/config';

export const merchantConfig: ClientAppConfig = resolveClientConfig({
  audience: 'MERCHANT_APP',
});
