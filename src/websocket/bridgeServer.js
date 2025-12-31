const { WebSocketServer } = require('ws');
const EventEmitter = require('events');
const { loadMemberData } = require('../utils/dataUtils');
const { cleanGuildMessage, normalizeForDeduplication } = require('../utils/messageFormatter');
const { WEBSOCKET } = require('../config/constants');

const createBridgeServer = (port = WEBSOCKET.PORT) => {
  const emitter = new EventEmitter();
  const wss = new WebSocketServer({ port });
  const authenticatedSockets = new Map();
  const validKeys = new Map();
  let lastGuildMsgs = [];

  const loadValidKeys = async () => {
    try {
      const memberData = await loadMemberData();
      validKeys.clear();

      const dataArray = Array.isArray(memberData) ? memberData : Object.values(memberData);

      dataArray
        .filter(user => user?.generated_uuid && user?.guild_name)
        .forEach(({ generated_uuid, minecraft_name, guild_name }) => {
          validKeys.set(generated_uuid, { minecraft_name, guild_name });
        });

      console.log(`[Auth] Loaded ${validKeys.size} valid bridge keys`);
    } catch(error) {
      console.error('[Auth] Error loading valid keys:', error);
    }
  };

  const handleClientDisconnect = (ws) => {
    if(authenticatedSockets.has(ws)) {
      const userData = authenticatedSockets.get(ws);
      authenticatedSockets.delete(ws);
      console.log(`[WS] Authenticated client disconnected: ${userData.minecraft_name} (${userData.guild_name}). Total: ${authenticatedSockets.size}`);
      emitter.emit('clientDisconnected', authenticatedSockets.size);
    } else {
      console.log('[WS] Unauthenticated client disconnected');
    }
  };

  const authenticateClient = (ws, bridgeKey, authTimeout) => {
    if(validKeys.has(bridgeKey)) {
      const userData = validKeys.get(bridgeKey);
      authenticatedSockets.set(ws, userData);
      clearTimeout(authTimeout);

      console.log(`[Auth] Client authenticated: ${userData.minecraft_name} from ${userData.guild_name}`);

      ws.send(JSON.stringify({
        from: 'server',
        type: 'auth_success',
        message: 'Authentication successful'
      }));

      emitter.emit('clientConnected', authenticatedSockets.size);
    } else {
      console.log(`[Auth] Invalid bridge key attempted: ${bridgeKey}`);
      ws.send(JSON.stringify({
        from: 'server',
        type: 'auth_failed',
        message: 'Invalid bridge key'
      }));
      ws.close(1008, 'Invalid bridge key');
    }
  };

  const handleAuthentication = (ws, data, authTimeout) => {
    try {
      const obj = JSON.parse(data);

      if(obj.from === 'mc' && obj.key) {
        authenticateClient(ws, obj.key, authTimeout);
      } else {
        console.log('[Auth] Invalid authentication message format');
        ws.close(1008, 'Invalid authentication format');
      }
    } catch(e) {
      console.log('[Auth] Invalid JSON during authentication:', e);
      ws.close(1008, 'Invalid JSON');
    }
  };

  const isUniqueGuildMsg = (msg) => {
    const normalized = normalizeForDeduplication(msg);
    if(lastGuildMsgs.includes(normalized)) return false;

    lastGuildMsgs.push(normalized);
    if(lastGuildMsgs.length > 100) lastGuildMsgs.shift();

    return true;
  };

  const handleGuildMessage = (obj, userData) => {
    const cleanedMsg = cleanGuildMessage(obj.msg);
    emitter.emit('minecraftMessage', {
      message: cleanedMsg,
      guild: userData.guild_name,
      player: userData.minecraft_name
    });
  };

  const disconnectUser = async (minecraftName) => {
    let disconnected = false;

    authenticatedSockets.forEach((userData, socket) => {
      if(userData.minecraft_name === minecraftName) {
        socket.close(1008, 'Access revoked by administrator');
        authenticatedSockets.delete(socket);
        disconnected = true;
        console.log(`[WS] Disconnected user ${minecraftName} - access revoked`);
      }
    });

    return disconnected;
  };

  const handleCombinedBridgeMessage = (obj, userData) => {
    emitter.emit('minecraftBounce', {
      msg: obj.msg,
      player: userData.minecraft_name,
      combinedbridge: true,
      guild: userData.guild_name
    });

    emitter.emit('minecraftMessage', {
      message: obj.msg,
      player: userData.minecraft_name,
      combinedbridge: true,
      guild: userData.guild_name
    });
  };

  const getConnectedClientsByGuild = () => {
    const { getAllGuildNames } = require('../utils/guildMapper');
    const guildCounts = {};
    const playersByGuild = {};

    getAllGuildNames().forEach(guild => {
      playersByGuild[guild] = [];
    });

    authenticatedSockets.forEach((userData, socket) => {
      if(socket.readyState === 1) {
        const { guild_name, minecraft_name } = userData;

        if(!playersByGuild[guild_name].includes(minecraft_name)) {
          guildCounts[guild_name] = (guildCounts[guild_name] || 0) + 1;
          playersByGuild[guild_name].push(minecraft_name);
        }
      }
    });

    return [guildCounts, playersByGuild];
  };

  const handleClientCommandRequest = (obj, userData) => {
    const responses = {
      'getOnlinePlayers': () => getConnectedClientsByGuild()[1]
    };

    const response = responses[obj.request]?.();

    if(!response) {
      console.warn(`[ClientRequest] Unknown request: ${obj.request}`);
      return;
    }

    try {
      sendToMinecraft({ request: obj.request, response }, null, userData.minecraft_name);
      console.log(`[ClientRequest] Responded to ${obj.request} from ${userData.minecraft_name}`);
    } catch(err) {
      console.error('[ClientRequest]:', err);
    }
  };

  const handleMinecraftMessage = (ws, data) => {
    try {
      const obj = JSON.parse(data);
      const userData = authenticatedSockets.get(ws);

      if(obj.request) {
        handleClientCommandRequest(obj, userData);
      } else if(obj.combinedbridge) {
        handleCombinedBridgeMessage(obj, userData);
      } else if(obj.from === 'mc' && obj.msg && isUniqueGuildMsg(obj.msg)) {
        handleGuildMessage(obj, userData);
      }
    } catch(e) {
      console.log('[WS] Invalid JSON:', e);
    }
  };

  const setupConnection = (ws) => {
    console.log('[WS] Client connected, awaiting authentication...');

    const authTimeout = setTimeout(() => {
      if(!authenticatedSockets.has(ws)) {
        console.log('[WS] Client authentication timeout');
        ws.close(1008, 'Authentication timeout');
      }
    }, WEBSOCKET.AUTH_TIMEOUT);

    ws.on('message', (data) => {
      if(!authenticatedSockets.has(ws)) {
        handleAuthentication(ws, data, authTimeout);
      } else {
        handleMinecraftMessage(ws, data);
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      handleClientDisconnect(ws);
    });

    ws.on('error', (error) => {
      console.error('[WS] WebSocket error:', error);
      clearTimeout(authTimeout);
      authenticatedSockets.delete(ws);
    });
  };

  const sendToMinecraft = (message, targetGuild = null, targetPlayer = null) => {
    const json = JSON.stringify(message);
    authenticatedSockets.forEach((userData, socket) => {
      if(socket.readyState === 1) {
        const matchesGuild = !targetGuild || userData.guild_name === targetGuild;
        const matchesPlayer = !targetPlayer || userData.minecraft_name === targetPlayer;

        if(matchesGuild && matchesPlayer) {
          socket.send(json);
        }
      }
    });
  };

  const getConnectedClients = () => authenticatedSockets.size;

  wss.on('connection', setupConnection);
  loadValidKeys();
  console.log(`[WebSocket] Server started on port ${port}`);

  return {
    on: (event, handler) => emitter.on(event, handler),
    sendToMinecraft,
    getConnectedClients,
    getConnectedClientsByGuild,
    reloadValidKeys: loadValidKeys,
    disconnectUser
  };
};

module.exports = createBridgeServer;
