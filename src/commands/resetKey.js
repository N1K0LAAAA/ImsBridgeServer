const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const { loadMemberData, saveMemberData } = require('../utils/dataUtils');

const findMemberByUsername = (memberData, username) => {
  const dataArray = Array.isArray(memberData) ? memberData : Object.values(memberData);
  return dataArray.find(m => m.discord_name.toLowerCase() === username.toLowerCase());
};

const resetMemberKey = async (member) => {
  const memberData = await loadMemberData();
  const dataArray = Array.isArray(memberData) ? memberData : Object.values(memberData);

  const memberIndex = dataArray.findIndex(m => m.minecraft_uuid === member.minecraft_uuid);

  if(memberIndex === -1) {
    throw new Error('Member not found in database');
  }

  const newUuid = uuidv4();
  dataArray[memberIndex].generated_uuid = newUuid;

  await saveMemberData(dataArray);
  return newUuid;
};

const sendNewKeyToDM = async (interaction, uuid, minecraftName) => {
  const dmEmbed = new EmbedBuilder()
    .setTitle('Your Bridge Key Has Been Reset')
    .setDescription(`**Minecraft Account:** ${minecraftName}\n\n**New UUID:**\n\`\`\`${uuid}\`\`\``)
    .setColor(0xFF9500)
    .setTimestamp()
    .setFooter({ text: 'Keep this UUID secure and private. Your old key is now invalid.' });

  try {
    await interaction.user.send({ embeds: [dmEmbed] });
    return true;
  } catch(dmError) {
    console.error('[Command:reset-key] Could not send DM:', dmError);
    return false;
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

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_reset')
          .setLabel('Yes, Reset My Key')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel_reset')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    const confirmEmbed = new EmbedBuilder()
      .setTitle('Confirm Key Reset')
      .setDescription(
        `**Minecraft Account:** ${member.minecraft_name}\n\n` +
        `Are you sure you want to reset your bridge key?\n\n` +
        `**Warning:** Your current key will be immediately invalidated and ` +
        `any active connections using it will be disconnected.`
      )
      .setColor(0xFF9500)
      .setTimestamp();

    const response = await interaction.editReply({
      embeds: [confirmEmbed],
      components: [row]
    });

    try {
      const confirmation = await response.awaitMessageComponent({
        time: 30000
      });

      if(confirmation.customId === 'confirm_reset') {
        await confirmation.deferUpdate();

        const newUuid = await resetMemberKey(member);
        await interaction.client.wsServer.reloadValidKeys();
        // Disconnect user if connected with old key
        
        const dmSent = await sendNewKeyToDM(interaction, newUuid, member.minecraft_name);

        const successEmbed = new EmbedBuilder()
          .setTitle('Key Reset Successful')
          .setDescription(
            dmSent
              ? 'Your new UUID has been sent to your DMs!\n\n Your old key is now invalid.'
              : 'Your key has been reset, but I couldn\'t send you a DM.\n\nPlease check your privacy settings and use `/key` to retrieve your new UUID.'
          )
          .setColor(0x00FF00)
          .setTimestamp();

        await interaction.editReply({
          embeds: [successEmbed],
          components: []
        });

        console.log(`[Command:reset-key] Key reset for ${member.minecraft_name} by ${interaction.user.username}`);
      } else {
        await confirmation.deferUpdate();
        await interaction.editReply({
          content: 'Key reset cancelled.',
          embeds: [],
          components: []
        });
      }
    } catch(e) {
      await interaction.editReply({
        content: 'Key reset cancelled (timed out).',
        embeds: [],
        components: []
      });
    }

  } catch(error) {
    console.error('[Command:reset-key] Error:', error);
    await interaction.editReply({
      content: 'An error occurred while resetting your key. Please try again later.',
      components: []
    });
  }
};

const data = new SlashCommandBuilder()
  .setName('reset-key')
  .setDescription('Reset your bridge UUID key (invalidates old key)');

module.exports = { data, execute };
