'use strict';

const { Router } = require('express');
const {
  createStudent,
  listStudents,
  getStudent,
  updateStudent,
  deleteStudent,
} = require('../controllers/studentController');

const router = Router();

router.post('/',    createStudent);
router.get('/',     listStudents);
router.get('/:id',  getStudent);
router.put('/:id',  updateStudent);
router.delete('/:id', deleteStudent);

module.exports = router;
