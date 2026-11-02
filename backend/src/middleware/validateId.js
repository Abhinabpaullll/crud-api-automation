'use strict';

/**
 * validateIdParam  —  D-08 step 1.
 *
 * Runs as a ROUTER-LEVEL middleware on /api/students/:id routes,
 * registered BEFORE express.json() parses the body.  That way a request with
 * a bad :id AND a malformed body returns INVALID_ID, not INVALID_JSON.
 *
 * Express calls param-middleware (router.param) synchronously before body
 * parsers attached at the app level, so attaching the id check here gives us
 * the correct check order dictated by D-08:
 *   1. id format   → 400 INVALID_ID
 *   2. JSON syntax → 400 INVALID_JSON   (express.json() error handler)
 *   3. body rules  → 400 VALIDATION_ERROR
 *   4. existence   → 404 NOT_FOUND
 *   5. uniqueness  → 409 DUPLICATE_EMAIL
 */

const { isValidId } = require('../utils/idCheck');
const { error }     = require('../utils/response');

function validateIdParam(req, res, next, id) {
  if (!isValidId(id)) {
    return error(res, 400, 'INVALID_ID', 'id must be a 24-character lowercase hex string');
  }
  next();
}

module.exports = { validateIdParam };

