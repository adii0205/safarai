import { Router, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config';
import { cacheMiddleware } from '../middleware/cache';

const router = Router();

// Photon (OpenStreetMap) Places Autocomplete - FAST & Free
// Photon is 10x faster than Nominatim and uses same OSM data
router.get('/autocomplete', cacheMiddleware('places'), async (req: Request, res: Response) => {
    try {
        const { query } = req.query;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query parameter is required' });
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
                        timeout: 5000,
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
