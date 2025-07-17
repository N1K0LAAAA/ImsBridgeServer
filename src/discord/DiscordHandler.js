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
        };

        this.wsServer.sendToMinecraft(messageToSend, targetGuild);
        console.log(`[Discord] Forwarded to ${targetGuild || 'All Guilds'}:`, messageToSend);
    }

    bounceMinecraftMessage(data) {
        try {
            const { msg, player, combinedbridge } = data;
            
            const messageToBounce = {
                from: 'mc',
                msg: msg,
                combinedbridge: combinedbridge,
            };
            
            this.wsServer.sendToMinecraft(messageToBounce, null, player);
            console.log(`[MC] Bounced combined chat msg back to connected clients:`, messageToBounce);

        } catch (err) {
            console.error('[MC] Bounce error:', err);
        }
    }

    async sendMinecraftMessageToDiscord(data) {
        try {
            let { message, guild, player } = data;

            let targetChannelId = null;
            let guildDisplayName = '';

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
                case 'Combined':
                    targetChannelId = this.channelIds.COMBINED_CHANNEL_ID;
                    guildDisplayName = '[ALL]';
                    message = player + ": " + message;
                    break;
                default:
                    console.warn(`[Discord] Unknown guild: ${guild}`);
                    return;
            }

            const embed = new EmbedBuilder()
                .setTitle(guildDisplayName)
                .setColor(this.getGuildColor(guild))
                .setDescription(message)
                .setFooter({ text: `Received from: ${player}` });

            const channel = await this.client.channels.fetch(targetChannelId);
            await channel.send({ embeds: [embed] });
            console.log(`[Discord] Sent embed to ${guildDisplayName} from player ${player}:`, message);
        } catch(err) {
            console.error('[Discord] Send error:', err);
        }
    }

    getGuildColor(guild) {
        switch(guild) {
            case 'Ironman Sweats':
                return 0xFF0000; // Red
            case 'Ironman Academy':
                return 0x0000FF; // Blue
            case 'Ironman Casuals':
                return 0x00FF00; // Green
            default:
                return 0x00AE86; // Default teal
        }
    }
}

module.exports = DiscordHandler;