const updateChannelTopic = async (client, channelId, count, guildName = 'Combined') => {
  try {
    const channel = await client.channels.fetch(channelId);
    if(!channel) return;

    const topic = `${guildName} Bridge - ${count} player${count !== 1 ? 's' : ''} connected`;
    await channel.setTopic(topic);
    console.log(`[Channel] Updated ${guildName} topic: ${topic}`);
  } catch(error) {
    console.error(`[Channel] Error updating topic for ${guildName}:`, error);
  }
};

module.exports = { updateChannelTopic };
