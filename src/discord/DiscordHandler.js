const { EmbedBuilder } = require('discord.js');

class DiscordHandler {
    constructor(client, channelIds, wsServer) {
        this.client = client;
        this.channelIds = channelIds;
        this.wsServer = wsServer;
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.on('messageCreate', (msg) => {
            this.handleDiscordMessage(msg);
        });

        this.wsServer.on('minecraftMessage', (data) => {
            this.sendMinecraftMessageToDiscord(data);
        });
        this.wsServer.on('minecraftBounce', (data) => {
            this.bounceMinecraftMessage(data);
        });
    }

    handleDiscordMessage(msg) {
        if(msg.author.bot) return;

        let targetGuild = null;
        let combinedBridgeEnabled = false;

        if(msg.channel.id === this.channelIds.IMS_BRIDGE_CHANNEL_ID) {
            targetGuild = 'Ironman Sweats';
        } else if(msg.channel.id === this.channelIds.IMA_BRIDGE_CHANNEL_ID) {
            targetGuild = 'Ironman Academy';
        } else if(msg.channel.id === this.channelIds.IMC_BRIDGE_CHANNEL_ID) {
            targetGuild = 'Ironman Casuals';
        } else if(msg.channel.id === this.channelIds.COMBINED_CHANNEL_ID) {
            combinedBridgeEnabled = true
        } else {
            return;
        }

        const displayName = msg.member?.displayName || msg.author.username;

        const messageToSend = {
            from: 'discord',
            msg: `${displayName}: ${msg.content}`,
            combinedbridge: combinedBridgeEnabled,
            guild: targetGuild
        };

        this.wsServer.sendToMinecraft(messageToSend, targetGuild);
        console.log(`[Discord] Forwarded to ${targetGuild || 'All Guilds'}:`, `${displayName}: ${msg.content}`);
    }

    bounceMinecraftMessage(data) {
        try {
            const { msg, player, combinedbridge, guild } = data;
            
            const messageToBounce = {
                from: 'mc',
                msg: player + ": " + msg,
                combinedbridge: combinedbridge,
                fromplayer: player,
                guild: guild
            };
            
            this.wsServer.sendToMinecraft(messageToBounce, null, null);
            console.log(`[MC] Bounced combined chat msg back to connected clients:`, player + ": " + msg);

        } catch (err) {
            console.error('[MC] Bounce error:', err);
        }
    }

    async sendMinecraftMessageToDiscord(data) {
        try {
            let { message, player, combinedbridge, guild } = data;
            let targetChannelId = null;
            let guildDisplayName = '';
            let author = '';
            let message_parts = null;
            let text = '';
            switch(guild) {
                case 'Ironman Sweats':
                    targetChannelId = this.channelIds.IMS_BRIDGE_CHANNEL_ID;
                    guildDisplayName = '[IMS]';
                    break;
                case 'Ironman Academy':
                    targetChannelId = this.channelIds.IMA_BRIDGE_CHANNEL_ID;
                    guildDisplayName = '[IMA]';
                    break;
                case 'Ironman Casuals':
                    targetChannelId = this.channelIds.IMC_BRIDGE_CHANNEL_ID;
                    guildDisplayName = '[IMC]';
                    break;
                default:
                    console.warn(`[Discord] Unknown guild: ${guild}`);
                    return;
            }
            if (combinedbridge) {
                targetChannelId = this.channelIds.COMBINED_CHANNEL_ID;
                author = player;
                text = message;

            } else {
                [author, ...message_parts] = message.split(" : ");
                text = message_parts.join(" : ");
            }

            const embed = new EmbedBuilder()
                .setColor(this.getGuildColor(guild))
                .setAuthor({name: author, iconURL: `https://www.mc-heads.net/avatar/${author}`})
                .setDescription(text)
                .setTimestamp()
                .setFooter({ text: `Received from: ${guildDisplayName} ${player}` });

            const channel = await this.client.channels.fetch(targetChannelId);
            await channel.send({ embeds: [embed] });
            console.log(`[Discord] Sent embed to ${combinedbridge ? "[CBRIDGE]" : guildDisplayName} from player ${player}:`, message);
        } catch(err) {
            console.error('[Discord] Send error:', err);
        }
    }

    getGuildColor(guild) {
        switch(guild) {
            case 'Ironman Sweats':
                return 0x55FF55; // 
            case 'Ironman Academy':
                return 0x00AA00; // 
            case 'Ironman Casuals':
                return 0x00AAAA; // 
            default:
                return 0x00AE86; //
        }
    }
}

module.exports = DiscordHandler;