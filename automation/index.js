// DIVA Automation - Main Entry Point
const systemControl = require('./modules/systemControl');
const windowControl = require('./modules/windowControl');
const appControl = require('./modules/appControl');
const fileControl = require('./modules/fileControl');
const noteControl = require('./modules/noteControl');
const webControl = require('./modules/webControl');
const { runPowerShell } = require('./utils/powershell');

async function executeAction(decision, rawQuery = "") {
    const rawIntent = (decision.intent || decision.type || "").toLowerCase();
    const entities = decision.entities || {};

    // Helper to safely extract string from potentially array-based entities
    const extractString = (val) => {
        if (!val) return "";
        if (Array.isArray(val)) return val.join(" ");
        return String(val);
    };


    const target = extractString(entities.app || entities.name || entities.target || entities.query).toLowerCase().trim();
    let action = extractString(entities.action || entities.command).toLowerCase();

    // 🚨 ROBUSTNESS: If action is missing, try to derive it from the intent OR the raw query
    if (!action) {
        const checkSource = (rawIntent + " " + rawQuery).toLowerCase();

        if (checkSource.includes('close') || checkSource.includes('exit') || checkSource.includes('quit')) action = 'close';
        else if (checkSource.includes('open') || checkSource.includes('start') || checkSource.includes('launch')) action = 'open';
        else if (checkSource.includes('minimize')) action = 'minimize';
        else if (checkSource.includes('maximize')) action = 'maximize';
        else if (checkSource.includes('restart')) action = 'restart';
        else if (checkSource.includes('delete') || checkSource.includes('remove')) action = 'delete';
        else if (checkSource.includes('create') || checkSource.includes('make')) action = 'create';
    }

    // Fallback Query Construction
    const cleanQuery = (rawQuery || `${rawIntent} ${target} ${action}`).toLowerCase();

    console.log(`🦾 Processing: [${rawIntent}] Action: ${action} | Target: ${target} | Raw: "${cleanQuery}"`);

    // 🚨 1. Global Heuristic Overrides (Power, Window Verbs)
    // Checks for specific keywords that usually trip up the AI
    const sysOverride = await systemControl.handleSystemOverrides(cleanQuery);
    if (sysOverride) return sysOverride;

    const winOverride = await windowControl.handleWindowOverrides(cleanQuery);
    if (winOverride) return winOverride;

    // 🚨 2. Module Routing based on Intent

    // SPOTIFY/MEDIA OVERRIDE (Route specific app media commands to WebControl)
    if (target === 'spotify' && (cleanQuery.includes('play') || cleanQuery.includes('music'))) {
        return await webControl.executeWebAction(target, action, entities, cleanQuery);
    }

    // APP CONTROL
    if (rawIntent.includes('app') || (rawIntent.includes('open') && !rawIntent.includes('url'))) {
        const appResult = await appControl.executeAppAction(target, action);
        if (appResult) return appResult;

        // If App Control failed finding an app, treat "Open X" as a Web Search for "X"
        console.log(`⚠️ App '${target}' not found. Falling back to Web Search.`);
        return await webControl.executeWebAction(target, action, entities, cleanQuery);
    }

    // WINDOW CONTROL
    if (rawIntent.includes('window') || rawIntent === 'switch_focus' || action === 'show_desktop') {
        return await windowControl.executeWindowAction(target, action);
    }

    // SYSTEM CONTROL (Volume/Brightness fallback)
    if (rawIntent.includes('system') || rawIntent.includes('volume') || rawIntent.includes('brightness')) {
        return await systemControl.executeSystemAction(target, action, entities, rawIntent);
    }

    // WEB, MEDIA & BROWSER CONTROL
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

    // FILE OPS
    if (rawIntent === 'file_action' || rawIntent === 'file_management' || rawIntent.includes('file') || rawIntent.includes('folder')) {
        return await fileControl.executeFileAction(target, action, entities, rawIntent, cleanQuery);
    }

    // NOTES
    if (rawIntent.includes('note')) {
        return await noteControl.executeNoteAction(target, action, entities, rawIntent);
    }

    return "Done.";
}

module.exports = { executeAction };
