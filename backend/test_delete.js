async function testDelete() {
    try {
        // 1. Create a dummy session
        console.log("Creating dummy session...");
        const createRes = await fetch('http://localhost:5000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: "Delete me please" })
        });
        const createData = await createRes.json();
        const sessionId = createData.sessionId;
        console.log(`Created Session ID: ${sessionId}`);

        // 2. Try to delete it
        console.log(`Deleting Session ID: ${sessionId}...`);
        const delRes = await fetch(`http://localhost:5000/sessions/${sessionId}`, { method: 'DELETE' });

        if (delRes.ok) console.log("✅ Delete request successful (200 OK)");
        else console.log(`❌ Delete failed: ${delRes.status}`);

        // 3. Verify it's gone
        // Let's check the main list
        const listRes = await fetch('http://localhost:5000/sessions');
        const listData = await listRes.json();

        const exists = listData.find(s => s.id === sessionId);
        if (!exists) console.log("✅ Verified: Session is gone from list.");
        else console.log("❌ ERROR: Session still in list!");

    } catch (e) {
        console.error("❌ Test Failed:", e.message);
    }
}

testDelete();
