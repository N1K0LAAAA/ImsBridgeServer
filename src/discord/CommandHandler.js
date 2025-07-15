const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadMemberData } = require('../utils/dataUtils');

class CommandHandler {
    constructor(client, keyLogChannelId) {
        this.client = client;
        this.keyLogChannelId = keyLogChannelId;

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.on('interactionCreate', async (interaction) => {
            if(!interaction.isChatInputCommand()) return;

            if(interaction.commandName === 'key') {
                await this.handleKeyCommand(interaction);
            }
        });
    }

    async registerCommands() {
        const commands = [
            new SlashCommandBuilder()
                .setName('key')
                .setDescription('Get your generated UUID key via DM')
                .toJSON(),
        ];

        try {
            console.log('[Commands] Registering slash commands...');
            await this.client.application.commands.set(commands);
            console.log('[Commands] Successfully registered slash commands');
        } catch(error) {
            console.error('[Commands] Error registering slash commands:', error);
        }
    }

    async handleKeyCommand(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const memberData = await loadMemberData();
            const username = interaction.user.username;

            const member = Object.values(memberData).find(m =>
                m.discord_name === username
            );

            if(!member || !member.generated_uuid) {
                await interaction.editReply({
                    content: '❌ No UUID found for your account. Please contact an administrator.',
                });
                return;
            }

            const dmEmbed = new EmbedBuilder()
                .setTitle('🔑 Your Generated UUID')
                .setDescription(`\`\`\`${member.generated_uuid}\`\`\``)
                .setColor(0x00AE86)
                .setTimestamp()
                .setFooter({ text: 'Keep this UUID secure and private' });

            try {
                await interaction.user.send({ embeds: [dmEmbed] });

                await interaction.editReply({
                    content: '✅ Your UUID has been sent to your DMs!',
                });

            } catch(dmError) {
                console.error('[Commands] Could not send DM:', dmError);
                await interaction.editReply({
                    content: '❌ Could not send you a DM. Please check your privacy settings and try again.',
                });
            }

        } catch(error) {
            console.error('[Commands] Error handling key command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while processing your request. Please try again later.',
            });
        }
    }
}


module.exports = CommandHandler;