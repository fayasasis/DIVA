const fs = require('fs');
const path = require('path');

const rootDir = 'e:\\DIVA';
// Broad emoji regex
const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
const outputFile = 'e:\\DIVA\\emoji_files.txt';

let foundFiles = [];

function scanDirectory(dir) {
    let files;
    try {
        files = fs.readdirSync(dir);
    } catch (e) {
        return;
    }

    files.forEach(file => {
        const filePath = path.join(dir, file);
        let stat;
        try {
            stat = fs.statSync(filePath);
        } catch (e) {
            return;
        }

        if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build' || file === '.gemini' || file === '.agent') return;

        if (stat.isDirectory()) {
            scanDirectory(filePath);
        } else {
            const ext = path.extname(file).toLowerCase();
            if (['.js', '.jsx', '.ts', '.tsx', '.md', '.json', '.html', '.css', '.txt'].includes(ext)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    if (emojiRegex.test(content)) {
                        foundFiles.push(filePath);
                    }
                } catch (e) {
                    // ignore
                }
            }
        }
    });
}

scanDirectory(rootDir);
fs.writeFileSync(outputFile, foundFiles.join('\n'));
console.log(`Found ${foundFiles.length} files.`);
