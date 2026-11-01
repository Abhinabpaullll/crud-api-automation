'use strict';

/**
 * Student controller.
 * Check order per D-08: id format -> JSON syntax -> body validation -> existence -> uniqueness.
 */

const { getRepository } = require('../config/db');
const { validateStudentInput, validateListQuery } = require('../utils/validate');
const { isValidId } = require('../utils/idCheck');
const { success, error } = require('../utils/response');

// POST /api/students
async function createStudent(req, res, next) {
  try {
    // D-08: JSON parsing errors are caught by middleware before we get here.
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
async function getStudent(req, res, next) {
  try {
    // D-08 step 1: id format
    if (!isValidId(req.params.id)) {
      return error(res, 400, 'INVALID_ID', 'id must be a 24-character lowercase hex string');
    }

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
async function updateStudent(req, res, next) {
  try {
    // D-08 step 1: id format
    if (!isValidId(req.params.id)) {
      return error(res, 400, 'INVALID_ID', 'id must be a 24-character lowercase hex string');
    }

    // D-08 step 2: JSON syntax errors already handled by middleware.
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

    // D-08 step 5: uniqueness (performed inside repo.update)
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
async function deleteStudent(req, res, next) {
  try {
    // D-08 step 1: id format
    if (!isValidId(req.params.id)) {
      return error(res, 400, 'INVALID_ID', 'id must be a 24-character lowercase hex string');
    }

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
