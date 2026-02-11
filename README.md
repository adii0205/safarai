# SafarAI — Multi-Modal Indian Travel Route Planner

> AI-powered travel route planning across India. Compare trains, flights, buses & taxis with real-time data and ML reliability predictions.

---

## 🏗️ Architecture

```
safarai/
├── frontend/          # Next.js 14 (App Router) + TypeScript + TailwindCSS
├── backend/           # Express.js API Server + Redis Cache
├── ml-service/        # Python FastAPI + XGBoost ML Models
```

### Services

| Service | Port | Tech Stack |
|---------|------|------------|
| Frontend | 3000 | Next.js 14, TypeScript, TailwindCSS, React Query |
| Backend | 3001 | Express.js, Redis, Supabase (PostgreSQL) |
| ML Service | 8000 | FastAPI, XGBoost, scikit-learn |

---

## 🚀 Quick Start

### 1. Backend
```bash
cd backend
cp .env.example .env           # Edit with your API keys
npm install
npm run dev                     # Starts on :3001
```

### 2. ML Service
```bash
cd ml-service
pip install -r requirements.txt
python main.py                  # Starts on :8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                     # Starts on :3000
```

---

## 🔑 API Keys Required

| API | Purpose | Free Tier |
|-----|---------|-----------|
| Google Maps / Places | Location autocomplete | Yes (with billing account) |
| OpenRouteService | Route directions | Yes (free key at openrouteservice.org) |
| RapidAPI (IRCTC) | Indian Railway data | Yes (limited) |
| Amadeus | Flight search | Yes (test environment) |
| Supabase | PostgreSQL database | Yes (free tier) |
| Redis | API response caching | Yes (local or Upstash) |

> **Note:** The app runs with intelligent fallback data when API keys are not configured. You can explore all features without any keys.

---

## ✨ Features

- **Multi-Modal Routing**: Train + Bus + Flight + Taxi combined routes
- **AI Reliability Engine**: XGBoost ML predicts delays & cancellations
- **Real API Integrations**: IRCTC, Amadeus, RapidAPI bus aggregator
- **Smart Booking Links**: IRCTC, RedBus, MakeMyTrip, Uber direct links
- **Redis Caching**: 5-minute TTL prevents API rate limiting
- **Premium Dark UI**: Glassmorphism, animations, timeline journey view
- **Route Optimization**: Fastest, cheapest, or most reliable
- **Alternate Routes**: Auto-recompute when seats unavailable

---

## 📡 API Endpoints

### Backend (Express)
```
GET  /api/health
GET  /api/places/autocomplete?query=Mumbai
GET  /api/places/details?placeId=...
GET  /api/transport/trains/search?from=Mumbai&to=Delhi&date=2026-03-15
GET  /api/transport/flights/search?from=Mumbai&to=Delhi&date=2026-03-15
GET  /api/transport/buses/search?from=Mumbai&to=Pune&date=2026-03-15
POST /api/routes/search         { origin, destination, date, optimization }
POST /api/routes/alternate      { origin, destination, date, excludeType }
```

### ML Service (FastAPI)
```
GET  /health
POST /predict-delay             { route, transport_type, date }
POST /predict-cancellation      { route, transport_type, date }
```
