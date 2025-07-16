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
    }

    handleDiscordMessage(msg) {
        if(msg.author.bot) return;

        let targetGuild = null;

        if(msg.channel.id === this.channelIds.IMS_BRIDGE_CHANNEL_ID) {
            targetGuild = 'Ironman Sweats';
        } else if(msg.channel.id === this.channelIds.IMA_BRIDGE_CHANNEL_ID) {
            targetGuild = 'Ironman Academy';
        } else if(msg.channel.id === this.channelIds.IMC_BRIDGE_CHANNEL_ID) {
            targetGuild = 'Ironman Casuals';
        } else {
            return; 
        }

        const messageToSend = {
            from: 'discord',
            msg: `${msg.author.username}: ${msg.content}`,
        };

        this.wsServer.sendToMinecraft(messageToSend, targetGuild);
        console.log(`[Discord] Forwarded to ${targetGuild}:`, messageToSend);
    }

    async sendMinecraftMessageToDiscord(data) {
        try {
            const { message, guild, player } = data;

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
                default:
                    console.warn(`[Discord] Unknown guild: ${guild}`);
                    return;
            }

            const embed = new EmbedBuilder()
                .setTitle(guildDisplayName)
                .setColor(this.getGuildColor(guild))
                .setDescription(message)

            const channel = await this.client.channels.fetch(targetChannelId);
            await channel.send({ embeds: [embed] });
            console.log(`[Discord] Sent embed to ${guildDisplayName}:`, message);
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