import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';

// Route imports
import placesRouter from './routes/places';
import trainsRouter from './routes/trains';
import flightsRouter from './routes/flights';
import busesRouter from './routes/buses';
import routesRouter from './routes/routes';

const app = express();

// Security
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later' },
});
app.use(limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (_, res) => {
    res.json({
        status: 'ok',
        service: 'SafarAI Backend',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});

// API Routes
app.use('/api/places', placesRouter);
app.use('/api/transport/trains', trainsRouter);
app.use('/api/transport/flights', flightsRouter);
app.use('/api/transport/buses', busesRouter);
app.use('/api/routes', routesRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(config.port, () => {
    console.log(`
╔══════════════════════════════════════════╗
║     🚆 SafarAI Backend API Server       ║
║     Running on port ${config.port}                ║
║     Environment: ${config.nodeEnv}          ║
╚══════════════════════════════════════════╝
  `);
    console.log('Available endpoints:');
    console.log('  GET   /api/health');
    console.log('  GET   /api/places/autocomplete?query=...');
    console.log('  GET   /api/places/details?placeId=...');
    console.log('  GET   /api/transport/trains/search?from=&to=&date=');
    console.log('  GET   /api/transport/flights/search?from=&to=&date=');
    console.log('  GET   /api/transport/buses/search?from=&to=&date=');
    console.log('  POST  /api/routes/search');
    console.log('  POST  /api/routes/alternate');
});

export default app;
