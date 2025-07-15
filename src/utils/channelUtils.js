async function updateChannelTopic(client, channelId, totalClients) {
    try {
        const channel = await client.channels.fetch(channelId, { cache: false });
        if(!channel) {
            console.warn('[Discord] Channel not found.');
            return;
        }

        const newTopic = `[WS] Connected Minecraft clients: ${totalClients}`;
        const currentTopic = channel.topic || '';

        if(currentTopic.trim() === newTopic.trim()) {
            console.log('[Debug] Topic unchanged. Skipping update.');
            return;
        }

        await channel.setTopic(newTopic);
        console.log(`[Discord] Channel topic updated to: "${newTopic}"`);
    } catch(err) {
        console.error('[Discord] Error updating topic:', err);
    }
}

module.exports = {
    updateChannelTopic,
};