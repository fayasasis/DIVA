// ==============================
// DIVA AUTOMATION DISPATCHER
// ==============================
// This file acts as the "Central Command Center" for all system actions.
// It receives a high-level "Decision" from the AI (server.js) and routes it
// to the correct specialized control module (Apps, Windows, Files, etc.).

// Import specialized control modules
const systemControl = require('./modules/systemControl'); // Handles Volume, Power, Brightness
const windowControl = require('./modules/windowControl'); // Handles Min/Max/Switching Windows
const appControl = require('./modules/appControl');       // Handles Launching/Closing Apps
const fileControl = require('./modules/fileControl');     // Handles File Creation/Deletion
const noteControl = require('./modules/noteControl');     // Handles Notepad/Notes
const webControl = require('./modules/webControl');       // Handles Browser/Search/YouTube
const { runPowerShell } = require('./utils/powershell');  // Generic PowerShell Runner

/**
 * Main Execution Function
 * Routing logic to decide WHICH module should handle the request.
 * 
 * @param {object} decision - The JSON object from AI (contains intent, entities).
 * @param {string} rawQuery - The original user text (used for fuzzy matching fallback).
 */
async function executeAction(decision, rawQuery = "") {
    // Normalize intent: Convert to lowercase for consistent comparison
    const rawIntent = (decision.intent || decision.type || "").toLowerCase();

    // Extract entities: The specific details (e.g., app name, file name)
    const entities = decision.entities || {};

    // Helper function to safely extract string values.
    // Sometimes entities come as arrays ["notepad"] instead of strings "notepad".
    const extractString = (val) => {
        if (!val) return "";
        if (Array.isArray(val)) return val.join(" ");
        return String(val);
    };

    // Extract 'Target' (What to act on? e.g., "Notepad", "song.mp3")
    const target = extractString(entities.app || entities.name || entities.target || entities.query).toLowerCase().trim();

    // Extract 'Action' (What to do? e.g., "open", "delete")
    let action = extractString(entities.action || entities.command).toLowerCase();

    // --- ROBUSTNESS LAYER ---
    // If the AI correctly identified the intent but failed to extract the explicit 'action' keyword,
    // we try to derive it from the raw user query ourselves.
    if (!action) {
        // Combine intent and query to search for keywords
        const checkSource = (rawIntent + " " + rawQuery).toLowerCase();

        // Check for common synonyms and map them to standard actions
        if (checkSource.includes('close') || checkSource.includes('exit') || checkSource.includes('quit')) action = 'close';
        else if (checkSource.includes('open') || checkSource.includes('start') || checkSource.includes('launch')) action = 'open';
        else if (checkSource.includes('minimize')) action = 'minimize';
        else if (checkSource.includes('maximize')) action = 'maximize';
        else if (checkSource.includes('restart')) action = 'restart';
        else if (checkSource.includes('delete') || checkSource.includes('remove')) action = 'delete';
        else if (checkSource.includes('create') || checkSource.includes('make')) action = 'create';
    }

    // Fallback Query Construction
    // Used if we need to pass the full context to a sub-module
    const cleanQuery = (rawQuery || `${rawIntent} ${target} ${action}`).toLowerCase();

    // Log the routing decision for debugging
    console.log(`Processing: [${rawIntent}] Action: ${action} | Target: ${target} | Raw: "${cleanQuery}"`);

    // --- 1. GLOBAL OVERRIDES (High Priority) ---
    // Some commands are so critical or simple they skip the AI intent routing.

    // Check if it's a System Command (Shutdown, Sleep, Lock)
    const sysOverride = await systemControl.handleSystemOverrides(cleanQuery);
    if (sysOverride) return sysOverride;

    // Check if it's a Window Command (Minimize All, Show Desktop)
    const winOverride = await windowControl.handleWindowOverrides(cleanQuery);
    if (winOverride) return winOverride;

    // --- 2. MODULE ROUTING (Standard Flow) ---

    // SPECIAL CASE: SPOTIFY/MEDIA
    // If user mentions "Spotify" AND "Play/Music", route to WebControl (Media Keys)
    // instead of trying to "Open Spotify.exe" again.
    if (target === 'spotify' && (cleanQuery.includes('play') || cleanQuery.includes('music'))) {
        return await webControl.executeWebAction(target, action, entities, cleanQuery);
    }

    // ROUTE: APP CONTROL
    // Triggers if intent is 'app_control' OR includes 'open' keyword (but not a URL)
    if (rawIntent.includes('app') || (rawIntent.includes('open') && !rawIntent.includes('url'))) {
        const appResult = await appControl.executeAppAction(target, action);

        // If app action succeeded, return result
        if (appResult) return appResult;

        // FALLBACK: Parsing Error Handling
        // If "Open [X]" failed because [X] isn't an installed app,
        // we assume the user might have meant "Search for [X]".
        console.log(`App '${target}' not found. Falling back to Web Search.`);
        return await webControl.executeWebAction(target, action, entities, cleanQuery);
    }

    // ROUTE: WINDOW CONTROL
    // Triggers for window management (focus, minimize, maximize)
    if (rawIntent.includes('window') || rawIntent === 'switch_focus' || action === 'show_desktop') {
        return await windowControl.executeWindowAction(target, action);
    }

    // ROUTE: SYSTEM CONTROL
    // Triggers for Volume, Brightness, Hardware controls
    if (rawIntent.includes('system') || rawIntent.includes('volume') || rawIntent.includes('brightness')) {
        return await systemControl.executeSystemAction(target, action, entities, rawIntent);
    }

    // ROUTE: WEB & BROWSER CONTROL
    // Triggers for Search, YouTube, Media Control, Opening URLs
    if (
        decision.type === 'web_search' ||
        rawIntent.includes('web') ||
        rawIntent.includes('search') ||
        rawIntent.includes('youtube') ||
        rawIntent.includes('media') ||
        rawIntent.includes('play') ||
        rawIntent.includes('pause') ||
        rawIntent.includes('music') ||
        rawIntent.includes('tab') ||
        rawIntent.includes('image') ||
        rawIntent.includes('picture') ||
        rawIntent.includes('photo') ||
        cleanQuery.includes('image') ||
        cleanQuery.includes('picture') ||
        cleanQuery.includes('photo') ||
        target.includes('weather')
    ) {
        return await webControl.executeWebAction(target, action, entities, cleanQuery);
    }

    // ROUTE: FILE OPERATIONS
    // Triggers for creating folders, deleting files
    if (rawIntent === 'file_action' || rawIntent === 'file_management' || rawIntent.includes('file') || rawIntent.includes('folder')) {
        return await fileControl.executeFileAction(target, action, entities, rawIntent, cleanQuery);
    }

    // ROUTE: NOTE TAKING
    // Triggers for "Remind me", "Write a note"
    if (rawIntent.includes('note')) {
        return await noteControl.executeNoteAction(target, action, entities, rawIntent);
    }

    // Default return if no module matched
    return "Done.";
}

// Export the centralized execution function
module.exports = { executeAction };
