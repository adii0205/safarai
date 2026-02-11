import axios from 'axios';
import { config } from '../config';
import { RouteSegment, RouteOption, OptimizationType } from './types';
import { generateBookingLink, getTransportIcon } from './bookingLinks';

// Haversine distance in km
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateTaxiCost(distKm: number): number {
    // INR per km (roughly ₹12/km + ₹100 base)
    return Math.round(100 + distKm * 12);
}

function estimateTaxiDuration(distKm: number): number {
    // Average 35 km/h in India
    return Math.round(distKm / 35 * 60); // minutes
}

async function getReliabilityScore(
    route: string,
    transportType: string,
    date: string
): Promise<{ reliability: number; delayProb: number; cancelProb: number }> {
    try {
        const response = await axios.post(`${config.mlServiceUrl}/predict-delay`, {
            route,
            transport_type: transportType,
            date,
        }, { timeout: 3000 });

        const cancelResponse = await axios.post(`${config.mlServiceUrl}/predict-cancellation`, {
            route,
            transport_type: transportType,
            date,
        }, { timeout: 3000 });

        return {
            reliability: response.data.reliability_score || 75,
            delayProb: response.data.delay_probability || 0.2,
            cancelProb: cancelResponse.data.cancellation_probability || 0.05,
        };
    } catch {
        // ML service unavailable — return default scores
        const defaults: Record<string, { reliability: number; delayProb: number; cancelProb: number }> = {
            flight: { reliability: 85, delayProb: 0.15, cancelProb: 0.02 },
            train: { reliability: 70, delayProb: 0.35, cancelProb: 0.05 },
            bus: { reliability: 75, delayProb: 0.25, cancelProb: 0.03 },
            taxi: { reliability: 95, delayProb: 0.05, cancelProb: 0.01 },
        };
        return defaults[transportType] || { reliability: 75, delayProb: 0.2, cancelProb: 0.05 };
    }
}

export async function computeRoutes(
    origin: { name: string; lat: number; lng: number },
    destination: { name: string; lat: number; lng: number },
    date: string,
    optimization: OptimizationType = 'fastest'
): Promise<RouteOption[]> {
    const distance = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    const routes: RouteOption[] = [];
    const baseUrl = `http://localhost:${config.port}`;

    // Fetch transport options in parallel
    const [trainRes, flightRes, busRes] = await Promise.allSettled([
        axios.get(`${baseUrl}/api/transport/trains/search`, {
            params: { from: origin.name, to: destination.name, date },
        }),
        axios.get(`${baseUrl}/api/transport/flights/search`, {
            params: { from: origin.name, to: destination.name, date },
        }),
        axios.get(`${baseUrl}/api/transport/buses/search`, {
            params: { from: origin.name, to: destination.name, date },
        }),
    ]);

    const trains = trainRes.status === 'fulfilled' ? trainRes.value.data.trains || [] : [];
    const flights = flightRes.status === 'fulfilled' ? flightRes.value.data.flights || [] : [];
    const buses = busRes.status === 'fulfilled' ? busRes.value.data.buses || [] : [];

    // Get reliability scores
    const [trainReliability, flightReliability, busReliability, taxiReliability] = await Promise.all([
        getReliabilityScore(`${origin.name}-${destination.name}`, 'train', date),
        getReliabilityScore(`${origin.name}-${destination.name}`, 'flight', date),
        getReliabilityScore(`${origin.name}-${destination.name}`, 'bus', date),
        getReliabilityScore(`${origin.name}-${destination.name}`, 'taxi', date),
    ]);

    // Route 1: Direct Train (if available)
    if (trains.length > 0) {
        const bestTrain = trains[0];
        const segments: RouteSegment[] = [{
            id: `train-${Date.now()}`,
            type: 'train',
            from: origin.name,
            to: destination.name,
            departureTime: bestTrain.departureTime,
            arrivalTime: bestTrain.arrivalTime,
            duration: bestTrain.duration,
            price: bestTrain.price?.['3A'] || bestTrain.price?.SL || 800,
            currency: 'INR',
            operator: bestTrain.trainName,
            details: `Train ${bestTrain.trainNumber} • ${bestTrain.classes?.join(', ')}`,
            reliability: trainReliability.reliability,
            delayProbability: trainReliability.delayProb,
            cancellationProbability: trainReliability.cancelProb,
            bookingLink: generateBookingLink('train', { from: origin.name, to: destination.name, date }),
            icon: getTransportIcon('train'),
        }];

        routes.push({
            id: `route-train-${Date.now()}`,
            name: `🚆 Direct Train — ${bestTrain.trainName}`,
            segments,
            totalDuration: bestTrain.duration,
            totalPrice: bestTrain.price?.['3A'] || bestTrain.price?.SL || 800,
            totalReliability: trainReliability.reliability,
            optimizationType: 'cheapest',
        });
    }

    // Route 2: Direct Flight (if available & distance > 300km)
    if (flights.length > 0 && distance > 300) {
        const bestFlight = flights[0];
        const taxiToAirport = estimateTaxiCost(25);
        const taxiFromAirport = estimateTaxiCost(25);

        const segments: RouteSegment[] = [
            {
                id: `taxi-to-airport-${Date.now()}`,
                type: 'taxi',
                from: origin.name,
                to: `${origin.name} Airport`,
                departureTime: 'Flexible',
                arrivalTime: 'Flexible',
                duration: '45 min',
                price: taxiToAirport,
                currency: 'INR',
                operator: 'Uber / Ola',
                details: 'Taxi to airport',
                reliability: taxiReliability.reliability,
                bookingLink: generateBookingLink('taxi', { from: origin.name, to: destination.name, date }),
                icon: getTransportIcon('taxi'),
            },
            {
                id: `flight-${Date.now()}`,
                type: 'flight',
                from: bestFlight.fromAirport,
                to: bestFlight.toAirport,
                departureTime: bestFlight.departureTime,
                arrivalTime: bestFlight.arrivalTime,
                duration: bestFlight.duration,
                price: bestFlight.price,
                currency: 'INR',
                operator: bestFlight.airlineName || bestFlight.airline,
                details: `Flight ${bestFlight.flightNumber} • ${bestFlight.stops === 0 ? 'Non-stop' : bestFlight.stops + ' stop(s)'}`,
                reliability: flightReliability.reliability,
                delayProbability: flightReliability.delayProb,
                cancellationProbability: flightReliability.cancelProb,
                bookingLink: bestFlight.bookingLink || generateBookingLink('flight', { from: bestFlight.fromAirport, to: bestFlight.toAirport, date }),
                icon: getTransportIcon('flight'),
            },
            {
                id: `taxi-from-airport-${Date.now()}`,
                type: 'taxi',
                from: `${destination.name} Airport`,
                to: destination.name,
                departureTime: 'On arrival',
                arrivalTime: 'Flexible',
                duration: '45 min',
                price: taxiFromAirport,
                currency: 'INR',
                operator: 'Uber / Ola',
                details: 'Taxi from airport',
                reliability: taxiReliability.reliability,
                bookingLink: generateBookingLink('taxi', { from: origin.name, to: destination.name, date }),
                icon: getTransportIcon('taxi'),
            },
        ];

        const totalPrice = taxiToAirport + bestFlight.price + taxiFromAirport;
        routes.push({
            id: `route-flight-${Date.now()}`,
            name: `✈️ Flight — ${bestFlight.airlineName || bestFlight.airline}`,
            segments,
            totalDuration: bestFlight.duration,
            totalPrice,
            totalReliability: flightReliability.reliability,
            optimizationType: 'fastest',
        });
    }

    // Route 3: Direct Bus
    if (buses.length > 0) {
        const bestBus = buses[0];
        const segments: RouteSegment[] = [{
            id: `bus-${Date.now()}`,
            type: 'bus',
            from: origin.name,
            to: destination.name,
            departureTime: bestBus.departureTime,
            arrivalTime: bestBus.arrivalTime,
            duration: bestBus.duration,
            price: bestBus.price,
            currency: 'INR',
            operator: bestBus.operatorName,
            details: `${bestBus.busType} • ${bestBus.seatsAvailable} seats available • ⭐ ${bestBus.rating}`,
            reliability: busReliability.reliability,
            delayProbability: busReliability.delayProb,
            cancellationProbability: busReliability.cancelProb,
            seatsAvailable: bestBus.seatsAvailable,
            bookingLink: bestBus.bookingLink || generateBookingLink('bus', { from: origin.name, to: destination.name, date }),
            icon: getTransportIcon('bus'),
        }];

        routes.push({
            id: `route-bus-${Date.now()}`,
            name: `🚌 Bus — ${bestBus.operatorName}`,
            segments,
            totalDuration: bestBus.duration,
            totalPrice: bestBus.price,
            totalReliability: busReliability.reliability,
            optimizationType: 'cheapest',
        });
    }

    // Route 4: Multi-modal (Train + Taxi or Bus + Train)
    if (trains.length > 0 && distance > 100) {
        const train = trains[Math.min(1, trains.length - 1)];
        const taxiLeg = estimateTaxiCost(Math.min(50, distance * 0.15));
        const taxiDur = estimateTaxiDuration(Math.min(50, distance * 0.15));

        const segments: RouteSegment[] = [
            {
                id: `taxi-mix-${Date.now()}`,
                type: 'taxi',
                from: origin.name,
                to: `${origin.name} Junction`,
                departureTime: 'Flexible',
                arrivalTime: 'Flexible',
                duration: `${taxiDur} min`,
                price: taxiLeg,
                currency: 'INR',
                operator: 'Uber / Ola',
                details: 'Taxi to railway station',
                reliability: taxiReliability.reliability,
                bookingLink: generateBookingLink('taxi', { from: origin.name, to: destination.name, date }),
                icon: getTransportIcon('taxi'),
            },
            {
                id: `train-mix-${Date.now()}`,
                type: 'train',
                from: `${origin.name} Junction`,
                to: destination.name,
                departureTime: train.departureTime,
                arrivalTime: train.arrivalTime,
                duration: train.duration,
                price: train.price?.['3A'] || train.price?.SL || 700,
                currency: 'INR',
                operator: train.trainName,
                details: `Train ${train.trainNumber}`,
                reliability: trainReliability.reliability,
                delayProbability: trainReliability.delayProb,
                cancellationProbability: trainReliability.cancelProb,
                bookingLink: generateBookingLink('train', { from: origin.name, to: destination.name, date }),
                icon: getTransportIcon('train'),
            },
        ];

        const totalPrice = taxiLeg + (train.price?.['3A'] || 700);
        routes.push({
            id: `route-multi-${Date.now()}`,
            name: `🚕+🚆 Taxi + Train — ${train.trainName}`,
            segments,
            totalDuration: train.duration,
            totalPrice,
            totalReliability: Math.round((taxiReliability.reliability + trainReliability.reliability) / 2),
            optimizationType: 'reliable',
        });
    }

    // Route 5: Taxi only (if distance < 200km)
    if (distance < 200) {
        const taxiCost = estimateTaxiCost(distance);
        const taxiDur = estimateTaxiDuration(distance);

        const segments: RouteSegment[] = [{
            id: `taxi-direct-${Date.now()}`,
            type: 'taxi',
            from: origin.name,
            to: destination.name,
            departureTime: 'Flexible',
            arrivalTime: 'Flexible',
            duration: `${Math.floor(taxiDur / 60)}h ${taxiDur % 60}m`,
            price: taxiCost,
            currency: 'INR',
            operator: 'Uber / Ola',
            details: `${Math.round(distance)} km drive`,
            reliability: taxiReliability.reliability,
            delayProbability: taxiReliability.delayProb,
            cancellationProbability: taxiReliability.cancelProb,
            bookingLink: generateBookingLink('taxi', { from: origin.name, to: destination.name, date }),
            icon: getTransportIcon('taxi'),
        }];

        routes.push({
            id: `route-taxi-${Date.now()}`,
            name: `🚕 Direct Taxi`,
            segments,
            totalDuration: `${Math.floor(taxiDur / 60)}h ${taxiDur % 60}m`,
            totalPrice: taxiCost,
            totalReliability: taxiReliability.reliability,
            optimizationType: 'reliable',
        });
    }

    // Sort based on optimization type
    return sortRoutes(routes, optimization);
}

function sortRoutes(routes: RouteOption[], optimization: OptimizationType): RouteOption[] {
    switch (optimization) {
        case 'cheapest':
            return routes.sort((a, b) => a.totalPrice - b.totalPrice);
        case 'fastest':
            return routes.sort((a, b) => parseDuration(a.totalDuration) - parseDuration(b.totalDuration));
        case 'reliable':
            return routes.sort((a, b) => b.totalReliability - a.totalReliability);
        default:
            return routes;
    }
}

function parseDuration(dur: string): number {
    const match = dur.match(/(?:PT)?(\d+)H?(\d+)?M?/i) || dur.match(/(\d+)h\s*(\d+)?m?/i);
    if (!match) return 999;
    return (parseInt(match[1] || '0') * 60) + parseInt(match[2] || '0');
}

// Alternate route engine — called when a segment has no availability
export async function computeAlternateRoutes(
    origin: { name: string; lat: number; lng: number },
    destination: { name: string; lat: number; lng: number },
    date: string,
    excludeType: string
): Promise<RouteOption[]> {
    const allRoutes = await computeRoutes(origin, destination, date, 'fastest');
    return allRoutes.filter(r => !r.segments.some(s => s.type === excludeType));
}
