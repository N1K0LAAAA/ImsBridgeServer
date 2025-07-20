require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const WebSocketServer = require('./src/websocket/WebSocketServer');
const DiscordHandler = require('./src/discord/DiscordHandler');
const CommandHandler = require('./src/discord/CommandHandler');
const { updateChannelTopic } = require('./src/utils/channelUtils');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const COMBINED_CHANNEL_ID = process.env.COMBINED_CHANNEL_ID;
const IMS_BRIDGE_CHANNEL_ID = process.env.IMS_BRIDGE_CHANNEL_ID;
const IMA_BRIDGE_CHANNEL_ID = process.env.IMA_BRIDGE_CHANNEL_ID;
const IMC_BRIDGE_CHANNEL_ID = process.env.IMC_BRIDGE_CHANNEL_ID;
const KEY_LOG_CHANNEL_ID = process.env.KEY_LOG_CHANNEL_ID;

const channelIds = {
    IMS_BRIDGE_CHANNEL_ID,
    IMA_BRIDGE_CHANNEL_ID,
    IMC_BRIDGE_CHANNEL_ID,
    COMBINED_CHANNEL_ID
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const wsServer = new WebSocketServer(3000);

const discordHandler = new DiscordHandler(client, channelIds, wsServer);

const commandHandler = new CommandHandler(client, KEY_LOG_CHANNEL_ID);

const FIVE_MINUTES = 5 * 60 * 1000;
setInterval(() => {
    const guildCounts = wsServer.getConnectedClientsByGuild()[0];

    // Update each guild channel topic
    Object.entries(channelIds).forEach(([key, channelId]) => {
        let guildName = '';
        let count = 0
        switch(key) {
            case 'IMS_BRIDGE_CHANNEL_ID':
                guildName = 'Ironman Sweats';
                count = guildCounts[guildName] || 0;
                break;
            case 'IMA_BRIDGE_CHANNEL_ID':
                guildName = 'Ironman Academy';
                count = guildCounts[guildName] || 0;
                break;
            case 'IMC_BRIDGE_CHANNEL_ID':
                guildName = 'Ironman Casuals';
                count = guildCounts[guildName] || 0;
                break;
            case 'COMBINED_CHANNEL_ID':
                guildName = 'Combined';
                count = wsServer.getConnectedClients();
                break;
        }

        updateChannelTopic(client, channelId, count, guildName);
    });
}, FIVE_MINUTES);

client.once('ready', async () => {
    console.log('[Discord] Logged in as ' + client.user.tag);

    await commandHandler.registerCommands();

    const guildCounts = wsServer.getConnectedClientsByGuild()[0];
    Object.entries(channelIds).forEach(([key, channelId]) => {
        let guildName = '';
        let count = 0
        switch(key) {
            case 'IMS_BRIDGE_CHANNEL_ID':
                guildName = 'Ironman Sweats';
                count = guildCounts[guildName] || 0;
                break;
            case 'IMA_BRIDGE_CHANNEL_ID':
                guildName = 'Ironman Academy';
                count = guildCounts[guildName] || 0;
                break;
            case 'IMC_BRIDGE_CHANNEL_ID':
                guildName = 'Ironman Casuals';
                count = guildCounts[guildName] || 0;
                break;
            case 'COMBINED_CHANNEL_ID':
                guildName = 'Combined';
                count = wsServer.getConnectedClients();
                break;
        }

        updateChannelTopic(client, channelId, count, guildName);
    });
});



client.login(DISCORD_TOKEN);