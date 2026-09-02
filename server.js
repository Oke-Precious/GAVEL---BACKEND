const app = require('./src/app');
const connectDB = require('./src/config/db');
const env = require('./src/config/env');

// Handle uncaught exceptions
process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION! Shutting down...');
  console.log(err.name, err.message, err.stack);
  process.exit(1);
});

// Connect to database
connectDB();

const server = app.listen(env.PORT, () => {
  console.log(`App running in ${env.NODE_ENV} mode on port ${env.PORT}...`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION! Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
