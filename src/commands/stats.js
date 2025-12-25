const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const execute = async (interaction) => {
  await interaction.deferReply({ flags: 64 });

  try {
    const wsServer = interaction.client.wsServer;
    const [guildCounts] = wsServer.getConnectedClientsByGuild();

    const embed = new EmbedBuilder()
      .setTitle('Bridge Statistics')
      .setColor(0x00AE86)
      .addFields(
        { name: 'Total Connected', value: `${wsServer.getConnectedClients()} players`, inline: false },
        { name: 'Ironman Sweats', value: `${guildCounts['Ironman Sweats'] || 0} players`, inline: true },
        { name: 'Ironman Academy', value: `${guildCounts['Ironman Academy'] || 0} players`, inline: true },
        { name: 'Ironman Casuals', value: `${guildCounts['Ironman Casuals'] || 0} players`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch(error) {
    console.error('[Command:stats] Error:', error);
    await interaction.editReply('Failed to retrieve statistics.');
  }
};

const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View bridge statistics');

module.exports = { data, execute };
