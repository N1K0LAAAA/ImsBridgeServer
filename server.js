require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const WebSocket = require('ws');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const wss = new WebSocket.Server({ port: 3000 });

let lastGuildMsgs = [];

function isUniqueGuildMsg(msg) {
    if(lastGuildMsgs.includes(msg)) return false;
    lastGuildMsgs.push(msg);
    if(lastGuildMsgs.length > 100) lastGuildMsgs.shift();
    return true;
}

let mcSocket = new Set();

wss.on('connection', function connection(ws) {
    mcSocket.add(ws);
    console.log('[WS] Minecraft client connected. Total clients:', mcSocket.size);

    ws.on('close', () => {
        mcSocket.delete(ws);
        console.log('[WS] Minecraft client disconnected.');
    });
    ws.on('message', function incoming(data) {
        console.log('[WS] Message received from Minecraft:', data.toString());
        let obj;
        try { obj = JSON.parse(data); } catch(e) {
            console.log('[WS] Failed to parse JSON:', e);
            return;
        }
        console.log('[WS] Parsed object:', obj);
        if(obj.from === 'mc' && obj.msg && isUniqueGuildMsg(obj.msg)) {
            // Forward to Discord
            const channel = client.channels.cache.get(CHANNEL_ID);
            if(channel) {
                channel.send(obj.msg.replace(/§\w/g, ""))
                    .then(() => console.log('[Discord] Sent to Discord:', obj.msg))
                    .catch(err => console.log('[Discord] Error sending to Discord:', err));
            } else {
                console.log('[Discord] Channel not found for ID:', CHANNEL_ID);
            }
        }
    });
});

// Discord -> MC
client.on('messageCreate', msg => {
    if(msg.channel.id === CHANNEL_ID && !msg.author.bot) {
        const out = { from: 'discord', msg: `${msg.author.username}: ${msg.content}` };
        mcSocket.forEach(socket => {
            if(socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(out));
            }
        });
        console.log('[Discord] Forwarded Discord message to Minecraft:', out);
    }

});

client.once('ready', () => {
    console.log('Discord logged in as ' + client.user.tag);
});

client.login(DISCORD_TOKEN);