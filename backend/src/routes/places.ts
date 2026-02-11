import { Router, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config';
import { cacheMiddleware } from '../middleware/cache';

const router = Router();

// Google Places Autocomplete - restricted to India
router.get('/autocomplete', cacheMiddleware('places'), async (req: Request, res: Response) => {
    try {
        const { query } = req.query;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        if (!config.googleMapsApiKey) {
            // Fallback data for testing without API key
            const fallbackCities = [
                { description: 'Mumbai, Maharashtra, India', place_id: 'place_mumbai', main_text: 'Mumbai', secondary_text: 'Maharashtra, India' },
                { description: 'Delhi, India', place_id: 'place_delhi', main_text: 'Delhi', secondary_text: 'India' },
                { description: 'Bangalore, Karnataka, India', place_id: 'place_bangalore', main_text: 'Bangalore', secondary_text: 'Karnataka, India' },
                { description: 'Pune, Maharashtra, India', place_id: 'place_pune', main_text: 'Pune', secondary_text: 'Maharashtra, India' },
                { description: 'Chennai, Tamil Nadu, India', place_id: 'place_chennai', main_text: 'Chennai', secondary_text: 'Tamil Nadu, India' },
                { description: 'Kolkata, West Bengal, India', place_id: 'place_kolkata', main_text: 'Kolkata', secondary_text: 'West Bengal, India' },
                { description: 'Hyderabad, Telangana, India', place_id: 'place_hyderabad', main_text: 'Hyderabad', secondary_text: 'Telangana, India' },
                { description: 'Jaipur, Rajasthan, India', place_id: 'place_jaipur', main_text: 'Jaipur', secondary_text: 'Rajasthan, India' },
                { description: 'Ahmedabad, Gujarat, India', place_id: 'place_ahmedabad', main_text: 'Ahmedabad', secondary_text: 'Gujarat, India' },
                { description: 'Goa, India', place_id: 'place_goa', main_text: 'Goa', secondary_text: 'India' },
            ];

            const filtered = fallbackCities.filter(c =>
                c.main_text.toLowerCase().includes((query as string).toLowerCase())
            );

            return res.json({
                predictions: filtered.map(p => ({
                    placeId: p.place_id,
                    description: p.description,
                    mainText: p.main_text,
                    secondaryText: p.secondary_text,
                }))
            });
        }

        const response = await axios.get(
            'https://maps.googleapis.com/maps/api/place/autocomplete/json',
            {
                params: {
                    input: query,
                    key: config.googleMapsApiKey,
                    components: 'country:in', // Restrict to India
                    types: '(cities)',
                    language: 'en',
                },
            }
        );

        const predictions = response.data.predictions.map((p: any) => ({
            placeId: p.place_id,
            description: p.description,
            mainText: p.structured_formatting?.main_text || p.description,
            secondaryText: p.structured_formatting?.secondary_text || '',
        }));

        res.json({ predictions });
    } catch (error: any) {
        console.error('Places autocomplete error:', error.message);
        // Return empty list instead of 500 on error
        res.json({ predictions: [] });
    }
});

// Get place details (lat/lng)
router.get('/details', cacheMiddleware('place-details'), async (req: Request, res: Response) => {
    try {
        const { placeId } = req.query;

        if (!placeId || typeof placeId !== 'string') {
            return res.status(400).json({ error: 'placeId is required' });
        }

        if (!config.googleMapsApiKey || placeId.startsWith('place_')) {
            // Return fallback coordinates for major cities
            const fallbackCoords: Record<string, { lat: number, lng: number, name: string }> = {
                'place_mumbai': { lat: 19.0760, lng: 72.8777, name: 'Mumbai' },
                'place_delhi': { lat: 28.7041, lng: 77.1025, name: 'Delhi' },
                'place_bangalore': { lat: 12.9716, lng: 77.5946, name: 'Bangalore' },
                'place_pune': { lat: 18.5204, lng: 73.8567, name: 'Pune' },
                'place_chennai': { lat: 13.0827, lng: 80.2707, name: 'Chennai' },
                'place_kolkata': { lat: 22.5726, lng: 88.3639, name: 'Kolkata' },
                'place_hyderabad': { lat: 17.3850, lng: 78.4867, name: 'Hyderabad' },
                'place_jaipur': { lat: 26.9124, lng: 75.7873, name: 'Jaipur' },
                'place_ahmedabad': { lat: 23.0225, lng: 72.5714, name: 'Ahmedabad' },
                'place_goa': { lat: 15.2993, lng: 74.1240, name: 'Goa' },
            };

            const coords = fallbackCoords[placeId] || { lat: 20.5937, lng: 78.9629, name: 'India' }; // Default to center of India

            return res.json({
                name: coords.name,
                formattedAddress: `${coords.name}, India`,
                lat: coords.lat,
                lng: coords.lng,
            });
        }

        const response = await axios.get(
            'https://maps.googleapis.com/maps/api/place/details/json',
            {
                params: {
                    place_id: placeId,
                    key: config.googleMapsApiKey,
                    fields: 'geometry,formatted_address,name',
                },
            }
        );

        const result = response.data.result;
        res.json({
            name: result.name,
            formattedAddress: result.formatted_address,
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng,
        });
    } catch (error: any) {
        console.error('Place details error:', error.message);
        // Fallback to avoid 500
        res.json({
            name: 'Unknown Location',
            formattedAddress: 'India',
            lat: 20.5937,
            lng: 78.9629,
        });
    }
});

export default router;
