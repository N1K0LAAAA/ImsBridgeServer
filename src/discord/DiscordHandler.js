const { EmbedBuilder } = require('discord.js');

class DiscordHandler {
    constructor(client, channelId, wsServer) {
        this.client = client;
        this.channelId = channelId;
        this.wsServer = wsServer;

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.on('messageCreate', (msg) => {
            this.handleDiscordMessage(msg);
        });

        this.wsServer.on('minecraftMessage', (cleanedMsg) => {
            this.sendMinecraftMessageToDiscord(cleanedMsg);
        });
    }

    handleDiscordMessage(msg) {
        if(msg.channel.id !== this.channelId || msg.author.bot) return;

        const messageToSend = {
            from: 'discord',
            msg: `${msg.author.username}: ${msg.content}`,
        };

        this.wsServer.sendToMinecraft(messageToSend);
        console.log('[Discord] Forwarded to Minecraft:', messageToSend);
    }

    async sendMinecraftMessageToDiscord(cleanedMsg) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('Combined Guilds')
                .setColor(0x00AE86)
                .setDescription(cleanedMsg);

            const channel = await this.client.channels.fetch(this.channelId);
            await channel.send({ embeds: [embed] });

            console.log('[Discord] Sent embed:', cleanedMsg);
        } catch(err) {
            console.error('[Discord] Send error:', err);
        }
    }
}

module.exports = DiscordHandler;