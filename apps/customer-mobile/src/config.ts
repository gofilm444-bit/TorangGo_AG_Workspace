import { resolveClientConfig, type ClientAppConfig } from '@platform/config';

export const customerConfig: ClientAppConfig = resolveClientConfig({
  audience: 'CUSTOMER_APP',
});
