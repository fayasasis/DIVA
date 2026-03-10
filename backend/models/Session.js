// ==============================
// SESSION MODEL (DATABASE SCHEMA)
// ==============================

// Import DataTypes from Sequelize to define column types (INTEGER, STRING, etc.)
const { DataTypes } = require('sequelize');

// Import the configured database connection instance
const sequelize = require('../config/database');

// Define the 'Session' model.
// This represents a "Chat Session" or "Conversation Thread" in the database.
// It will correspond to a table named 'Sessions' in SQLite.
const Session = sequelize.define('Session', {

    // Column: ID
    // Unique identifier for each session.
    id: {
        type: DataTypes.INTEGER, // Integer number
        primaryKey: true,        // This is the primary key (unique ID)
        autoIncrement: true      // Automatically increase (1, 2, 3...)
    },

    // Column: Title
    // A short name/summary for the conversation (e.g., "React Help", "Weather Check").
    title: {
        type: DataTypes.STRING,  // Short text string
        allowNull: false,        // Cannot be empty
        defaultValue: 'New Chat' // Default value if nothing is provided
    },

    // Column: isTitleGenerated
    // Flags if the AI has generated a proper conversational summary title for this session yet.
    isTitleGenerated: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    timestamps: true // Automatically adds 'createdAt' and 'updatedAt' columns
});

// Export the model to be valid and usable in other files.
module.exports = Session;
