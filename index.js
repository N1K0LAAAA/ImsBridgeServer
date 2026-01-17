require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const createBridgeServer = require('./src/websocket/bridgeServer');
const createDiscordHandler = require('./src/discord/discordHandler');
const createCommandHandler = require('./src/discord/commandHandler');
const createGuildMemberUpdater = require('./src/services/guildMemberUpdater');
const { updateChannelTopic } = require('./src/utils/channelUtils');
const { INTERVALS } = require('./src/config/constants');
const { getGuildByChannelId } = require('./src/utils/guildMapper');

const createBot = () => {
  const channelIds = {
    IMS_BRIDGE_CHANNEL_ID: process.env.IMS_BRIDGE_CHANNEL_ID,
    IMA_BRIDGE_CHANNEL_ID: process.env.IMA_BRIDGE_CHANNEL_ID,
    IMC_BRIDGE_CHANNEL_ID: process.env.IMC_BRIDGE_CHANNEL_ID,
    COMBINED_CHANNEL_ID: process.env.COMBINED_CHANNEL_ID
  };

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const wsServer = createBridgeServer(3000);
  client.wsServer = wsServer;

  const discordHandler = createDiscordHandler(client, channelIds, wsServer);
  const commandHandler = createCommandHandler(client);

  const getChannelUpdateInfo = (channelKey, guildCounts) => {
    if(channelKey === 'COMBINED_CHANNEL_ID') {
      return { guildName: 'Combined', count: wsServer.getConnectedClients() };
    }

    const guildName = getGuildByChannelId(channelIds[channelKey], channelIds);
    return { guildName: guildName || 'Unknown', count: guildCounts[guildName] || 0 };
  };

  const updateAllChannelTopics = async () => {
    const [guildCounts] = wsServer.getConnectedClientsByGuild();

    for(const [key, channelId] of Object.entries(channelIds)) {
      const { guildName, count } = getChannelUpdateInfo(key, guildCounts);
      await updateChannelTopic(client, channelId, count, guildName);
    }
  };

  const startPeriodicUpdates = () => {
    // Update channel topics every 5 minutes
    setInterval(updateAllChannelTopics, INTERVALS.CHANNEL_UPDATE);

    // Update guild members every 10 minutes
    setInterval(async () => {
      try {
        const updater = createGuildMemberUpdater(process.env.HYPIXEL_API_KEY);
        await updater.updateGuildMembers(wsServer);
        console.log('[AutoUpdate] Guild members and keys reloaded');
      } catch(err) {
        console.error('[AutoUpdate] Failed:', err);
      }
    }, INTERVALS.GUILD_MEMBER_UPDATE);
  };

  client.once('ready', async () => {
    console.log(`[Discord] Logged in as ${client.user.tag}`);
    await commandHandler.registerCommands();
    await updateAllChannelTopics();
  });

  startPeriodicUpdates();

  return {
    start: () => client.login(process.env.DISCORD_TOKEN),
    client,
    wsServer,
    discordHandler,
    commandHandler
  };
};

const bot = createBot();
bot.start().catch(console.error);
