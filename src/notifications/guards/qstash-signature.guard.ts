import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Receiver } from '@upstash/qstash';

@Injectable()
export class QStashSignatureGuard implements CanActivate {
  private readonly logger = new Logger(QStashSignatureGuard.name);
  private readonly receiver: Receiver | null;

  constructor(private readonly configService: ConfigService) {
    const currentSigningKey =
      this.configService.get<string>('QSTASH_CURRENT_SIGNING_KEY') || '';
    const nextSigningKey =
      this.configService.get<string>('QSTASH_NEXT_SIGNING_KEY') || '';

    if (currentSigningKey) {
      // Receiver requires both keys, use empty string if nextSigningKey not provided
      this.receiver = new Receiver({
        currentSigningKey,
        nextSigningKey: nextSigningKey || currentSigningKey, // Use current key as fallback
      });
      this.logger.log('QStash signature verification enabled');
    } else {
      this.receiver = null;
      this.logger.warn(
        'QSTASH_CURRENT_SIGNING_KEY not configured - signature verification disabled',
      );
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip verification if keys not configured (for local testing)
    if (!this.receiver) {
      this.logger.warn('Skipping QStash signature verification');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const headers = request.headers || {};

    try {
      // Get signature from headers (QStash uses 'upstash-signature' header)
      // Try different possible header names
      const signature = 
        headers['upstash-signature'] || 
        headers['x-upstash-signature'] ||
        (Array.isArray(headers['upstash-signature']) 
          ? headers['upstash-signature'][0] 
          : headers['upstash-signature']);
      
      if (!signature) {
        this.logger.error('Missing Upstash-Signature header');
        // For local development, allow requests without signature
        // In production, this should throw
        const isLocal = process.env.NODE_ENV !== 'production';
        if (isLocal) {
          this.logger.warn('Allowing request without signature (local development)');
          return true;
        }
        throw new UnauthorizedException('Missing signature');
      }

      // Get body as string for verification
      const body = JSON.stringify(request.body || {});
      
      // Construct URL from request (Fastify/NestJS compatible)
      // Fastify uses request.url and request.headers.host
      const protocol = 
        (headers['x-forwarded-proto'] as string) || 
        (request.protocol as string) || 
        'https'; // Default to https for production
      const host = (headers.host as string) || (request.hostname as string) || 'localhost';
      const url = request.url || request.originalUrl || '/api/notifications/process';
      const fullUrl = `${protocol}://${host}${url}`;

      this.logger.debug(`Verifying QStash signature for URL: ${fullUrl}`);

      // Verify signature using Receiver
      const isValid = await this.receiver.verify({
        signature: signature as string,
        body,
        url: fullUrl,
      });

      if (!isValid) {
        this.logger.error('Invalid QStash signature');
        throw new UnauthorizedException('Invalid QStash signature');
      }

      this.logger.debug('QStash signature verified successfully');
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('QStash signature verification error:', error);
      // For local development, allow on error (might be signature format issues)
      const isLocal = process.env.NODE_ENV !== 'production';
      if (isLocal) {
        this.logger.warn('Allowing request despite verification error (local development)');
        return true;
      }
      throw new UnauthorizedException('Invalid QStash signature');
    }
  }
}

