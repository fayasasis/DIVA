const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Chat = sequelize.define('Chat', {
    role: {
        type: DataTypes.STRING,
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT, // TEXT allows longer messages
        allowNull: false
    },
    sessionId: {
        type: DataTypes.INTEGER,
        allowNull: true // Allow null for backward compatibility or global logs if needed
    }
}, {
    timestamps: true // Automatically adds createdAt
});

module.exports = Chat;