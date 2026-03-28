/**
 * AaplaVasaiVirar Backend — VVMC Hyper-local Platform
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/auth.js';
import shopsRoutes from './routes/shops.js';
import volunteersRoutes from './routes/volunteers.js';
import leaderboardRoutes from './routes/leaderboard.js';
import adminRoutes from './routes/admin.js';
import sessionsRoutes from './routes/sessions.js';
import buildingsRoutes from './routes/buildings.js';
import eventsRoutes from './routes/events.js';
import plansRoutes from './routes/plans.js';
import subscriptionsRoutes from './routes/subscriptions.js';
import usersRoutes from './routes/users.js';
import servicesRoutes from './routes/services.js';
import leadsRoutes from './routes/leads.js';
import propertyAdsRoutes from './routes/propertyAds.js';
import reportsRoutes from './routes/reports.js';
import categoriesRoutes from './routes/categories.js';
import whitelistRoutes from './routes/whitelist.js';

const app = express();

app.use(helmet());
app.use(cors());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'aaplavasaivirar-backend' });
});

/** No DB — use to verify Vercel routes to Express (vs stuck handler / 504). */
app.get('/ping', (req, res) => {
  res.json({ pong: true });
});

app.use('/auth', authRoutes);
app.use('/shops', shopsRoutes);
app.use('/volunteers', volunteersRoutes);
app.use('/leaderboard', leaderboardRoutes);
app.use('/admin', adminRoutes);
app.use('/sessions', sessionsRoutes);
app.use('/buildings', buildingsRoutes);
app.use('/events', eventsRoutes);
app.use('/plans', plansRoutes);
app.use('/subscriptions', subscriptionsRoutes);
app.use('/users', usersRoutes);
app.use('/services', servicesRoutes);
app.use('/leads', leadsRoutes);
app.use('/property-ads', propertyAdsRoutes);
app.use('/reports', reportsRoutes);
app.use('/categories', categoriesRoutes);
app.use('/whitelist', whitelistRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

export default app;
