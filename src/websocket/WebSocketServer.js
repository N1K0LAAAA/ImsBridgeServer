const WebSocket = require('ws');
const EventEmitter = require('events');
const { loadMemberData } = require('../utils/dataUtils');

class WebSocketServer extends EventEmitter {
    constructor(port) {
        super();
        this.port = port;
        this.wss = new WebSocket.Server({ port });
        this.authenticatedSockets = new Map(); // Map of ws -> user data
        this.lastGuildMsgs = [];
        this.validKeys = new Map(); // Map of generated_uuid -> user data

        this.loadValidKeys();
        this.setupEventHandlers();
        console.log(`[WebSocket] Server started on port ${port}`);
    }

    async loadValidKeys() {
        try {
            const memberData = await loadMemberData();

            this.validKeys.clear();

            if(Array.isArray(memberData)) {
                memberData.forEach(user => {
                    if(user.generated_uuid && user.guild_name) {
                        this.validKeys.set(user.generated_uuid, {
                            minecraft_name: user.minecraft_name,
                            guild_name: user.guild_name
                        });
                    }
                });
            } else if(typeof memberData === 'object' && memberData !== null) {
                Object.values(memberData).forEach(user => {
                    if(user && user.generated_uuid && user.guild_name) {
                        this.validKeys.set(user.generated_uuid, {
                            minecraft_name: user.minecraft_name,
                            guild_name: user.guild_name
                        });
                    }
                });
            }

            console.log(`[Auth] Loaded ${this.validKeys.size} valid bridge keys`);
        } catch(error) {
            console.error('[Auth] Error loading valid keys:', error);
        }
    }

    setupEventHandlers() {
        this.wss.on('connection', (ws) => {
            console.log('[WS] Client connected, awaiting authentication...');

            const authTimeout = setTimeout(() => {
                if(!this.authenticatedSockets.has(ws)) {
                    console.log('[WS] Client authentication timeout');
                    ws.close(1008, 'Authentication timeout');
                }
            }, 10000);

            ws.on('message', (data) => {
                if(!this.authenticatedSockets.has(ws)) {
                    this.handleAuthentication(ws, data, authTimeout);
                } else {
                    this.handleMinecraftMessage(ws, data);
                }
            });

            ws.on('close', () => {
                clearTimeout(authTimeout);
                if(this.authenticatedSockets.has(ws)) {
                    const userData = this.authenticatedSockets.get(ws);
                    this.authenticatedSockets.delete(ws);
                    console.log(`[WS] Authenticated client disconnected: ${userData.minecraft_name} (${userData.guild_name}). Total clients: ${this.authenticatedSockets.size}`);
                    this.emit('clientDisconnected', this.authenticatedSockets.size);
                } else {
                    console.log('[WS] Unauthenticated client disconnected');
                }
            });

            ws.on('error', (error) => {
                console.error('[WS] WebSocket error:', error);
                clearTimeout(authTimeout);
                this.authenticatedSockets.delete(ws);
            });
        });
    }

    handleAuthentication(ws, data, authTimeout) {
        let obj;
        try {
            obj = JSON.parse(data);
        } catch(e) {
            console.log('[Auth] Invalid JSON during authentication:', e);
            ws.close(1008, 'Invalid JSON');
            return;
        }

        if(obj.from === 'mc' && obj.key) {
            const bridgeKey = obj.key;

            if(this.validKeys.has(bridgeKey)) {
                const userData = this.validKeys.get(bridgeKey);
                this.authenticatedSockets.set(ws, userData);
                clearTimeout(authTimeout);

                console.log(`[Auth] Client authenticated successfully: ${userData.minecraft_name} from ${userData.guild_name}`);

                ws.send(JSON.stringify({
                    from: 'server',
                    type: 'auth_success',
                    message: 'Authentication successful'
                }));

                this.emit('clientConnected', this.authenticatedSockets.size);
            } else {
                console.log(`[Auth] Invalid bridge key attempted: ${bridgeKey}`);
                ws.send(JSON.stringify({
                    from: 'server',
                    type: 'auth_failed',
                    message: 'Invalid bridge key'
                }));
                ws.close(1008, 'Invalid bridge key');
            }
        } else {
            console.log('[Auth] Invalid authentication message format');
            ws.close(1008, 'Invalid authentication format');
        }
    }

    handleMinecraftMessage(ws, data) {
        let obj;
        try {
            obj = JSON.parse(data);
        } catch(e) {
            console.log('[WS] Invalid JSON:', e);
            return;
        }

        if(obj.from === 'mc' && obj.msg && this.isUniqueGuildMsg(obj.msg) && !obj.combinedbridge) {
            const userData = this.authenticatedSockets.get(ws);
            const cleanedMsg = this.cleanChatMessage(obj.msg);

            // Emit message with guild information
            this.emit('minecraftMessage', {
                message: cleanedMsg,
                guild: userData.guild_name,
                player: userData.minecraft_name
            });
        } else if (obj.combinedbridge == true){
            const userData = this.authenticatedSockets.get(ws);
            // If combined message, emit a bounce request back to all connected clients except the one who sent it
                this.emit('minecraftBounce', {
                    msg: obj.msg,
                    player: userData.minecraft_name,
                    combinedbridge: true,
                    guild: userData.guild_name
                });
                this.emit('minecraftMessage', {
                    message: obj.msg,
                    guild: 'Combined',
                    player: userData.minecraft_name
                })
        }
    }

    isUniqueGuildMsg(msg) {
        const cleaned = this.cleanChatMessage(msg).toLowerCase();

        if(this.lastGuildMsgs.includes(cleaned)) return false;
        this.lastGuildMsgs.push(cleaned);
        if(this.lastGuildMsgs.length > 100) this.lastGuildMsgs.shift();
        return true;
    }
    
    cleanChatMessage(msg) {
        const unformatted = msg
            .replace(/§\w/g, '') // remove formatting codes
            .replace(/\s+/g, ' ') // normalize whitespace
            .trim();
        const [prefix, message] = unformatted.split(":");
        if(!prefix || !message)
            return msg;
        const username = prefix
            .replace(/^Guild\s?>?\s?/, '') // remove "Guild > "
            .replace(/\[[^\]]+\]\s*/g, '') // remove [RANK], [DIVINE], etc.
            .match(/[\w]+/, '')?.[0] ?? "Unknown User";
        const trimmedMessage = message?.trim() ?? "Unknown Message";
        const cleaned = [username, trimmedMessage].join(": ");
        return cleaned;
    }

    sendToMinecraft(message, targetGuild = null, fromMinecraftName = null) {
        const json = JSON.stringify(message);
        this.authenticatedSockets.forEach((userData, socket) => {
            if(socket.readyState === WebSocket.OPEN) {
                // If targetGuild is specified, only send to that guild
                // && userData.minecraft_name !== fromMinecraftName
                if((targetGuild === null || userData.guild_name === targetGuild)) {
                    socket.send(json);
                }
            }
        });
    }

    getConnectedClients() {
        return this.authenticatedSockets.size;
    }

    getConnectedClientsByGuild() {
        const guildCounts = {};
        this.authenticatedSockets.forEach((userData, socket) => {
            if(socket.readyState === WebSocket.OPEN) {
                guildCounts[userData.guild_name] = (guildCounts[userData.guild_name] || 0) + 1;
            }
        });
        return guildCounts;
    }

    async reloadValidKeys() {
        await this.loadValidKeys();
    }
}

module.exports = WebSocketServer;