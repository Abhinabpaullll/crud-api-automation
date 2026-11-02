'use strict';

/**
 * Shared response helpers.
 */

function success(res, statusCode, data) {
  return res.status(statusCode).json({ success: true, ...data });
}

function error(res, statusCode, code, message, details) {
  const body = { success: false, error: { code, message } };
  if (details) body.error.details = details;
  return res.status(statusCode).json(body);
}

module.exports = { success, error };

