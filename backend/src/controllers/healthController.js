'use strict';

const { getMode } = require('../config/db');
const { success } = require('../utils/response');

function getHealth(req, res) {
  return success(res, 200, {
    data: {
      status: 'ok',
      storage: getMode(),
    },
  });
}

module.exports = { getHealth };
