'use strict';

/**
 * Shared response helpers.
 */

const { INJECT_BUG } = require('../config/env');

function success(res, statusCode, data) {
  return res.status(statusCode).json({ success: true, ...data });
}

function error(res, statusCode, code, message, details) {
  const body = { success: false, error: { code, message } };
  if (details) body.error.details = details;
  if (INJECT_BUG === 'wrong-content-type') {
    return res.status(statusCode).type('text/html').send(JSON.stringify(body));
  }
  return res.status(statusCode).json(body);
}

module.exports = { success, error };

