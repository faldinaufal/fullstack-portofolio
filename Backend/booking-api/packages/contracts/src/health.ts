import { z } from 'zod';

/** `GET /health`: the API process is running. */
export const HealthResponseSchema = z
  .object({
    status: z.literal('ok'),
    service: z.literal('tempora-api'),
    version: z.string(),
    time: z.iso.datetime(),
  })
  .meta({ id: 'HealthResponse' });

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ReadinessCheckSchema = z.object({
  name: z.string(),
  ok: z.boolean(),
  detail: z.string().optional(),
});

export type ReadinessCheck = z.infer<typeof ReadinessCheckSchema>;

/** `GET /health/ready`: the API can serve traffic (database reachable, migrations applied). */
export const ReadinessResponseSchema = z
  .object({
    status: z.enum(['ready', 'not_ready']),
    checks: z.array(ReadinessCheckSchema),
  })
  .meta({ id: 'ReadinessResponse' });

export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
