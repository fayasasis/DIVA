const { runPowerShell } = require('../utils/powershell');
const { forceFocusWindow } = require('./windowControl');

// 🌐 WEB & MEDIA CONTROL MODULE

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

const MEDIA_KEYS = {
    'play': 179,
    'pause': 179, // Toggle
    'stop': 178,
    'next': 176,
    'previous': 177,
    'prev': 177,
    'volume_mute': 173,
    'volume_down': 174,
    'volume_up': 175
};

const executeWebAction = async (target, action, entities, cleanQuery) => {
    let url = "";

    // 0. SPOTIFY SPECIFIC
    if (cleanQuery.includes('spotify')) {
        // "Play music on Spotify"
        let spotifyUrl = "spotify:";

        // If generic "play music" or "random song", load "Today's Top Hits" to ensure content
        if (cleanQuery.includes('random') || (cleanQuery.includes('music') && !cleanQuery.includes('search'))) {
            spotifyUrl = "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M"; // Today's Top Hits
        } else if (cleanQuery.includes('play') && !cleanQuery.includes('music')) {
            // Try to extract song name? "Play [song] on spotify"
            const possibleSong = cleanQuery.replace('play', '').replace('on', '').replace('spotify', '').trim();
            if (possibleSong.length > 0) spotifyUrl = `spotify:search:${encodeURIComponent(possibleSong)}`;
        }

        await runPowerShell(`Start-Process "${spotifyUrl}"`);

        // 2. Aggressive Focus (Wait for app to load content)
        await new Promise(r => setTimeout(r, 2000));
        await forceFocusWindow('Spotify');

        // 3. Play (Send Spacebar to Toggle Play)
        // Spacebar is the dedicated "Play/Pause" shortcut for Spotify when focused.
        if (cleanQuery.includes('play') || cleanQuery.includes('music') || cleanQuery.includes('song')) {
            // Send SPACE (32) to toggle play. 
            // Also send ENTER (13) just in case it's a "Context" menu or "Play button" focus.
            // But SPACE is safest.
            await new Promise(r => setTimeout(r, 500));
            await runPowerShell(`$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys(' ')`);
            return "Playing on Spotify.";
        }
        return "Opened Spotify.";
    }

    // 1. YOUTUBE SPECIFIC (Must come before generic "Play" media key)
    if (cleanQuery.includes('youtube')) {
        // "Play [song] on youtube" -> Search query
        // Use cleanQuery for extraction to capture full context
        const query = cleanQuery.replace('youtube', '').replace('play', '').replace('on', '').replace('music', '').trim();
        const isPlayCommand = cleanQuery.includes('play');

        // CASE A: "Play [song] on YouTube" -> Auto-Play (Lucky Search)
        if (isPlayCommand) {
            let searchQ = query;
            if (searchQ.length === 0 && cleanQuery.includes('music')) {
                searchQ = "trending music mix"; // Default for "Play music"
            }

            if (searchQ.length > 0) {
                // "I'm Feeling Lucky" Trick: site:youtube.com + query + &btnI=1
                // This redirects to the first video URL directly.
                url = `https://www.google.com/search?q=${encodeURIComponent('site:youtube.com ' + searchQ)}&btnI=1`;
                await runPowerShell(`Start-Process "chrome" "${url}"`);
                return `Playing ${searchQ} on YouTube.`;
            }
        }

        // CASE B: "Search [thing] on YouTube" -> Search Results
        if (query.length > 0) {
            url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            await runPowerShell(`Start-Process "chrome" "${url}"`);
            return `Searching YouTube for "${query}".`;
        }

        // CASE C: Just "Open YouTube"
        url = "https://www.youtube.com";
        await runPowerShell(`Start-Process "chrome" "${url}"`);
        return "Opening YouTube.";
    }

    // 2. SPECIAL SEARCHES
    // A. Images
    if (cleanQuery.includes('image') || cleanQuery.includes('picture') || cleanQuery.includes('photo')) {
        const query = cleanQuery.replace('images', '').replace('image', '').replace('pictures', '').replace('picture', '').replace('photos', '').replace('of', '').replace('find', '').replace('search', '').replace('for', '').trim();
        url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
        await runPowerShell(`Start-Process "chrome" "${url}"`);
        return `Finding images of ${query}.`;
    }

    // B. Weather
    if (cleanQuery.includes('weather')) {
        const query = cleanQuery.replace('weather', '').replace('check', '').replace('in', '').replace('for', '').trim();
        url = `https://www.google.com/search?q=weather+${encodeURIComponent(query || 'local area')}`;
        await runPowerShell(`Start-Process "chrome" "${url}"`);
        return `Checking weather for ${query || 'local area'}.`;
    }

    // C. StackOverflow (via Google Site Search)
    if (cleanQuery.includes('stackoverflow')) {
        const query = cleanQuery.replace('stackoverflow', '').replace('search', '').replace('for', '').replace('on', '').trim();
        url = `https://www.google.com/search?q=site:stackoverflow.com+${encodeURIComponent(query)}`;
        await runPowerShell(`Start-Process "chrome" "${url}"`);
        return `Searching StackOverflow for "${query}".`;
    }

    // 3. DIRECT SITE NAVIGATION (Gmail, WhatsApp, etc.)
    const cleanTarget = target.toLowerCase();
    if (SITE_MAP[cleanTarget]) {
        await runPowerShell(`Start-Process "chrome" "${SITE_MAP[cleanTarget]}"`);
        return `Opening ${target}.`;
    }

    // 4. MEDIA KEYS (System-wide) - Lower priority than explicit app commands
    // "Play", "Pause", "Next track" (without "on youtube")
    if (MEDIA_KEYS[action] || MEDIA_KEYS[target] || cleanQuery.includes('music') || cleanQuery.includes('media')) {
        const keyAction = MEDIA_KEYS[action] || MEDIA_KEYS[target] || (cleanQuery.includes('next') ? 176 : cleanQuery.includes('prev') ? 177 : 179);

        await runPowerShell(`$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]${keyAction})`);

        if (keyAction === 179) return "Play/Pause toggled.";
        if (keyAction === 176) return "Next track.";
        if (keyAction === 177) return "Previous track.";
        return "Media key sent.";
    }

    // 5. BROWSER TABS
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

    // 6. GENERAL WEB SEARCH
    if (cleanQuery.includes('search') || entities.type === 'search') {
        const query = cleanQuery.replace('search', '').replace('for', '').trim();
        url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        await runPowerShell(`Start-Process "chrome" "${url}"`);
        return `Searching Google for ${query}.`;
    }

    // 7. GENERIC URL OPEN
    if (target.includes('.') && !target.includes(' ')) {
        url = target.startsWith('http') ? target : `https://${target}`;
        await runPowerShell(`Start-Process "chrome" "${url}"`);
        return `Opening ${target}.`;
    } else {
        url = `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`;
        await runPowerShell(`Start-Process "chrome" "${url}"`);
        return `Searching for ${cleanQuery}.`;
    }
};

module.exports = { executeWebAction };
