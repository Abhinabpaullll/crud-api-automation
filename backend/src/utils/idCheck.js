'use strict';

/**
 * Validates that a route param looks like a 24-char lowercase hex string (D-04, D-05).
 */
const ID_RE = /^[a-f0-9]{24}$/;

function isValidId(id) {
  return ID_RE.test(id);
}

module.exports = { isValidId };

