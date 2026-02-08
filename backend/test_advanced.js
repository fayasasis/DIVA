const { executeAction } = require('../automation/actionHandler');

(async () => {
    console.log("🧪 Testing Fuzzy Match Open...");
    // Typo: "notpad" -> Should find "Notepad"
    console.log(await executeAction({
        type: 'system_action',
        intent: 'app_control',
        entities: { action: 'open', target: 'notpad' }
    }));

    console.log("\n🧪 Testing Dynamic App Open...");
    // "Calculator" should be found via Get-StartApps
    console.log(await executeAction({
        type: 'system_action',
        intent: 'app_control',
        entities: { action: 'open', target: 'calculator' }
    }));

    console.log("\n🧪 Testing Window Minimize...");
    // Minimize Calculator (assuming it opened)
    console.log(await executeAction({
        type: 'system_action',
        intent: 'window_control',
        entities: { action: 'minimize', target: 'calculator' }
    }));
})();
