const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const GUILD_NAMES = ['Ironman Sweats', 'Ironman Academy', 'Ironman Casuals'];

const formatPlayerList = (players = []) => {
  if(players.length === 0) return '_None connected_';

  const list = [...players].sort((a, b) => a.localeCompare(b)).join(', ');
  return list.length > 1024 ? `${list.slice(0, 1021)}...` : list;
};

const execute = async (interaction) => {
  await interaction.deferReply({ flags: 64 });

  try {
    const wsServer = interaction.client.wsServer;
    const [guildCounts, playersByGuild] = wsServer.getConnectedClientsByGuild();

    const guildFields = GUILD_NAMES.map(guild => ({
      name: `${guild} (${guildCounts[guild] || 0})`,
      value: formatPlayerList(playersByGuild[guild]),
      inline: false
    }));

    const embed = new EmbedBuilder()
      .setTitle('Bridge Statistics')
      .setColor(0x00AE86)
      .addFields(
        { name: 'Total Connected', value: `${wsServer.getConnectedClients()} players`, inline: false },
        ...guildFields
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
