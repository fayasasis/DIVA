// ==============================
// SEMANTIC CACHE MODEL (SCHEMA)
// ==============================

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SemanticCache = sequelize.define('SemanticCache', {
    text: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true
    },
    vector: {
        type: DataTypes.TEXT, // Store array as JSON string
        allowNull: false
    },
    action: {
        type: DataTypes.TEXT, // Store the executed decision action JSON string
        allowNull: false
    }
}, {
    timestamps: true
});

module.exports = SemanticCache;
