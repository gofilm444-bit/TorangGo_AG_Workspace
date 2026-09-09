import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const IDEMPOTENT_METADATA_KEY = 'TORANGGO_IDEMPOTENT';

/**
 * Opt-in decorator for critical command routes that require Idempotency-Key handling.
 */
export const Idempotent = (): CustomDecorator<string> => SetMetadata(IDEMPOTENT_METADATA_KEY, true);