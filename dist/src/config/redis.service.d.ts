import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
export declare class RedisService implements OnModuleDestroy {
    private configService;
    private readonly client;
    private readonly logger;
    private isConnected;
    constructor(configService: ConfigService);
    onModuleDestroy(): Promise<void>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttl?: number): Promise<void>;
    del(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    setJson<T>(key: string, value: T, ttl?: number): Promise<void>;
    getJson<T>(key: string): Promise<T | null>;
    keys(pattern: string): Promise<string[]>;
    flushPattern(pattern: string): Promise<void>;
    getClient(): Redis;
}
