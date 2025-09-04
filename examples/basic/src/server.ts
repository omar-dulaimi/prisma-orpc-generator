import { OpenAPIHandler } from '@orpc/openapi/node';
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins';
import { onError } from '@orpc/server';
import { CORSPlugin } from '@orpc/server/plugins';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import express from 'express';
import * as errorHandling from './generated/orpc/errorHandling';
import { authenticateUser, extractTokenFromHeader, generateToken, verifyToken } from './lib/auth';
import { prisma } from './lib/db';

const app = express();
const port = process.env.PORT || 3001;

async function createContext(req: express.Request) {
  const token = extractTokenFromHeader(req.headers.authorization);
  const userPayload = token ? verifyToken(token) : null;
  
  // Convert UserPayload to User type expected by Context
  const user = userPayload ? {
    id: userPayload.id,
    email: userPayload.email,
    name: userPayload.name,
    roles: userPayload.roles,
  } : undefined;

  return {
    prisma,
    user,
    request: {
      headers: req.headers as Record<string, string>,
    },
  };
}

// Use dynamic import for the router to avoid static import issues
const routerModule = await import('./generated/orpc/routers/index');
const router = routerModule.appRouter;

// Set up OpenAPI handler from oRPC (OpenAPI HTTP routing)
const openapi = new OpenAPIHandler(router, {
  plugins: [
    new CORSPlugin(),
    // Serve OpenAPI spec and reference docs at /api/spec.json (relative to the mounted /api)
    new OpenAPIReferencePlugin({
      specPath: '/spec.json',
      docsPath: '/docs',
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: 'oRPC Playground',
          version: '1.0.0',
        },
      },
    }),
  ],
  interceptors: [onError(errorHandling.prismaErrorMapper)],
});

// Debug: Log OpenAPI handler info
console.log('OpenAPI handler created');

// Parse JSON bodies for auth endpoints
app.use(express.json());

// Add custom auth endpoints before oRPC handler
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await authenticateUser(email, password);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        token,
      },
      meta: {
        authToken: token,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate token endpoint for testing
app.post('/auth/generate-token', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate token for testing
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        token,
      },
      meta: {
        authToken: token,
        operation: 'generate-token',
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const handleAPIRequest = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const id = (res as any).locals?.reqId || 'no-id';
  console.log(`[API ${id}] dispatch -> ${req.method} ${req.originalUrl}`);
  console.log(
    `[API ${id}] pre-handle: headersSent=${res.headersSent} ended=${(res as any).writableEnded === true}`
  );

  try {
    // Pass /api prefix to the handler since we're not using Express mounting
    const result = await openapi.handle(req, res, {
      prefix: '/',
      context: await createContext(req),
    });
    const matched = (result as any)?.matched === true;
    console.log(`[API ${id}] matched=${matched}, result:`, result);
    console.log(
      `[API ${id}] post-handle: headersSent=${res.headersSent} ended=${(res as any).writableEnded === true}`
    );
    if (!matched) return next();
  } catch (e) {
    console.error(`[API ${id}] error`, e);
    // Error handling is now centralized at the base procedure level
    return next(e as any);
  } finally {
    console.log(`[API ${id}] complete`);
  }
};

// Handle all / requests
app.all('/*', handleAPIRequest);

/* CORS and body parsers are applied above the /api handler for proper processing */

app.get('/', (_req, res) => {
  res.json({
    message: 'example is up',
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
