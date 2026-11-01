'use strict';

require('dotenv').config();

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  MONGODB_URI: process.env.MONGODB_URI || '',
  ENABLE_TEST_ROUTES: process.env.ENABLE_TEST_ROUTES === 'true',
};
