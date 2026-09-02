const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');

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
// (express-mongo-sanitize removed due to Express 5 compatibility issues)
// Mongoose 6+ provides robust built-in protection against NoSQL injection via strict casting.

// Data sanitization against XSS
// (xss-clean removed due to Express 5 compatibility issues; express-validator is used for route input sanitization)

// Prevent parameter pollution
app.use(hpp());

// Compress responses
app.use(compression());

// Serve static files for uploaded documents
const path = require('path');
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Mount routers
app.use('/api/v1', v1Routes);

// API Documentation UI Route
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
app.get('/docs', (req, res) => {
  res.render('docs');
});

// Handle undefined routes
app.use((req, res, next) => {
  return sendError(res, 404, `Can't find ${req.originalUrl} on this server!`);
});

// Global error handler
app.use(errorHandler);

module.exports = app;
