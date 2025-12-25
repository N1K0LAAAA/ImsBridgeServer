const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const createGuildMemberUpdater = require('../services/guildMemberUpdater');
const { ADMIN_ROLE_IDS } = require('../config/constants');

const isAuthorized = async (interaction) => {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  return ADMIN_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
};

const createSummaryEmbed = ({ totalProcessed, newMembersAdded, membersWhoLeft, finalMemberCount }) =>
  new EmbedBuilder()
    .setTitle('Guild Members Updated')
    .addFields(
      { name: 'Processed', value: `${totalProcessed}`, inline: true },
      { name: 'New Members', value: `${newMembersAdded}`, inline: true },
      { name: 'Removed', value: `${membersWhoLeft}`, inline: true },
      { name: 'Final Count', value: `${finalMemberCount}`, inline: true }
    )
    .setColor(0x3498db)
    .setTimestamp();

const execute = async (interaction) => {
  await interaction.deferReply({ flags: 64 });

  try {
    if(!await isAuthorized(interaction)) {
      return await interaction.editReply({
        content: 'You do not have permission to run this command.'
      });
    }

    await interaction.editReply({
      content: 'Updating guild members from Hypixel API...\nThis may take a few minutes.'
    });

    const updater = createGuildMemberUpdater(process.env.HYPIXEL_API_KEY);
    const summary = await updater.updateGuildMembers();

    await interaction.client.wsServer.reloadValidKeys();

    const summaryEmbed = createSummaryEmbed(summary);
    await interaction.editReply({
      content: 'Update complete! Bridge keys have been reloaded.',
      embeds: [summaryEmbed]
    });

  } catch(error) {
    console.error('[Command:update-guild-members] Error:', error);

    const errorMessage = error.message.includes('API')
      ? 'Failed to connect to Hypixel API. Please check your API key and try again.'
      : 'Failed to update guild members. Please check logs for details.';

    await interaction.editReply({
      content: errorMessage,
      embeds: []
    });
  }
};

const data = new SlashCommandBuilder()
  .setName('update-guild-members')
  .setDescription('Force an update of guild members (admin only)')
  .setDefaultMemberPermissions(0)
  .setDMPermission(false);

module.exports = { data, execute };
