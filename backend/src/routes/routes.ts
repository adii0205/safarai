import { Router, Request, Response } from 'express';
import { cacheMiddleware } from '../middleware/cache';
import { computeRoutes, computeAlternateRoutes } from '../services/routeEngine';
import { OptimizationType } from '../services/types';

const router = Router();

// Main route search
router.post('/search', cacheMiddleware('routes'), async (req: Request, res: Response) => {
    try {
        const { origin, destination, date, optimization } = req.body;

        if (!origin || !destination || !date) {
            return res.status(400).json({
                error: 'origin, destination, and date are required',
                example: {
                    origin: { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
                    destination: { name: 'Pune', lat: 18.5204, lng: 73.8567 },
                    date: '2026-03-15',
                    optimization: 'fastest',
                },
            });
        }

        const routes = await computeRoutes(
            origin,
            destination,
            date,
            (optimization as OptimizationType) || 'fastest'
        );

        res.json({
            success: true,
            origin,
            destination,
            date,
            optimization: optimization || 'fastest',
            routeCount: routes.length,
            routes,
        });
    } catch (error: any) {
        console.error('Route search error:', error.message);
        res.status(500).json({ error: 'Failed to compute routes' });
    }
});

// Alternate routes (when a segment is unavailable)
router.post('/alternate', cacheMiddleware('alt-routes'), async (req: Request, res: Response) => {
    try {
        const { origin, destination, date, excludeType } = req.body;

        if (!origin || !destination || !date || !excludeType) {
            return res.status(400).json({
                error: 'origin, destination, date, and excludeType are required',
            });
        }

        const routes = await computeAlternateRoutes(origin, destination, date, excludeType);

        res.json({
            success: true,
            message: `Found ${routes.length} alternate routes excluding ${excludeType}`,
            routes,
        });
    } catch (error: any) {
        console.error('Alternate route error:', error.message);
        res.status(500).json({ error: 'Failed to compute alternate routes' });
    }
});

export default router;
