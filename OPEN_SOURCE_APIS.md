# Open Source APIs Setup Guide

Your SafarAI backend has been updated to use open source and free APIs. Here's a complete guide:

## 1. Places & Geolocation
**Current Implementation**: Nominatim (OpenStreetMap)
- **Free**: Yes, completely free
- **No API Key Needed**: Just add `User-Agent` header
- **URL**: `https://nominatim.openstreetmap.org`
- **Usage**: Autocomplete and reverse geocoding for Indian cities

### Integration
Already integrated in `backend/src/routes/places.ts`. No setup needed!

---

## 2. Routing & Directions
**Current Configuration**: OpenRouteService (ORS)
- **Free Tier**: Yes (2,500 requests/day)
- **API Key**: Required
- **Get Key**: https://openrouteservice.org/dev/#/signup
- **Documentation**: https://openrouteservice.org/dev/#/api-docs

### Setup
1. Sign up at https://openrouteservice.org/dev/#/signup
2. Copy your API key
3. Add to `.env`:
   ```
   ORS_API_KEY=your_api_key_here
   ```

### Usage Example
```typescript
// For routing, use ORS in your route engine
const response = await axios.get(
  `${config.orsUrl}/v2/directions/driving`,
  {
    params: {
      coordinates: [[77.1025, 28.7041], [72.8777, 19.0760]], // [lon, lat] Delhi to Mumbai
      api_key: config.orsApiKey,
    }
  }
);
```

---

## 3. Flights
**Current**: Mock data from `generateOpenSourceFlights()`
- **Free alternatives**:
  - **Flightradar24 API**: Limited free tier available
  - **Skyscanner**: Has a free tier with signup
  - **OpenFlights Database**: https://openflights.org/data.html

### Recommended Integration
Use Flightradar24 free tier:
```bash
npm install flightradarapi
```

Or integrate manually:
1. Visit https://www.flightradar24.com/open-api
2. Request access to free tier
3. Use their API for live flight data

---

## 4. Buses
**Current**: Mock data from `generateOpenSourceBuses()`
- **Free alternatives**:
  - **GTFS Feeds**: General Transit Feed Specification
    - BMTC Bangalore: https://gtfs.cumta.in/
    - BEST Mumbai: Contact Mumbai Transport
  - **OpenTripPlanner**: Open source routing engine
  - **Transitapp**: Has some open data

### Recommended Integration
1. **Option A - GTFS Feeds** (Best for Indian cities):
   - Download GTFS data from local transport authorities
   - Use `node-gtfs` library to parse

2. **Option B - OpenTripPlanner**:
   ```bash
   npm install otp-client
   ```

---

## 5. Trains
**Current**: Mock data from `generateOpenSourceTrains()`
- **Free alternatives**:
  - **Indian Railways Public API**: Being developed
  - **GTFS Feeds**: Some states provide GTFS for trains
  - **RailRadar**: https://railradar.in/

### Recommended Integration
Check if Indian Railways provides public API access. For now, use mock data and update when official API becomes available.

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Server
PORT=3001
NODE_ENV=development

# OpenStreetMap (Nominatim) - No key needed
NOMINATIM_URL=https://nominatim.openstreetmap.org

# OpenRouteService - Get key from https://openrouteservice.org
ORS_API_KEY=your_key_here
ORS_URL=https://api.openrouteservice.org

# Database
SUPABASE_URL=your_url_here
SUPABASE_ANON_KEY=your_key_here

# Redis
REDIS_URL=redis://localhost:6379

# ML Service
ML_SERVICE_URL=http://localhost:8000
```

---

## Migration Summary

| Service | Old API | New Solution | API Key |
|---------|---------|--------------|---------|
| Places | Google Maps | Nominatim (OSM) | ❌ No |
| Routing | - | OpenRouteService | ✅ Required |
| Flights | Amadeus | Flightradar24 / Mock | Optional |
| Buses | RapidAPI | GTFS / Mock | Optional |
| Trains | RapidAPI | Mock / GTFS | Optional |

---

## Cost Comparison

| Service | Old Cost | New Cost |
|---------|----------|----------|
| Google Maps | $7+ per 1000 | FREE |
| Amadeus | $1-5 per request | FREE |
| RapidAPI | $50-500/month | FREE |
| OpenRouteService | FREE (2500/day) | FREE |
| **Total Savings** | **$100+/month** | **FREE** |

---

## Recommendations for Production

1. **Flights**: Integrate Flightradar24 API for real data
2. **Buses**: Partner with local transport authorities or use GTFS feeds
3. **Trains**: Monitor Indian Railways API development
4. **Geolocation**: Keep Nominatim, it's excellent for OSM data
5. **Routing**: OpenRouteService is reliable and has good Indian coverage

---

## Additional Resources

- **GTFS Feeds**: https://transitfeeds.com/
- **OpenStreetMap**: https://www.openstreetmap.org/
- **OpenRouteService**: https://openrouteservice.org/
- **OpenTripPlanner**: https://www.opentripplanner.org/
- **Indian Open Data**: https://data.gov.in/

