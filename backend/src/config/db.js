'use strict';

/**
 * db.js — connects to MongoDB when MONGODB_URI is set.
 * Exports an async `connect()` function and exposes the active repository
 * via `getRepository()` so all other modules always get the right one.
 */

const mongoose = require('mongoose');
const { MONGODB_URI } = require('../config/env');
const memoryRepository = require('../models/memoryRepository');
const mongoRepository = require('../models/mongoRepository');

let _repository = null;

/**
 * Attempt to connect to MongoDB.
 * On success  -> uses mongoRepository.
 * On failure or no URI -> uses memoryRepository.
 */
async function connect() {
  if (!MONGODB_URI) {
    console.log('[storage] MONGODB_URI not set — using IN-MEMORY store');
    _repository = memoryRepository;
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('[storage] Connected to MongoDB');
    _repository = mongoRepository;
  } catch (err) {
    console.warn(`[storage] MongoDB connection failed (${err.message}) — falling back to IN-MEMORY store`);
    _repository = memoryRepository;
  }
}

function getRepository() {
  if (!_repository) throw new Error('Repository not initialised — call connect() first');
  return _repository;
}

function getMode() {
  return _repository ? _repository.mode : 'memory';
}

module.exports = { connect, getRepository, getMode };
