import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // Google
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',

    // OpenRouteService
    orsApiKey: process.env.ORS_API_KEY || '',

    // RapidAPI
    rapidApiKey: process.env.RAPIDAPI_KEY || '',

    // Amadeus
    amadeusClientId: process.env.AMADEUS_CLIENT_ID || '',
    amadeusClientSecret: process.env.AMADEUS_CLIENT_SECRET || '',

    // Supabase
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',

    // Redis
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

    // ML Service
    mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
};
