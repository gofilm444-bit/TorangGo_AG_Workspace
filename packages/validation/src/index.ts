import { z } from 'zod';

export * from './primitives.schema.js';
export * from './envelope.schema.js';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().optional(),
  uptime: z.number().optional(),
});

export type HealthResponseSchema = z.infer<typeof healthResponseSchema>;

export { z };
