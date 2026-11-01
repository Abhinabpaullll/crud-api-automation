'use strict';

/**
 * Centralised error-handling middleware.
 * Must be registered AFTER all routes.
 */

const { error } = require('../utils/response');

// Catch malformed JSON bodies (D-15)
// eslint-disable-next-line no-unused-vars
function jsonSyntaxErrorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return error(res, 400, 'INVALID_JSON', 'Request body contains malformed JSON');
  }
  next(err);
}

// Generic / unexpected error handler
// eslint-disable-next-line no-unused-vars
function internalErrorHandler(err, req, res, next) {
  console.error('[error]', err);
  return error(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}

module.exports = { jsonSyntaxErrorHandler, internalErrorHandler };
