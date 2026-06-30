require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pgConfig = {
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'akb_transport',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  logging: false,
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: {
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    statement_timeout: 30000,
    idle_in_transaction_session_timeout: 30000,
  },
};

module.exports = {
  development: pgConfig,
  production: pgConfig,
};
