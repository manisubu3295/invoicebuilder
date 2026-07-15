const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');

const isProd = process.env.NODE_ENV === 'production';
const logsDir = path.join(__dirname, '../../logs');

const fileTransport = new winston.transports.DailyRotateFile({
  dirname: logsDir,
  filename: 'app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '30d', // keep 30 days of history, older files are deleted automatically
  zippedArchive: true,
  level: 'info',
});

const errorFileTransport = new winston.transports.DailyRotateFile({
  dirname: logsDir,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '90d',
  zippedArchive: true,
  level: 'error',
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [fileTransport, errorFileTransport],
});

// Also echo to console outside production so `npm run dev` still shows logs live
if (!isProd) {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}] ${message}${extra}`;
      })
    ),
  }));
}

// morgan writes HTTP request lines here instead of stdout
logger.stream = {
  write: (message) => logger.info(message.trim(), { type: 'http' }),
};

module.exports = logger;
