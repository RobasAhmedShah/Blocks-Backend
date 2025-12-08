// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastify from 'fastify';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

// Suppress punycode deprecation warning (coming from dependencies)
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
    // Suppress punycode deprecation warnings from dependencies
    return;
  }
  // Show other warnings normally
  console.warn(warning.name, warning.message);
});


let cachedApp: NestFastifyApplication | null = null;

async function createNestApp(): Promise<NestFastifyApplication> {
  if (cachedApp) return cachedApp;

  const fastifyInstance = fastify({ 
    logger: false,
    bodyLimit: 20 * 1024 * 1024, // 20MB - allows base64 encoded images in JSON body
  });

  // Register multipart plugin for file uploads
  // This is required for Express interceptors to work with Fastify
  await fastifyInstance.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB - increased to match body limit
    },
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(fastifyInstance),
    {
      snapshot: true,
    }
  );

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  
  // Add global exception filter for better error logging
  app.useGlobalFilters(new AllExceptionsFilter());
  
  // Comprehensive CORS configuration for production deployment
  app.enableCors({
    origin: true, // Allow all origins in production
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'Accept', 
      'Origin', 
      'X-Requested-With',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods'
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  });

  // Additional CORS handling for serverless environments
  const fastifyApp = app.getHttpAdapter().getInstance();
  fastifyApp.addHook('onRequest', async (request, reply) => {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
      reply.header('Access-Control-Max-Age', '86400');
      reply.code(204).send();
      return;
    }
    
    // Add CORS headers to all responses
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  });

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  cachedApp = app;
  return app;
}

// Default export for Vercel serverless function
export default async function handler(req: any, res: any) {
  // Handle CORS preflight requests at the serverless level
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }

  const app = await createNestApp();
  const fastifyInstance = app.getHttpAdapter().getInstance();

  // Add CORS headers to all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  
  injectSpeedInsights();

  // Forward request to Fastify server
  fastifyInstance.server.emit('request', req, res);
}

// Also, bootstrap locally if not in production (optional)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  async function bootstrap() {
    try {
      console.log('Starting backend server...');
      const app = await createNestApp();
      console.log('App created, starting to listen...');
      await app.listen(process.env.PORT || 3000, '0.0.0.0');
      console.log(`🚀 App listening on port ${process.env.PORT || 3000}`);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
  bootstrap().catch((error) => {
    console.error('Bootstrap error:', error);
    process.exit(1);
  });
}
