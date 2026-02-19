// ==============================
// WEB & MEDIA CONTROL MODULE
// ==============================
// Handles everything related to Browsers (URL navigation), Search Engines, and Media Playback.

const { runPowerShell } = require('../utils/powershell'); // PS Runner
const { forceFocusWindow } = require('./windowControl');  // To manage Spotify focus

// SITE MAP: Common shortcuts
const SITE_MAP = {
    'gmail': 'https://mail.google.com',
    'whatsapp': 'https://web.whatsapp.com',
    'whatsapp web': 'https://web.whatsapp.com',
    'github': 'https://github.com',
    'youtube': 'https://www.youtube.com',
    'stackoverflow': 'https://stackoverflow.com',
    'chatgpt': 'https://chat.openai.com',
    'maps': 'https://maps.google.com',
    'weather': 'https://www.google.com/search?q=weather'
};

// MEDIA KEY MAP: Virtual Key Codes for Windows
const MEDIA_KEYS = {
    'play': 179,      // Play/Pause
    'pause': 179,     // Same key
    'stop': 178,
    'next': 176,
    'previous': 177,
    'prev': 177,
    'volume_mute': 173,
    'volume_down': 174,
    'volume_up': 175
};

// Main Execution
const executeWebAction = async (target, action, entities, cleanQuery) => {
    let url = "";

    // --- 1. SPOTIFY HANDLING ---
    // Deep integration using "spotify:" protocol URI
    if (cleanQuery.includes('spotify')) {
        let spotifyUrl = "spotify:";

        // Case A: Play Playlist/Music
        if (cleanQuery.includes('random') || (cleanQuery.includes('music') && !cleanQuery.includes('search'))) {
            // Default to "Today's Top Hits" Playlist URI
            spotifyUrl = "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M";
        } else if (cleanQuery.includes('play') && !cleanQuery.includes('music')) {
            // Case B: Play Specific Song
            // Extract song name and use Search URI
            const possibleSong = cleanQuery.replace('play', '').replace('on', '').replace('spotify', '').trim();
            if (possibleSong.length > 0) spotifyUrl = `spotify:search:${encodeURIComponent(possibleSong)}`;
        }

        // Launch Spotify via URI
        await runPowerShell(`Start-Process "${spotifyUrl}"`);

        // Wait for it to load, then Force Focus
        await new Promise(r => setTimeout(r, 2000));
        await forceFocusWindow('Spotify');

        // Toggle Play
        // If user said "Play", send Spacebar keystroke (Shortcut for Play/Pause in Spotify)
        if (cleanQuery.includes('play') || cleanQuery.includes('music') || cleanQuery.includes('song')) {
            await new Promise(r => setTimeout(r, 500));
            // Send Spacebar using WScript Shell
            await runPowerShell(`$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys(' ')`);
            return "Playing on Spotify.";
        }
        return "Opened Spotify.";
    }

    // --- 2. YOUTUBE HANDLING ---
    if (cleanQuery.includes('youtube')) {
        const query = cleanQuery.replace('youtube', '').replace('play', '').replace('on', '').replace('music', '').trim();
        const isPlayCommand = cleanQuery.includes('play');

        // Case A: Auto-Play ("Play X on YouTube")
        if (isPlayCommand) {
            let searchQ = query;
            if (searchQ.length === 0 && cleanQuery.includes('music')) {
                searchQ = "trending music mix"; // Default backup
            }

            if (searchQ.length > 0) {
                // "I'm Feeling Lucky" Hack:
                // Searching "site:youtube.com [Query]" with "btnI=1" redirects to the first result.
                url = `https://www.google.com/search?q=${encodeURIComponent('site:youtube.com ' + searchQ)}&btnI=1`;
                await runPowerShell(`Start-Process "chrome" "${url}"`);
                return `Playing ${searchQ} on YouTube.`;
            }
        }

        // Case B: Search Results ("Search X on YouTube")
        if (query.length > 0) {
            url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            await runPowerShell(`Start-Process "chrome" "${url}"`);
            return `Searching YouTube for "${query}".`;
        }

        // Case C: Homepage
        url = "https://www.youtube.com";
        await runPowerShell(`Start-Process "chrome" "${url}"`);
        return "Opening YouTube.";
    }

    // --- 3. SPECIAL SEARCHES ---

    // Image Search
    if (cleanQuery.includes('image') || cleanQuery.includes('picture') || cleanQuery.includes('photo')) {
        const query = cleanQuery.replace('images', '').replace('image', '').replace('pictures', '').replace('picture', '').replace('photos', '').replace('of', '').replace('find', '').replace('search', '').replace('for', '').trim();
        // tbm=isch triggers Image Search Mode
        url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
        await runPowerShell(`Start-Process "chrome" "${url}"`);
        return `Finding images of ${query}.`;
    }

    // Weather
    if (cleanQuery.includes('weather')) {
        const query = cleanQuery.replace('weather', '').replace('check', '').replace('in', '').replace('for', '').trim();
        url = `https://www.google.com/search?q=weather+${encodeURIComponent(query || 'local area')}`;
        await runPowerShell(`Start-Process "chrome" "${url}"`);
        return `Checking weather for ${query || 'local area'}.`;
    }

    // StackOverflow (Search within site)
    if (cleanQuery.includes('stackoverflow')) {
        const query = cleanQuery.replace('stackoverflow', '').replace('search', '').replace('for', '').replace('on', '').trim();
        url = `https://www.google.com/search?q=site:stackoverflow.com+${encodeURIComponent(query)}`;
        await runPowerShell(`Start-Process "chrome" "${url}"`);
        return `Searching StackOverflow for "${query}".`;
    }

    // --- 4. SHORTCUT NAVIGATION ---
    const cleanTarget = target.toLowerCase();
    if (SITE_MAP[cleanTarget]) {
        await runPowerShell(`Start-Process "chrome" "${SITE_MAP[cleanTarget]}"`);
        return `Opening ${target}.`;
    }

    // --- 5. MEDIA KEY SYSTEM FALLBACK ---
    // If user says "Next song" (global media control)
    if (MEDIA_KEYS[action] || MEDIA_KEYS[target] || ((cleanQuery.includes('music') || cleanQuery.includes('media')) && cleanQuery.includes('next'))) {
        const keyAction = MEDIA_KEYS[action] || MEDIA_KEYS[target] || (cleanQuery.includes('next') ? 176 : cleanQuery.includes('prev') ? 177 : 179);

        // Send Key
        await runPowerShell(`$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]${keyAction})`);

        if (keyAction === 179) return "Play/Pause toggled.";
        if (keyAction === 176) return "Next track.";
        if (keyAction === 177) return "Previous track.";
        return "Media key sent.";
    }

    // --- 6. BROWSER TAB CONTROL ---
    // Uses generic keyboard shortcuts (Ctrl+T, Ctrl+W, etc.).
    // Assumes Browser is focused!
    if (cleanQuery.includes('tab')) {
        const wsDef = `$ws = New-Object -ComObject WScript.Shell;`;
        if (cleanQuery.includes('new')) {
            await runPowerShell(`${wsDef} $ws.SendKeys('^t')`); // Ctrl+T
            return "New tab opened.";
        }
        if (cleanQuery.includes('close')) {
            await runPowerShell(`${wsDef} $ws.SendKeys('^w')`); // Ctrl+W
            return "Tab closed.";
        }
        if (cleanQuery.includes('restore') || cleanQuery.includes('reopen')) {
            await runPowerShell(`${wsDef} $ws.SendKeys('^+t')`); // Ctrl+Shift+T
            return "Restored closed tab.";
        }
        if (cleanQuery.includes('next') || cleanQuery.includes('switch')) {
            await runPowerShell(`${wsDef} $ws.SendKeys('^{TAB}')`); // Ctrl+Tab
            return "Switched tab.";
        }
    }

    // --- 7. GENERIC SEARCH / NAVIGATION ---

    // Explicit Search
    if (cleanQuery.includes('search') || entities.type === 'search') {
        const query = cleanQuery.replace('search', '').replace('for', '').trim();
        url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        await runPowerShell(`Start-Process "chrome" "${url}"`);
        return `Searching Google for ${query}.`;
    }

    // Direct URL (if target has a dot like "example.com")
    if (target.includes('.') && !target.includes(' ')) {
        url = target.startsWith('http') ? target : `https://${target}`;
        await runPowerShell(`Start-Process "chrome" "${url}"`);
        return `Opening ${target}.`;
    } else {
        // Fallback: Google Search everything else
        url = `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`;
        await runPowerShell(`Start-Process "chrome" "${url}"`);
        return `Searching for ${cleanQuery}.`;
    }
};

module.exports = { executeWebAction };
