'use strict';

const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    name:   { type: String, required: true, trim: true, maxlength: 100 },
    email:  { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    course: { type: String, required: true, trim: true, maxlength: 100 },
    year:   { type: Number, required: true, min: 1, max: 4 },
    cgpa:   { type: Number, required: true, min: 0, max: 10 },
  },
  {
    timestamps: true,           // creates createdAt, updatedAt
    versionKey: false,          // no __v
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toHexString();
        delete ret._id;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Student', studentSchema);

