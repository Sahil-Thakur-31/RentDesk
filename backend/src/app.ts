import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import propertyRoutes from './routes/properties';
import unitRoutes from './routes/units';
import tenantRoutes from './routes/tenants';
import rentRoutes from './routes/rentRecords';
import utilityRoutes from './routes/utilityBills';
import maintenanceRoutes from './routes/maintenance';
import paymentRoutes from './routes/payments';
import reportRoutes from './routes/reports';
import dashboardRoutes from './routes/dashboard';
import userRoutes from './routes/users';
import portfolioRoutes from './routes/portfolio';
import i18nRoutes from './routes/i18n';
import { errorHandler, notFound } from './middleware/errorHandler';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/i18n', i18nRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/properties/:propertyId/units', unitRoutes);
app.use('/api/properties/:propertyId/tenants', tenantRoutes);
app.use('/api/properties/:propertyId/rent-records', rentRoutes);
app.use('/api/properties/:propertyId/utility-bills', utilityRoutes);
app.use('/api/properties/:propertyId/maintenance', maintenanceRoutes);
app.use('/api/properties/:propertyId/payments', paymentRoutes);
app.use('/api/properties/:propertyId/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
