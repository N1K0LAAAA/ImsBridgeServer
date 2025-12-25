const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadMemberData } = require('../utils/dataUtils');

const findMemberByUsername = (memberData, username) => {
  const dataArray = Array.isArray(memberData) ? memberData : Object.values(memberData);
  return dataArray.find(m => m.discord_name.toLowerCase() === username.toLowerCase());
};

const sendUuidToDM = async (interaction, uuid) => {
  const dmEmbed = new EmbedBuilder()
    .setTitle('Your Generated UUID')
    .setDescription(`\`\`\`${uuid}\`\`\``)
    .setColor(0x00AE86)
    .setTimestamp()
    .setFooter({ text: 'Keep this UUID secure and private' });

  try {
    await interaction.user.send({ embeds: [dmEmbed] });
    await interaction.editReply({ content: 'Your UUID has been sent to your DMs!' });
  } catch(dmError) {
    console.error('[Command:key] Could not send DM:', dmError);
    await interaction.editReply({
      content: 'Could not send you a DM. Please check your privacy settings and try again.'
    });
  }
};

const execute = async (interaction) => {
  try {
    await interaction.deferReply({ flags: 64 });

    const memberData = await loadMemberData();
    const member = findMemberByUsername(memberData, interaction.user.username);

    if(!member?.generated_uuid) {
      await interaction.editReply({
        content: 'No UUID found for your account. Please contact an administrator.'
      });
      return;
    }

    await sendUuidToDM(interaction, member.generated_uuid);
  } catch(error) {
    console.error('[Command:key] Error:', error);
    await interaction.editReply({
      content: 'An error occurred while processing your request. Please try again later.'
    });
  }
};

const data = new SlashCommandBuilder()
  .setName('key')
  .setDescription('Get your generated UUID key via DM');

module.exports = { data, execute };
