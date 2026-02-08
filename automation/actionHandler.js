// ⚠️ REFACTORED: Logic moved to ./index.js and ./modules
// This file exists for backward compatibility with server.js imports.

const { executeAction } = require('./index');

module.exports = { executeAction };