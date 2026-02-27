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
    const databaseUrl = configService.get<string>('DATABASE_URL') || '';

    // Ensure schema=public is explicitly set for PgBouncer compatibility
    let url = databaseUrl;
    if (!url.includes('schema=')) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}schema=public`;
    }

    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
      datasources: {
        db: { url },
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

    // Diagnostic: verify PgBouncer routes to the correct database/schema
    try {
      const result: any[] = await this.$queryRaw`
        SELECT current_database() as db, current_schema() as schema,
        (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as public_tables
      `;
      this.logger.log(
        `DB diagnostic: database=${result[0]?.db}, schema=${result[0]?.schema}, public_tables=${result[0]?.public_tables}`,
      );
    } catch (e) {
      this.logger.error(`DB diagnostic failed: ${(e as Error).message}`);
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting database...');
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
