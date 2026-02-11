import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // Geolocation Options (choose one):
    // Option 1: Nominatim (slower, free, no auth needed)
    nominatimUrl: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
    
    // Option 2: Photon (FAST alternative to Nominatim, free, recommended!)
    // Photon is ~10x faster than Nominatim and uses same OSM data
    photonUrl: process.env.PHOTON_URL || 'https://photon.komoot.io',
    
    // Option 3: Pelias (self-hosted, fastest when local)
    peliasUrl: process.env.PELIAS_URL || 'http://localhost:4000',
    
    // Geolocation provider (default: 'photon' for speed)
    geocoderProvider: process.env.GEOCODER_PROVIDER || 'photon',

    // OpenRouteService - Free tier available
    orsApiKey: process.env.ORS_API_KEY || '',
    orsUrl: process.env.ORS_URL || 'https://api.openrouteservice.org',

    // Supabase
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',

    // Redis
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

    // ML Service
    mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
};
