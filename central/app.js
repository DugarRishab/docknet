// central/app.js
const express = require('express');
const path = require('path');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const morgan = require('morgan');
const cors = require('cors');
const compression = require('compression');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const AppError = require('./utils/appError');
const errorHandler = require('./controllers/errorController');

// Route imports
const simulationRoutes = require('./routes/simulationRoutes');
const ingestRoutes = require('./routes/ingestRoutes');
const tangleRoutes = require('./routes/tangleRoutes');
const peerRoutes = require('./routes/peerRoutes');
const reportRoutes = require('./routes/reportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

dotenv.config({ path: "./config.env" });

app.enable("trust proxy");

console.log(`ENV = ${process.env.NODE_ENV}`);
app.use(morgan('dev'));

app.use(cors());
app.use(helmet());

app.use(express.json({ limit: "1gb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(xss());
app.use(compression());

// API routes
app.get("/", (req, res) => {
	res.json({
		status: 'success',
		message: "Central Node is running 🚀",
		version: '2.0.0'
	});
});

// Simulation control routes
app.use('/api/simulations', simulationRoutes);

// Worker telemetry ingestion
app.use('/api/ingest', ingestRoutes);

// Tangle data routes
app.use('/api/tangle', tangleRoutes);

// Peer network routes
app.use('/api/peers', peerRoutes);

// Report/analysis routes
app.use('/api/report', reportRoutes);

// Dashboard/global routes
app.use('/api/dashboard', dashboardRoutes);

// Serve generated report charts and assets statically
app.use('/reports', express.static(path.join(process.env.DATA_ROOT || path.join(__dirname, 'data'), 'reports')));

// 404 handler
app.use((req, res, next) => {
	next(new AppError(`Can't find ${req.originalUrl} on the server`, 404));
});

// Error handling middleware
app.use(errorHandler);

module.exports = app;
