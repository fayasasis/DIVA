// ==============================
// NOTE CONTROL MODULE
// ==============================
// Handles saving and retrieving quick notes using the Database.

const Note = require('../../backend/models/Note'); // Import Sequelize Model (Assuming it exists, was not in previous plan but referenced)

const executeNoteAction = async (target, action, entities, rawIntent) => {
    try {
        // --- ACTION: ADD NOTE ---
        if (action === 'add' || rawIntent.includes('add')) {
            // Create new entry
            await Note.create({ content: entities.content || target });
            return "Note saved.";

        } else if (action === 'list' || rawIntent.includes('read')) {
            // --- ACTION: READ NOTES ---
            // Fetch last 5 notes
            const notes = await Note.findAll({ order: [['createdAt', 'DESC']], limit: 5 });
            return notes.length ? "Recent notes: " + notes.map(n => n.content).join(", ") : "No notes.";
        }
    } catch (e) {
        return "Database error.";
    }
    return "Unknown note action.";
};

module.exports = { executeNoteAction };
