'use strict';

const { getRepository } = require('../config/db');

// POST /api/test/reset  — 204 No Content
async function resetTestData(req, res, next) {
  try {
    const repo = getRepository();
    await repo.reset();
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { resetTestData };

