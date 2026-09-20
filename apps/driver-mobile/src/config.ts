import { resolveClientConfig, type ClientAppConfig } from '@platform/config';

export const driverConfig: ClientAppConfig = resolveClientConfig({
  audience: 'DRIVER_APP',
});
