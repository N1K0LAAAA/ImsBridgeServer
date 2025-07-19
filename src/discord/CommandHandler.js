const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadMemberData } = require('../utils/dataUtils');
const GuildMemberUpdater = require('../services/GuildMemberUpdater'); // Adjust the path if needed

// Use environment variable for security
const API_KEY = process.env.HYPIXEL_API_KEY || 'YOUR_HYPIXEL_API_KEY'; // Replace with actual key or .env

class CommandHandler {
    constructor(client) {
        this.client = client;

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.on('interactionCreate', async (interaction) => {
            if(!interaction.isChatInputCommand()) return;

            switch(interaction.commandName) {
                case 'key':
                    await this.handleKeyCommand(interaction);
                    break;
                case 'update-guild-members':
                    await this.handleUpdateCommand(interaction);
                    break;
            }
        });
    }

    async registerCommands() {
        const commands = [
            new SlashCommandBuilder()
                .setName('key')
                .setDescription('Get your generated UUID key via DM'),
            new SlashCommandBuilder()
                .setName('update-guild-members')
                .setDescription('Force an update of guild members (admin only)')
        ].map(cmd => cmd.toJSON());

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

    async handleUpdateCommand(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const requiredRoleIds = ['1394154421897924690', '1394878381484671066'];
            const member = await interaction.guild.members.fetch(interaction.user.id);

            const authorized = requiredRoleIds.some(roleId => member.roles.cache.has(roleId));

            if(!authorized) {
                await interaction.editReply('❌ You do not have permission to run this command.');
                return;
            }

            const updater = new GuildMemberUpdater(API_KEY);
            const summary = await updater.updateGuildMembers();

            const summaryEmbed = new EmbedBuilder()
                .setTitle('📊 Guild Members Updated')
                .addFields(
                    { name: 'Processed', value: `${summary.totalProcessed}`, inline: true },
                    { name: 'New Members', value: `${summary.newMembersAdded}`, inline: true },
                    { name: 'Removed', value: `${summary.membersWhoLeft}`, inline: true },
                    { name: 'Final Count', value: `${summary.finalMemberCount}`, inline: true }
                )
                .setColor(0x3498db)
                .setTimestamp();

            await interaction.editReply({ content: '✅ Update complete!', embeds: [summaryEmbed] });

        } catch(error) {
            console.error('[Commands] Error in /update-guild-members:', error);
            await interaction.editReply('❌ Failed to update guild members. Please check logs.');
        }
    }


}

module.exports = CommandHandler;
