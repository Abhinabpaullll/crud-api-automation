'use strict';

/**
 * Validation helper.
 *
 * Rules (D-08 to D-12):
 *  - All five fields are required.
 *  - name:   non-blank string (trimmed), max 100
 *  - email:  trimmed, lower-cased, basic format, max 254
 *  - course: non-blank string (trimmed), max 100
 *  - year:   JSON integer (Number.isInteger), 1–4 inclusive
 *  - cgpa:   JSON number (typeof === 'number' && not NaN), 0–10 inclusive
 *  - Unknown fields are silently ignored (D-11).
 *  - Client-supplied id / createdAt / updatedAt are ignored.
 *
 * Returns { valid: true, data } or { valid: false, details: [{field, message}] }
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const { INJECT_BUG } = require('../config/env');

function validateStudentInput(raw) {
  const details = [];

  // --- name ---
  if (raw.name === undefined || raw.name === null) {
    details.push({ field: 'name', message: 'name is required' });
  } else if (typeof raw.name !== 'string') {
    details.push({ field: 'name', message: 'name must be a string' });
  } else {
    const name = raw.name.trim();
    if (name.length === 0) details.push({ field: 'name', message: 'name must not be blank' });
    else if (name.length > 100) details.push({ field: 'name', message: 'name must be at most 100 characters' });
  }

  // --- email ---
  if (raw.email === undefined || raw.email === null) {
    details.push({ field: 'email', message: 'email is required' });
  } else if (typeof raw.email !== 'string') {
    details.push({ field: 'email', message: 'email must be a string' });
  } else {
    const email = raw.email.trim().toLowerCase();
    if (email.length === 0) details.push({ field: 'email', message: 'email must not be blank' });
    else if (INJECT_BUG !== 'skip-email-validation') {
      if (email.length > 254) details.push({ field: 'email', message: 'email must be at most 254 characters' });
      else if (!EMAIL_RE.test(email)) details.push({ field: 'email', message: 'email must be a valid email address' });
    }
  }

  // --- course ---
  if (raw.course === undefined || raw.course === null) {
    details.push({ field: 'course', message: 'course is required' });
  } else if (typeof raw.course !== 'string') {
    details.push({ field: 'course', message: 'course must be a string' });
  } else {
    const course = raw.course.trim();
    if (course.length === 0) details.push({ field: 'course', message: 'course must not be blank' });
    else if (course.length > 100) details.push({ field: 'course', message: 'course must be at most 100 characters' });
  }

  // --- year (must be a JSON integer, 1-4) ---
  if (raw.year === undefined || raw.year === null) {
    details.push({ field: 'year', message: 'year is required' });
  } else if (typeof raw.year !== 'number' || !Number.isInteger(raw.year)) {
    details.push({ field: 'year', message: 'year must be an integer' });
  } else {
    const maximumYear = INJECT_BUG === 'year-upper-bound-5' ? 5 : 4;
    if (raw.year < 1 || raw.year > maximumYear) {
      details.push({ field: 'year', message: `year must be between 1 and ${maximumYear}` });
    }
  }

  // --- cgpa (must be a JSON number, 0-10 inclusive) ---
  if (raw.cgpa === undefined || raw.cgpa === null) {
    details.push({ field: 'cgpa', message: 'cgpa is required' });
  } else if (typeof raw.cgpa !== 'number' || isNaN(raw.cgpa)) {
    details.push({ field: 'cgpa', message: 'cgpa must be a number' });
  } else if (raw.cgpa < 0 || raw.cgpa > 10) {
    details.push({ field: 'cgpa', message: 'cgpa must be between 0 and 10' });
  }

  if (details.length > 0) return { valid: false, details };

  // Build sanitised data (unknown fields dropped, D-11)
  return {
    valid: true,
    data: {
      name: raw.name.trim(),
      email: raw.email.trim().toLowerCase(),
      course: raw.course.trim(),
      year: raw.year,
      cgpa: raw.cgpa,
    },
  };
}

/**
 * Validate GET /api/students query parameters (D-13).
 */
function validateListQuery(query) {
  const details = [];
  let page = 1;
  let limit = 10;

  if (query.page !== undefined) {
    const p = Number(query.page);
    if (!Number.isInteger(p) || p < 1) {
      details.push({ field: 'page', message: 'page must be an integer >= 1' });
    } else {
      page = p;
    }
  }

  if (query.limit !== undefined) {
    const l = Number(query.limit);
    if (!Number.isInteger(l) || l < 1 || l > 100) {
      details.push({ field: 'limit', message: 'limit must be an integer between 1 and 100' });
    } else {
      limit = l;
    }
  }

  if (details.length > 0) return { valid: false, details };
  return { valid: true, data: { course: query.course, page, limit } };
}

module.exports = { validateStudentInput, validateListQuery };

