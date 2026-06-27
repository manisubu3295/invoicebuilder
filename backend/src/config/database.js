require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const path = require('path');

const sqliteConfig = {
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../akb_transport.sqlite'),
  logging: false,
};

module.exports = {
  development: sqliteConfig,
  production: sqliteConfig,
};
