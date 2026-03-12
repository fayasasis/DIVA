const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Trash = sequelize.define('Trash', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    type: {
        type: DataTypes.STRING, // 'HISTORY_WIPE' or 'MODEL_RESET'
        allowNull: false
    },
    data: {
        type: DataTypes.TEXT, // Serialized JSON blob of deleted data
        allowNull: false
    }
}, {
    timestamps: true
});

module.exports = Trash;
