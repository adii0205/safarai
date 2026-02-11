import { Router, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config';
import { cacheMiddleware } from '../middleware/cache';

const router = Router();

// Hardcoded major Indian cities for instant 0ms lookup
const MAJOR_INDIAN_CITIES: Record<string, {osm_id: string; name: string; state: string; lat: number; lng: number}> = {
    'mumbai': { osm_id: '296404', name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777 },
    'delhi': { osm_id: '1951807', name: 'Delhi', state: 'New Delhi', lat: 28.6139, lng: 77.2090 },
    'bangalore': { osm_id: '588409', name: 'Bangalore', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
    'pune': { osm_id: '1251134', name: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567 },
    'hyderabad': { osm_id: '1256394', name: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867 },
    'jaipur': { osm_id: '1271904', name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873 },
    'kolkata': { osm_id: '1206616', name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
    'goa': { osm_id: '2824844', name: 'Goa', state: 'Goa', lat: 15.2993, lng: 73.8243 },
    'ahmedabad': { osm_id: '2825049', name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 },
    'lucknow': { osm_id: '2829606', name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462 },
    'ayodhya': { osm_id: '1276145', name: 'Ayodhya', state: 'Uttar Pradesh', lat: 26.8124, lng: 82.1895 },
    'varanasi': { osm_id: '1207488', name: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3209, lng: 82.9789 },
    'indore': { osm_id: '1273865', name: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lng: 75.8577 },
    'bhopal': { osm_id: '2826821', name: 'Bhopal', state: 'Madhya Pradesh', lat: 23.1815, lng: 79.9864 },
    'nagpur': { osm_id: '1252118', name: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lng: 79.0882 },
    'chandigarh': { osm_id: '1858482', name: 'Chandigarh', state: 'Chandigarh', lat: 30.7333, lng: 76.7794 },
    'amritsar': { osm_id: '1267827', name: 'Amritsar', state: 'Punjab', lat: 31.6340, lng: 74.8711 },
    'surat': { osm_id: '2825068', name: 'Surat', state: 'Gujarat', lat: 21.1702, lng: 72.8311 },
    'visakhapatnam': { osm_id: '1277920', name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6869, lng: 83.2185 },
};

// Photon (OpenStreetMap) Places Autocomplete - FAST & Free
// Photon is 10x faster than Nominatim and uses same OSM data
router.get('/autocomplete', cacheMiddleware('places'), async (req: Request, res: Response) => {
    try {
        const { query } = req.query;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        // Check hardcoded cities first for instant response (0ms)
        const queryLower = query.toLowerCase().trim();
        const majorCityMatches = Object.entries(MAJOR_INDIAN_CITIES)
            .filter(([key, _]) => key.includes(queryLower) || MAJOR_INDIAN_CITIES[key].name.toLowerCase().includes(queryLower))
            .slice(0, 5)
            .map(([_, city]) => ({
                placeId: city.osm_id,
                description: `${city.name}, ${city.state}`,
                mainText: city.name,
                secondaryText: city.state,
            }));
        
        if (majorCityMatches.length > 0) {
            return res.json({ predictions: majorCityMatches });
        }

        let predictions: any[] = [];

        try {
            // Try Photon first (FAST - 10x faster than Nominatim)
            if (config.geocoderProvider === 'photon' || config.geocoderProvider === 'default') {
                const response = await axios.get(
                    `${config.photonUrl}/api`,
                    {
                        params: {
                            q: query,
                            limit: 10,
                            bbox: [68.19, 8.06, 97.41, 35.51], // India bounding box
                        },
                        timeout: 3000, // Optimized: reduced from 5000ms for faster Photon response
                    }
                );

                predictions = response.data.features.map((place: any) => ({
                    placeId: place.properties.osm_id.toString(),
                    description: place.properties.name,
                    mainText: place.properties.name,
                    secondaryText: place.properties.state || place.properties.country || '',
                }));
            } else {
                // Fallback to Nominatim if Photon fails
                const response = await axios.get(
                    `${config.nominatimUrl}/search`,
                    {
                        params: {
                            q: query,
                            format: 'json',
                            countrycodes: 'in',
                            limit: 10,
                            addressdetails: 1,
                        },
                        headers: {
                            'User-Agent': 'SafarAI-Backend/1.0',
                        },
                        timeout: 10000,
                    }
                );

                predictions = response.data.map((place: any) => ({
                    placeId: place.osm_id.toString(),
                    description: place.display_name,
                    mainText: place.name || place.display_name.split(',')[0],
                    secondaryText: place.address?.state || place.address?.state_district || '',
                }));
            }
        } catch (primaryError: any) {
            // If primary provider fails, try alternative
            try {
                const fallbackResponse = await axios.get(
                    `${config.nominatimUrl}/search`,
                    {
                        params: {
                            q: query,
                            format: 'json',
                            countrycodes: 'in',
                            limit: 10,
                            addressdetails: 1,
                        },
                        headers: {
                            'User-Agent': 'SafarAI-Backend/1.0',
                        },
                        timeout: 10000,
                    }
                );

                predictions = fallbackResponse.data.map((place: any) => ({
                    placeId: place.osm_id.toString(),
                    description: place.display_name,
                    mainText: place.name || place.display_name.split(',')[0],
                    secondaryText: place.address?.state || place.address?.state_district || '',
                }));
            } catch (fallbackError: any) {
                console.error('Both geocoding services failed:', primaryError.message, fallbackError.message);
            }
        }

        res.json({ predictions: predictions || [] });
    } catch (error: any) {
        console.error('Places autocomplete error:', error.message);
        res.json({ predictions: [] });
    }
});

// Get place details (lat/lng) - Support both Photon and Nominatim
router.get('/details', cacheMiddleware('place-details'), async (req: Request, res: Response) => {
    try {
        const { placeId, name } = req.query;

        if (!placeId || typeof placeId !== 'string') {
            return res.status(400).json({ error: 'placeId is required' });
        }

        // Instant lookup for major Indian cities (0ms response)
        if (name && typeof name === 'string') {
            const cityKey = name.toLowerCase().trim();
            if (MAJOR_INDIAN_CITIES[cityKey]) {
                const city = MAJOR_INDIAN_CITIES[cityKey];
                return res.json({
                    name: city.name,
                    formattedAddress: `${city.name}, ${city.state}, India`,
                    lat: city.lat,
                    lng: city.lng,
                });
            }
        }

        let place: any = null;

        // Try multiple methods to get place details
        try {
            // Method 1: Use Nominatim lookup by OSM ID (primary method)
            const nomResponse = await axios.get(
                `${config.nominatimUrl}/lookup`,
                {
                    params: {
                        osm_ids: `N${placeId}`,
                        format: 'json',
                        addressdetails: 1,
                    },
                    headers: {
                        'User-Agent': 'SafarAI-Backend/1.0',
                    },
                    timeout: 8000,
                }
            );

            if (nomResponse.data && nomResponse.data.length > 0) {
                place = nomResponse.data[0];
            }
        } catch (nomError) {
            console.log('Nominatim lookup failed, trying Photon reverse geocoding...');
        }

        // Method 2: Fallback - Use Photon reverse geocoding if name is provided
        if (!place && name) {
            try {
                const photonResponse = await axios.get(
                    `${config.photonUrl}/api`,
                    {
                        params: {
                            q: name,
                            limit: 1,
                            bbox: [68.19, 8.06, 97.41, 35.51], // India bounding box
                        },
                        timeout: 5000,
                    }
                );

                if (photonResponse.data.features && photonResponse.data.features.length > 0) {
                    const feature = photonResponse.data.features[0];
                    place = {
                        name: feature.properties.name,
                        display_name: feature.properties.name,
                        lat: feature.geometry.coordinates[1],
                        lon: feature.geometry.coordinates[0],
                    };
                }
            } catch (photonError) {
                console.log('Photon reverse geocoding failed');
            }
        }

        // Method 3: Fallback - Nominatim reverse search by name
        if (!place && name) {
            try {
                const searchResponse = await axios.get(
                    `${config.nominatimUrl}/search`,
                    {
                        params: {
                            q: name,
                            format: 'json',
                            countrycodes: 'in',
                            limit: 1,
                            addressdetails: 1,
                        },
                        headers: {
                            'User-Agent': 'SafarAI-Backend/1.0',
                        },
                        timeout: 10000,
                    }
                );

                if (searchResponse.data && searchResponse.data.length > 0) {
                    place = searchResponse.data[0];
                }
            } catch (searchError) {
                console.log('Nominatim search failed');
            }
        }

        if (place) {
            return res.json({
                name: place.name || name || 'Location',
                formattedAddress: place.display_name || name || 'India',
                lat: parseFloat(place.lat),
                lng: parseFloat(place.lon),
            });
        }

        // If all methods fail, return error response
        return res.status(404).json({
            error: 'Place details not found',
            fallback: {
                name: name || 'Unknown Location',
                formattedAddress: name || 'India',
                lat: 20.5937,
                lng: 78.9629,
            }
        });
    } catch (error: any) {
        console.error('Place details error:', error.message);
        // Return fallback location to prevent UI breaking
        res.json({
            name: 'Location',
            formattedAddress: 'India',
            lat: 20.5937,
            lng: 78.9629,
        });
    }
});

export default router;
