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
    }
}, {
    timestamps: true // Automatically adds createdAt
});

module.exports = Chat;