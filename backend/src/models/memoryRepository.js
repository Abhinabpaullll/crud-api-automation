'use strict';

/**
 * In-memory student repository.
 * Generates 24-character lowercase hex IDs (ObjectId-style).
 * Enforces case-insensitive unique emails.
 * Provides the same interface as the Mongo repository so controllers
 * never need to know which store is active.
 */

const crypto = require('crypto');

/** @type {Map<string, object>} id -> student plain object */
const store = new Map();

function generateId() {
  return crypto.randomBytes(12).toString('hex'); // 24 hex chars
}

function toPublic(doc) {
  // Return a shallow copy without internal _email key
  const { _emailLower, ...rest } = doc; // eslint-disable-line no-unused-vars
  return { ...rest };
}

const memoryRepository = {
  /**
   * Create a new student.
   * @param {object} fields - { name, email (already trimmed+lowercased), course, year, cgpa }
   * @returns {{ student: object }|{ duplicate: true }}
   */
  create(fields) {
    // uniqueness check (case-insensitive already since email is normalised before calling)
    for (const doc of store.values()) {
      if (doc._emailLower === fields.email) {
        return { duplicate: true };
      }
    }
    const now = new Date().toISOString();
    const id = generateId();
    const doc = {
      id,
      name: fields.name,
      email: fields.email,
      course: fields.course,
      year: fields.year,
      cgpa: fields.cgpa,
      createdAt: now,
      updatedAt: now,
      _emailLower: fields.email, // already lower-cased
    };
    store.set(id, doc);
    return { student: toPublic(doc) };
  },

  /**
   * List students with optional course filter and pagination.
   */
  list({ course, page, limit }) {
    let items = Array.from(store.values());
    if (course) {
      const lc = course.toLowerCase();
      items = items.filter((d) => d.course.toLowerCase() === lc);
    }
    const total = items.length;
    const skip = (page - 1) * limit;
    const slice = items.slice(skip, skip + limit);
    return {
      data: slice.map(toPublic),
      total,
      count: slice.length,
      page,
      limit,
    };
  },

  /**
   * Find by id. Returns null if not found.
   */
  findById(id) {
    const doc = store.get(id);
    return doc ? toPublic(doc) : null;
  },

  /**
   * Full replacement (PUT). Returns { student }|{ duplicate: true }|null (not found).
   */
  update(id, fields) {
    const existing = store.get(id);
    if (!existing) return null;
    // Check uniqueness: another student may not already hold this email
    for (const [sid, doc] of store.entries()) {
      if (sid !== id && doc._emailLower === fields.email) {
        return { duplicate: true };
      }
    }
    const updated = {
      ...existing,
      name: fields.name,
      email: fields.email,
      course: fields.course,
      year: fields.year,
      cgpa: fields.cgpa,
      updatedAt: new Date().toISOString(),
      _emailLower: fields.email,
    };
    store.set(id, updated);
    return { student: toPublic(updated) };
  },

  /**
   * Delete by id. Returns true if deleted, false if not found.
   */
  remove(id) {
    return store.delete(id);
  },

  /**
   * Delete all students (test-reset only).
   */
  reset() {
    store.clear();
  },

  /**
   * Storage mode label used by /health.
   */
  mode: 'memory',
};

module.exports = memoryRepository;
