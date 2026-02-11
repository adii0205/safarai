import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { config } from '../config';

let redis: Redis | null = null;

try {
    redis = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            if (times > 3) return null;
            return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
    });

    redis.on('error', (err) => {
        console.warn('Redis connection error (caching disabled):', err.message);
        redis = null;
    });

    redis.connect().catch(() => {
        console.warn('Redis unavailable — running without cache');
        redis = null;
    });
} catch {
    console.warn('Redis initialization failed — running without cache');
}

const CACHE_TTL = 300; // 5 minutes

export function cacheMiddleware(keyPrefix: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!redis) return next();

        const key = `${keyPrefix}:${JSON.stringify(req.query)}:${JSON.stringify(req.body || {})}`;

        try {
            const cached = await redis.get(key);
            if (cached) {
                console.log(`Cache HIT: ${key}`);
                return res.json(JSON.parse(cached));
            }
        } catch {
            console.warn('Cache read failed, proceeding without cache');
        }

        // Override res.json to cache the response
        const originalJson = res.json.bind(res);
        res.json = (body: any) => {
            if (redis && res.statusCode === 200) {
                redis.setex(key, CACHE_TTL, JSON.stringify(body)).catch(() => { });
            }
            return originalJson(body);
        };

        next();
    };
}

export { redis };
