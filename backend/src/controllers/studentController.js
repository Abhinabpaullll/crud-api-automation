'use strict';

/**
 * Student controller.
 *
 * D-08 check order:
 *   1. id format      → handled by router.param('id') in routes/students.js
 *                        (fires before body parser, so INVALID_ID beats INVALID_JSON)
 *   2. JSON syntax    → handled by express.json() error propagating to errorHandler
 *   3. body validation→ validateStudentInput()
 *   4. existence      → repo.findById()
 *   5. uniqueness     → repo.create() / repo.update()
 */

const { getRepository } = require('../config/db');
const { validateStudentInput, validateListQuery } = require('../utils/validate');
const { success, error } = require('../utils/response');

// POST /api/students
async function createStudent(req, res, next) {
  try {
    const result = validateStudentInput(req.body);
    if (!result.valid) {
      return error(res, 400, 'VALIDATION_ERROR', 'Validation failed', result.details);
    }

    const repo = getRepository();
    const outcome = await repo.create(result.data);
    if (outcome.duplicate) {
      return error(res, 409, 'DUPLICATE_EMAIL', 'A student with this email already exists');
    }

    return success(res, 201, { data: outcome.student });
  } catch (err) {
    next(err);
  }
}

// GET /api/students
async function listStudents(req, res, next) {
  try {
    const qResult = validateListQuery(req.query);
    if (!qResult.valid) {
      return error(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', qResult.details);
    }

    const repo = getRepository();
    const { data, total, count, page, limit } = await repo.list(qResult.data);
    return success(res, 200, { count, total, page, limit, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/students/:id
// (id already validated by router.param)
async function getStudent(req, res, next) {
  try {
    const repo = getRepository();
    const student = await repo.findById(req.params.id);
    if (!student) {
      return error(res, 404, 'NOT_FOUND', 'Student not found');
    }
    return success(res, 200, { data: student });
  } catch (err) {
    next(err);
  }
}

// PUT /api/students/:id
// (id already validated by router.param)
async function updateStudent(req, res, next) {
  try {
    // D-08 step 3: body validation
    const result = validateStudentInput(req.body);
    if (!result.valid) {
      return error(res, 400, 'VALIDATION_ERROR', 'Validation failed', result.details);
    }

    const repo = getRepository();

    // D-08 step 4: existence
    const existing = await repo.findById(req.params.id);
    if (!existing) {
      return error(res, 404, 'NOT_FOUND', 'Student not found');
    }

    // D-08 step 5: uniqueness (handled inside repo.update)
    const outcome = await repo.update(req.params.id, result.data);
    if (!outcome) {
      return error(res, 404, 'NOT_FOUND', 'Student not found');
    }
    if (outcome.duplicate) {
      return error(res, 409, 'DUPLICATE_EMAIL', 'A student with this email already exists');
    }

    return success(res, 200, { data: outcome.student });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/students/:id
// (id already validated by router.param)
async function deleteStudent(req, res, next) {
  try {
    const repo = getRepository();
    const deleted = await repo.remove(req.params.id);
    if (!deleted) {
      return error(res, 404, 'NOT_FOUND', 'Student not found');
    }
    // D-06: 204 No Content with empty body
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { createStudent, listStudents, getStudent, updateStudent, deleteStudent };
