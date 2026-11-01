'use strict';

/**
 * Mongoose-backed student repository.
 * Same interface as memoryRepository so controllers stay storage-agnostic.
 */

const Student = require('./Student');

function toPublic(doc) {
  return doc.toJSON();
}

const mongoRepository = {
  async create(fields) {
    try {
      const student = await Student.create(fields);
      return { student: toPublic(student) };
    } catch (err) {
      // Mongo duplicate key error code
      if (err.code === 11000) return { duplicate: true };
      throw err;
    }
  },

  async list({ course, page, limit }) {
    const filter = {};
    if (course) {
      // case-insensitive exact match via regex anchor
      filter.course = { $regex: `^${escapeRegex(course)}$`, $options: 'i' };
    }
    const [items, total] = await Promise.all([
      Student.find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean({ virtuals: true }),
      Student.countDocuments(filter),
    ]);
    // lean with virtuals gives us `id` but keeps _id; clean up
    const data = items.map((d) => {
      const { _id, __v, ...rest } = d;
      return rest;
    });
    return { data, total, count: data.length, page, limit };
  },

  async findById(id) {
    const doc = await Student.findById(id);
    return doc ? toPublic(doc) : null;
  },

  async update(id, fields) {
    // Check duplicate BEFORE saving (D-08 order: existence first, then uniqueness)
    // Existence is checked by the caller; here we just attempt the save.
    try {
      const doc = await Student.findByIdAndUpdate(
        id,
        { $set: fields },
        { new: true, runValidators: true }
      );
      if (!doc) return null;
      return { student: toPublic(doc) };
    } catch (err) {
      if (err.code === 11000) return { duplicate: true };
      throw err;
    }
  },

  async remove(id) {
    const res = await Student.deleteOne({ _id: id });
    return res.deletedCount > 0;
  },

  async reset() {
    await Student.deleteMany({});
  },

  mode: 'mongo',
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = mongoRepository;
