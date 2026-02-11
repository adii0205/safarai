-- SafarAI Database Schema for Supabase (PostgreSQL)

-- Historical delay data for ML training
CREATE TABLE IF NOT EXISTS delay_history (
  id BIGSERIAL PRIMARY KEY,
  route TEXT NOT NULL,
  transport_type TEXT NOT NULL CHECK (transport_type IN ('train', 'bus', 'flight')),
  scheduled_departure TIMESTAMPTZ NOT NULL,
  actual_departure TIMESTAMPTZ,
  delay_minutes INTEGER DEFAULT 0,
  season TEXT CHECK (season IN ('summer', 'monsoon', 'winter', 'spring')),
  weekday INTEGER CHECK (weekday BETWEEN 0 AND 6),
  time_of_day TEXT CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'night')),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Historical cancellation data
CREATE TABLE IF NOT EXISTS cancellation_history (
  id BIGSERIAL PRIMARY KEY,
  route TEXT NOT NULL,
  transport_type TEXT NOT NULL CHECK (transport_type IN ('train', 'bus', 'flight')),
  scheduled_date DATE NOT NULL,
  was_cancelled BOOLEAN DEFAULT FALSE,
  cancellation_reason TEXT,
  season TEXT CHECK (season IN ('summer', 'monsoon', 'winter', 'spring')),
  weekday INTEGER CHECK (weekday BETWEEN 0 AND 6),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_delay_route ON delay_history(route, transport_type);
CREATE INDEX IF NOT EXISTS idx_delay_date ON delay_history(scheduled_departure);
CREATE INDEX IF NOT EXISTS idx_cancel_route ON cancellation_history(route, transport_type);
CREATE INDEX IF NOT EXISTS idx_cancel_date ON cancellation_history(scheduled_date);

-- Route cache table
CREATE TABLE IF NOT EXISTS route_cache (
  id BIGSERIAL PRIMARY KEY,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  route_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX IF NOT EXISTS idx_route_cache ON route_cache(origin, destination);
