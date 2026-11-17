import { randomUUID } from 'node:crypto';
import Fastify, { LogController } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Env } from './config/env.js';
import type { HealthRepository } from './modules/health/repository.js';
import { healthRoutes } from './modules/health/routes.js';
import { createHealthService } from './modules/health/service.js';
import { registerErrorHandling } from './plugins/errors.js';
import { registerOpenApi } from './plugins/openapi.js';
import { registerSecurity } from './plugins/security.js';

/**
 * Everything the app needs from the outside world. `server.ts` passes real implementations;
 * tests pass fakes. This keeps the app testable without a database or network.
 */
export interface AppDependencies {
  env: Pick<Env, 'LOG_LEVEL' | 'APP_VERSION' | 'PORTAL_URL' | 'CONSOLE_URL' | 'ADMIN_URL'>;
  healthRepository: HealthRepository;
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export async function buildApp({ env, healthRepository }: AppDependencies) {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      // Never write credentials to the logs (FSD 8.3).
      redact: {
        paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
        censor: '[redacted]',
      },
    },
    // Reuse the caller's X-Request-Id when it is safe, otherwise create one. The same ID
    // is returned in the response, attached to every log line and shown in error bodies.
    genReqId: (request) => {
      const incoming = request.headers['x-request-id'];
      return typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
        ? incoming
        : randomUUID();
    },
    logController: new LogController({ requestIdLogLabel: 'requestId' }),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  registerErrorHandling(app);
  await registerSecurity(app, {
    allowedOrigins: [env.PORTAL_URL, env.CONSOLE_URL, env.ADMIN_URL],
  });
  await registerOpenApi(app, { version: env.APP_VERSION });

  await app.register(healthRoutes, {
    service: createHealthService({ repository: healthRepository, version: env.APP_VERSION }),
  });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
