export function generateBookingLink(
    type: 'train' | 'bus' | 'flight' | 'taxi',
    params: {
        from: string;
        to: string;
        date: string;
        trainNumber?: string;
        airline?: string;
        flightNumber?: string;
    }
): string {
    const { from, to, date, trainNumber, airline } = params;
    const encodedFrom = encodeURIComponent(from);
    const encodedTo = encodeURIComponent(to);

    switch (type) {
        case 'train':
            return `https://www.irctc.co.in/nget/train-search`;

        case 'bus':
            return `https://www.redbus.in/bus-tickets/${encodedFrom}-to-${encodedTo}?date=${date}`;

        case 'flight': {
            const formattedDate = date.replace(/-/g, '');
            if (airline) {
                const airlineUrls: Record<string, string> = {
                    'AI': `https://www.airindia.com/in/en/book.html`,
                    '6E': `https://www.goindigo.in/booking/select-flight.html?from=${from}&to=${to}&date=${date}`,
                    'SG': `https://www.spicejet.com/`,
                    'UK': `https://www.airvistara.com/in/en/book`,
                    'G8': `https://www.flygofirst.com/`,
                };
                return airlineUrls[airline] || `https://www.makemytrip.com/flight/search?itinerary=${from}-${to}-${formattedDate}&tripType=O&paxType=A-1_C-0_I-0&cabinClass=E`;
            }
            return `https://www.makemytrip.com/flight/search?itinerary=${from}-${to}-${formattedDate}&tripType=O&paxType=A-1_C-0_I-0&cabinClass=E`;
        }

        case 'taxi':
            return `https://www.uber.com/in/en/ride/`;

        default:
            return '#';
    }
}

export function getTransportIcon(type: 'train' | 'bus' | 'flight' | 'taxi'): string {
    const icons: Record<string, string> = {
        train: '🚆',
        bus: '🚌',
        flight: '✈️',
        taxi: '🚕',
    };
    return icons[type] || '🚗';
}

export function getPlatformName(type: 'train' | 'bus' | 'flight' | 'taxi'): string {
    const platforms: Record<string, string> = {
        train: 'IRCTC',
        bus: 'RedBus',
        flight: 'MakeMyTrip',
        taxi: 'Uber',
    };
    return platforms[type] || 'Unknown';
}
