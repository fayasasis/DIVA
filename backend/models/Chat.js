// ==============================
// CHAT MESSAGE MODEL (SCHEMA)
// ==============================

// Import DataTypes to define the structure of our data.
const { DataTypes } = require('sequelize');

// Import the database connection.
const sequelize = require('../config/database');

// Define the 'Chat' model.
// This represents an individual message within a conversation.
// Valid table name will be 'Chats'.
const Chat = sequelize.define('Chat', {

    // Column: Role
    // Who sent the message? ('user' or 'bot')
    role: {
        type: DataTypes.STRING,
        allowNull: false // Every message must have a sender
    },

    // Column: Message Content
    // The actual text payload of the message.
    message: {
        type: DataTypes.TEXT, // TEXT type allows for long paragraphs/responses
        allowNull: false      // Cannot have an empty message
    },

    // Column: Session ID (Foreign Key)
    // Links this message to a specific Session (Conversation).
    sessionId: {
        type: DataTypes.INTEGER,
        allowNull: true // Technically allow null, but in practice, it should always be linked.
    }
}, {
    timestamps: true // Automatically adds 'createdAt' (timestamp) and 'updatedAt'
});

// Export the model.
module.exports = Chat;