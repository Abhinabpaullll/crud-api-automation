'use strict';

const { Router } = require('express');
const { resetTestData } = require('../controllers/testController');

const router = Router();

router.post('/reset', resetTestData);

module.exports = router;
