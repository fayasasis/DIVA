const fileControl = require('./automation/modules/fileControl');
const path = require('path');
const os = require('os');

// Mock runPowerShell to avoid actual changes during test
const originalRunPS = require('./automation/utils/powershell').runPowerShell;
require('./automation/utils/powershell').runPowerShell = async (cmd) => {
    console.log(`[MOCK PS] Executing: ${cmd}`);
    return "Mock Success";
};

async function test() {
    console.log("--- TEST 1: Create Folder 'Project X' in Downloads ---");
    await fileControl.executeFileAction("Project X", "create", { type: 'folder', destination: 'Downloads' }, "create folder");

    console.log("\n--- TEST 2: Delete 'test.txt' on Desktop ---");
    await fileControl.executeFileAction("test.txt", "delete", { path: path.join(os.homedir(), 'Desktop', 'test.txt') }, "delete file");

    console.log("\n--- TEST 3: Rename 'old.txt' to 'new.txt' ---");
    await fileControl.executeFileAction("old.txt", "rename", { name: 'new.txt' }, "rename file");

    console.log("\n--- TEST 4: Move 'file.pdf' to Documents ---");
    await fileControl.executeFileAction("file.pdf", "move", { destination: 'Documents' }, "move file");

    console.log("\n--- TEST 5: Organize Downloads ---");
    await fileControl.executeFileAction("Downloads", "organize", { source: 'Downloads' }, "organize folder");
}

test();
