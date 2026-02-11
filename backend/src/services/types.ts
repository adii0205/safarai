export interface Location {
    name: string;
    lat: number;
    lng: number;
    formattedAddress?: string;
}

export interface RouteSegment {
    id: string;
    type: 'train' | 'bus' | 'flight' | 'taxi';
    from: string;
    to: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    price: number;
    currency: string;
    operator?: string;
    details?: string;
    reliability?: number;
    delayProbability?: number;
    cancellationProbability?: number;
    seatsAvailable?: number | boolean;
    bookingLink: string;
    icon: string;
}

export interface RouteOption {
    id: string;
    name: string;
    segments: RouteSegment[];
    totalDuration: string;
    totalPrice: number;
    totalReliability: number;
    optimizationType: 'cheapest' | 'fastest' | 'reliable';
}

export type OptimizationType = 'cheapest' | 'fastest' | 'reliable';
