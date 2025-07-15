require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const WebSocketServer = require('./src/websocket/WebSocketServer');
const DiscordHandler = require('./src/discord/DiscordHandler');
const CommandHandler = require('./src/discord/CommandHandler');
const { updateChannelTopic } = require('./src/utils/channelUtils');

// Configuration
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const KEY_LOG_CHANNEL_ID = process.env.KEY_LOG_CHANNEL_ID;

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Initialize WebSocket server
const wsServer = new WebSocketServer(3000);

// Initialize Discord handler
const discordHandler = new DiscordHandler(client, CHANNEL_ID, wsServer);

// Initialize command handler
const commandHandler = new CommandHandler(client, KEY_LOG_CHANNEL_ID);

// Set up periodic topic updates
const FIVE_MINUTES = 5 * 60 * 1000;
setInterval(() => {
    updateChannelTopic(client, CHANNEL_ID, wsServer.getConnectedClients());
}, FIVE_MINUTES);

// Client ready event
client.once('ready', async () => {
    console.log('[Discord] Logged in as ' + client.user.tag);

    // Register slash commands
    await commandHandler.registerCommands();

    // Initial topic update
    updateChannelTopic(client, CHANNEL_ID, wsServer.getConnectedClients());
});

// Start the application
client.login(DISCORD_TOKEN);