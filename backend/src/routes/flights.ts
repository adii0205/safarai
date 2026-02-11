import { Router, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config';
import { cacheMiddleware } from '../middleware/cache';

const router = Router();

let amadeusToken: string | null = null;
let tokenExpiry: number = 0;

async function getAmadeusToken(): Promise<string> {
    if (amadeusToken && Date.now() < tokenExpiry) {
        return amadeusToken;
    }

    const response = await axios.post(
        'https://test.api.amadeus.com/v1/security/oauth2/token',
        new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: config.amadeusClientId,
            client_secret: config.amadeusClientSecret,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    amadeusToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
    return amadeusToken!;
}

// Indian airport codes mapping
const CITY_TO_IATA: Record<string, string> = {
    'mumbai': 'BOM', 'delhi': 'DEL', 'bangalore': 'BLR', 'bengaluru': 'BLR',
    'hyderabad': 'HYD', 'chennai': 'MAA', 'kolkata': 'CCU', 'pune': 'PNQ',
    'ahmedabad': 'AMD', 'jaipur': 'JAI', 'lucknow': 'LKO', 'goa': 'GOI',
    'kochi': 'COK', 'cochin': 'COK', 'thiruvananthapuram': 'TRV',
    'guwahati': 'GAU', 'varanasi': 'VNS', 'patna': 'PAT', 'bhopal': 'BHO',
    'indore': 'IDR', 'nagpur': 'NAG', 'chandigarh': 'IXC', 'coimbatore': 'CJB',
    'srinagar': 'SXR', 'amritsar': 'ATQ', 'ranchi': 'IXR', 'raipur': 'RPR',
    'visakhapatnam': 'VTZ', 'bhubaneswar': 'BBI', 'mangalore': 'IXE',
    'udaipur': 'UDR', 'dehradun': 'DED', 'madurai': 'IXM', 'tiruchirappalli': 'TRZ',
    'leh': 'IXL', 'surat': 'STV', 'vadodara': 'BDQ', 'agartala': 'IXA',
    'imphal': 'IMF', 'silchar': 'IXS', 'dibrugarh': 'DIB', 'jorhat': 'JRH',
    'bagdogra': 'IXB', 'port blair': 'IXZ', 'jammu': 'IXJ', 'rajkot': 'RAJ',
    'aurangabad': 'IXU', 'hubli': 'HBX', 'belgaum': 'IXG', 'kolhapur': 'KLH',
    'mysore': 'MYQ', 'mysuru': 'MYQ', 'tirumala': 'TIR', 'tirupati': 'TIR',
    'vijayawada': 'VGA', 'calicut': 'CCJ', 'kozhikode': 'CCJ',
    'new delhi': 'DEL', 'noida': 'DEL', 'gurugram': 'DEL', 'gurgaon': 'DEL',
    'thane': 'BOM', 'navi mumbai': 'BOM',
};

function cityToIATA(city: string): string | null {
    const normalized = city.toLowerCase().trim().replace(/,.*$/, '').trim();
    return CITY_TO_IATA[normalized] || null;
}

router.get('/search', cacheMiddleware('flights'), async (req: Request, res: Response) => {
    try {
        const { from, to, date, adults } = req.query;

        if (!from || !to || !date) {
            return res.status(400).json({ error: 'from, to, and date are required' });
        }

        const fromIATA = cityToIATA(from as string);
        const toIATA = cityToIATA(to as string);

        if (!fromIATA || !toIATA) {
            return res.json({
                source: 'no-airport',
                flights: [],
                message: `No airport found for: ${!fromIATA ? from : to}`,
            });
        }

        if (!config.amadeusClientId || !config.amadeusClientSecret) {
            return res.json({
                source: 'fallback',
                flights: generateFallbackFlights(fromIATA, toIATA, date as string),
            });
        }

        const token = await getAmadeusToken();

        const response = await axios.get(
            'https://test.api.amadeus.com/v2/shopping/flight-offers',
            {
                params: {
                    originLocationCode: fromIATA,
                    destinationLocationCode: toIATA,
                    departureDate: date,
                    adults: adults || 1,
                    currencyCode: 'INR',
                    max: 10,
                },
                headers: { Authorization: `Bearer ${token}` },
            }
        );

        const flights = (response.data.data || []).map((offer: any) => {
            const segment = offer.itineraries[0]?.segments[0];
            return {
                id: offer.id,
                airline: segment?.carrierCode || 'Unknown',
                flightNumber: `${segment?.carrierCode}${segment?.number}`,
                departureTime: segment?.departure?.at,
                arrivalTime: segment?.arrival?.at,
                duration: offer.itineraries[0]?.duration,
                fromAirport: fromIATA,
                toAirport: toIATA,
                price: parseFloat(offer.price?.total || '0'),
                currency: offer.price?.currency || 'INR',
                stops: (offer.itineraries[0]?.segments?.length || 1) - 1,
                transportType: 'flight' as const,
                bookingLink: `https://www.makemytrip.com/flight/search?from=${fromIATA}&to=${toIATA}&date=${date}`,
            };
        });

        res.json({ source: 'live', flights });
    } catch (error: any) {
        console.error('Flight search error:', error.message);
        const fromIATA = cityToIATA(req.query.from as string) || 'DEL';
        const toIATA = cityToIATA(req.query.to as string) || 'BOM';
        res.json({
            source: 'fallback',
            flights: generateFallbackFlights(fromIATA, toIATA, req.query.date as string),
        });
    }
});

function generateFallbackFlights(from: string, to: string, date: string) {
    const airlines = [
        { code: 'AI', name: 'Air India' },
        { code: '6E', name: 'IndiGo' },
        { code: 'SG', name: 'SpiceJet' },
        { code: 'UK', name: 'Vistara' },
        { code: 'G8', name: 'GoFirst' },
    ];

    return airlines.slice(0, 3 + Math.floor(Math.random() * 3)).map((airline, i) => {
        const depHour = 5 + i * 3;
        const durationMins = 90 + Math.floor(Math.random() * 120);

        return {
            id: `${airline.code}-${i}`,
            airline: airline.code,
            airlineName: airline.name,
            flightNumber: `${airline.code}${100 + Math.floor(Math.random() * 900)}`,
            departureTime: `${date}T${String(depHour).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
            arrivalTime: `${date}T${String(depHour + Math.floor(durationMins / 60)).padStart(2, '0')}:${String(durationMins % 60).padStart(2, '0')}:00`,
            duration: `PT${Math.floor(durationMins / 60)}H${durationMins % 60}M`,
            fromAirport: from,
            toAirport: to,
            price: 3000 + Math.floor(Math.random() * 8000),
            currency: 'INR',
            stops: Math.random() > 0.7 ? 1 : 0,
            transportType: 'flight',
            bookingLink: `https://www.makemytrip.com/flight/search?from=${from}&to=${to}&date=${date}`,
        };
    });
}

export default router;
