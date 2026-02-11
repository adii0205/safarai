import { Router, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config';
import { cacheMiddleware } from '../middleware/cache';

const router = Router();

// Indian Railway API via RapidAPI
router.get('/search', cacheMiddleware('trains'), async (req: Request, res: Response) => {
    try {
        const { from, to, date } = req.query;

        if (!from || !to || !date) {
            return res.status(400).json({ error: 'from, to, and date are required' });
        }

        if (!config.rapidApiKey) {
            // Return structured fallback data from known Indian routes
            return res.json({
                source: 'fallback',
                trains: generateFallbackTrains(from as string, to as string, date as string),
            });
        }

        // IRCTC API via RapidAPI
        const response = await axios.get(
            'https://irctc1.p.rapidapi.com/api/v3/trainBetweenStations',
            {
                params: {
                    fromStationCode: from,
                    toStationCode: to,
                    dateOfJourney: date, // YYYY-MM-DD
                },
                headers: {
                    'x-rapidapi-key': config.rapidApiKey,
                    'x-rapidapi-host': 'irctc1.p.rapidapi.com',
                },
            }
        );

        const trains = (response.data.data || []).map((train: any) => ({
            trainNumber: train.train_number,
            trainName: train.train_name,
            departureTime: train.from_std,
            arrivalTime: train.to_std,
            duration: train.duration,
            fromStation: train.from_station_name,
            toStation: train.to_station_name,
            classes: train.class_type || [],
            runDays: train.run_days,
            transportType: 'train' as const,
            bookingLink: `https://www.irctc.co.in/nget/train-search?from=${from}&to=${to}&date=${date}`,
        }));

        res.json({ source: 'live', trains });
    } catch (error: any) {
        console.error('Train search error:', error.message);
        res.json({
            source: 'fallback',
            trains: generateFallbackTrains(
                req.query.from as string,
                req.query.to as string,
                req.query.date as string
            ),
        });
    }
});

// Get seat availability
router.get('/availability', cacheMiddleware('train-avail'), async (req: Request, res: Response) => {
    try {
        const { trainNumber, from, to, date, classType } = req.query;

        if (!config.rapidApiKey) {
            return res.json({
                source: 'fallback',
                available: true,
                seats: Math.floor(Math.random() * 50) + 5,
                waitlist: 0,
            });
        }

        const response = await axios.get(
            'https://irctc1.p.rapidapi.com/api/v1/checkSeatAvailability',
            {
                params: {
                    classType,
                    fromStationCode: from,
                    quota: 'GN',
                    toStationCode: to,
                    trainNo: trainNumber,
                    date,
                },
                headers: {
                    'x-rapidapi-key': config.rapidApiKey,
                    'x-rapidapi-host': 'irctc1.p.rapidapi.com',
                },
            }
        );

        res.json({ source: 'live', availability: response.data.data });
    } catch (error: any) {
        console.error('Availability check error:', error.message);
        res.json({ source: 'fallback', available: true, seats: 15 });
    }
});

function generateFallbackTrains(from: string, to: string, date: string) {
    const trainNames = [
        'Rajdhani Express', 'Shatabdi Express', 'Duronto Express',
        'Garib Rath Express', 'Jan Shatabdi Express', 'Superfast Express',
    ];

    return trainNames.slice(0, 3 + Math.floor(Math.random() * 3)).map((name, i) => {
        const depHour = 5 + (i * 4);
        const durationHrs = 4 + Math.floor(Math.random() * 16);
        const arrHour = (depHour + durationHrs) % 24;

        return {
            trainNumber: `${12000 + i * 100 + Math.floor(Math.random() * 99)}`,
            trainName: name,
            departureTime: `${String(depHour).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
            arrivalTime: `${String(arrHour).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
            duration: `${durationHrs}h ${Math.floor(Math.random() * 60)}m`,
            fromStation: from,
            toStation: to,
            classes: ['SL', '3A', '2A', '1A'].slice(0, 2 + Math.floor(Math.random() * 3)),
            price: { SL: 350 + i * 50, '3A': 900 + i * 100, '2A': 1400 + i * 150, '1A': 2200 + i * 200 },
            transportType: 'train',
            bookingLink: `https://www.irctc.co.in/nget/train-search`,
        };
    });
}

export default router;
