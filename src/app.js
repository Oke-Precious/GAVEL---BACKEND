const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');

const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const v1Routes = require('./routes/v1');
const { sendError } = require('./utils/apiResponse');

const app = express();

// Set security HTTP headers
app.use(helmet());

// Enable CORS
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true
}));

// Request logger in dev mode
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp());

// Compress responses
app.use(compression());

// Mount routers
app.use('/api/v1', v1Routes);

// Handle undefined routes
app.all('*', (req, res, next) => {
  return sendError(res, 404, `Can't find ${req.originalUrl} on this server!`);
});

// Global error handler
app.use(errorHandler);

module.exports = app;
