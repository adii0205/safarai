import { Router, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config';
import { cacheMiddleware } from '../middleware/cache';

const router = Router();

router.get('/search', cacheMiddleware('buses'), async (req: Request, res: Response) => {
    try {
        const { from, to, date } = req.query;

        if (!from || !to || !date) {
            return res.status(400).json({ error: 'from, to, and date are required' });
        }

        if (!config.rapidApiKey) {
            return res.json({
                source: 'fallback',
                buses: generateFallbackBuses(from as string, to as string, date as string),
            });
        }

        // RapidAPI Bus aggregator
        const response = await axios.get(
            'https://india-bus-api.p.rapidapi.com/api/v1/buses',
            {
                params: { from, to, date },
                headers: {
                    'x-rapidapi-key': config.rapidApiKey,
                    'x-rapidapi-host': 'india-bus-api.p.rapidapi.com',
                },
            }
        );

        const buses = (response.data.buses || []).map((bus: any) => ({
            operatorName: bus.operator,
            busType: bus.busType || 'AC Sleeper',
            departureTime: bus.departure,
            arrivalTime: bus.arrival,
            duration: bus.duration,
            price: bus.fare,
            seatsAvailable: bus.availableSeats,
            rating: bus.rating,
            fromCity: from,
            toCity: to,
            transportType: 'bus' as const,
            bookingLink: `https://www.redbus.in/bus-tickets/${from}-to-${to}?date=${date}`,
        }));

        res.json({ source: 'live', buses });
    } catch (error: any) {
        console.error('Bus search error:', error.message);
        res.json({
            source: 'fallback',
            buses: generateFallbackBuses(
                req.query.from as string,
                req.query.to as string,
                req.query.date as string
            ),
        });
    }
});

function generateFallbackBuses(from: string, to: string, date: string) {
    const operators = [
        { name: 'VRL Travels', type: 'AC Sleeper' },
        { name: 'SRS Travels', type: 'Non-AC Seater' },
        { name: 'Neeta Travels', type: 'AC Semi-Sleeper' },
        { name: 'Paulo Travels', type: 'Volvo Multi-Axle' },
        { name: 'KSRTC', type: 'AC Seater' },
        { name: 'MSRTC Shivneri', type: 'AC Seater' },
        { name: 'Orange Travels', type: 'AC Sleeper' },
        { name: 'Kaveri Travels', type: 'Non-AC Sleeper' },
    ];

    return operators.slice(0, 4 + Math.floor(Math.random() * 4)).map((op, i) => {
        const depHour = 18 + (i % 6); // Most buses depart evening/night
        const durationHrs = 6 + Math.floor(Math.random() * 12);
        const arrHour = (depHour + durationHrs) % 24;

        return {
            operatorName: op.name,
            busType: op.type,
            departureTime: `${String(depHour % 24).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
            arrivalTime: `${String(arrHour).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
            duration: `${durationHrs}h ${Math.floor(Math.random() * 60)}m`,
            price: 400 + Math.floor(Math.random() * 1500),
            seatsAvailable: Math.floor(Math.random() * 30) + 1,
            rating: (3.5 + Math.random() * 1.5).toFixed(1),
            fromCity: from,
            toCity: to,
            transportType: 'bus',
            bookingLink: `https://www.redbus.in/bus-tickets/${encodeURIComponent(from as string)}-to-${encodeURIComponent(to as string)}`,
        };
    });
}

export default router;
