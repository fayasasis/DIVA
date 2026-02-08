const Note = require('../../backend/models/Note');

const executeNoteAction = async (target, action, entities, rawIntent) => {
    try {
        if (action === 'add' || rawIntent.includes('add')) {
            await Note.create({ content: entities.content || target });
            return "Note saved.";
        } else if (action === 'list' || rawIntent.includes('read')) {
            const notes = await Note.findAll({ order: [['createdAt', 'DESC']], limit: 5 });
            return notes.length ? "Recent notes: " + notes.map(n => n.content).join(", ") : "No notes.";
        }
    } catch (e) {
        return "Database error.";
    }
    return "Unknown note action.";
};

module.exports = { executeNoteAction };
