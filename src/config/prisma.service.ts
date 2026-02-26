import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    const connectionLimit = parseInt(
      configService.get<string>('DATABASE_POOL_SIZE') || '10',
      10,
    );
    const poolTimeout = parseInt(
      configService.get<string>('DATABASE_POOL_TIMEOUT') || '10',
      10,
    );

    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
      datasources: {
        db: {
          url: `${configService.get<string>('DATABASE_URL')}&connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`,
        },
      },
    });
  }

  async onModuleInit() {
    (this as any).$on('warn', (e: any) => {
      this.logger.warn(`Prisma warning: ${e.message}`);
    });
    (this as any).$on('error', (e: any) => {
      this.logger.error(`Prisma error: ${e.message}`);
    });

    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting database...');
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
