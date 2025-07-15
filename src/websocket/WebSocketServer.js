const WebSocket = require('ws');
const EventEmitter = require('events');

class WebSocketServer extends EventEmitter {
    constructor(port) {
        super();
        this.port = port;
        this.wss = new WebSocket.Server({ port });
        this.mcSockets = new Set();
        this.lastGuildMsgs = [];

        this.setupEventHandlers();
        console.log(`[WebSocket] Server started on port ${port}`);
    }

    setupEventHandlers() {
        this.wss.on('connection', (ws) => {
            this.mcSockets.add(ws);
            console.log('[WS] Minecraft client connected. Total clients:', this.mcSockets.size);

            this.emit('clientConnected', this.mcSockets.size);

            ws.on('message', (data) => {
                this.handleMinecraftMessage(data);
            });

            ws.on('close', () => {
                this.mcSockets.delete(ws);
                console.log('[WS] Minecraft client disconnected. Total clients:', this.mcSockets.size);

                this.emit('clientDisconnected', this.mcSockets.size);
            });
        });
    }

    handleMinecraftMessage(data) {
        let obj;
        try {
            obj = JSON.parse(data);
        } catch(e) {
            console.log('[WS] Invalid JSON:', e);
            return;
        }

        if(obj.from === 'mc' && obj.msg && this.isUniqueGuildMsg(obj.msg)) {
            const cleanedMsg = obj.msg
                .replace(/\[[^\]]+\]\s*/g, '') // remove [RANK], [DIVINE], etc.
                .replace(/§\w/g, '') // remove formatting codes
                .replace(/^Guild\s?>?\s?/, '') // remove "Guild > "
                .trim();

            this.emit('minecraftMessage', cleanedMsg);
        }
    }

    isUniqueGuildMsg(msg) {
        if(this.lastGuildMsgs.includes(msg)) return false;
        this.lastGuildMsgs.push(msg);
        if(this.lastGuildMsgs.length > 100) this.lastGuildMsgs.shift();
        return true;
    }

    sendToMinecraft(message) {
        const json = JSON.stringify(message);
        this.mcSockets.forEach(socket => {
            if(socket.readyState === WebSocket.OPEN) {
                socket.send(json);
            }
        });
    }

    getConnectedClients() {
        return this.mcSockets.size;
    }
}

module.exports = WebSocketServer;