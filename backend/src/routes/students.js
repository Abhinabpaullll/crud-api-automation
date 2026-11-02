'use strict';

const { Router } = require('express');
const {
  createStudent,
  listStudents,
  getStudent,
  updateStudent,
  deleteStudent,
} = require('../controllers/studentController');
const { validateIdParam } = require('../middleware/validateId');

const router = Router();

// Register param middleware FIRST so id is validated before express.json()
// processes the body for /:id routes (D-08: id format → JSON → body → existence → uniqueness).
router.param('id', validateIdParam);

router.post('/',      createStudent);
router.get('/',       listStudents);
router.get('/:id',    getStudent);
router.put('/:id',    updateStudent);
router.delete('/:id', deleteStudent);

module.exports = router;
