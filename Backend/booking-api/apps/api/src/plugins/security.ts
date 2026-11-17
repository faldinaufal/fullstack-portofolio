import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

export interface SecurityOptions {
  /** Exact origins of the three Tempora apps. No wildcards: cookies travel with requests. */
  allowedOrigins: string[];
}

/** Security headers (FSD 8.3) and a strict CORS allow-list for the three apps. */
export async function registerSecurity(app: FastifyInstance, { allowedOrigins }: SecurityOptions) {
  await app.register(helmet, {
    // The API returns JSON only; Swagger UI at /v1/docs ships its own inline assets.
    contentSecurityPolicy: false,
    frameguard: { action: 'deny' },
  });

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key', 'If-Match', 'X-CSRF-Token', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });
}
