const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const { loadMemberData, saveMemberData } = require('../utils/dataUtils');
const { ADMIN_ROLE_IDS } = require('../config/constants');
const { findUserByUsername } = require('../utils/discordUserCache');

const isAuthorized = async (interaction) => {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  return ADMIN_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
};

const findMemberByMinecraftName = (memberData, minecraftName) => {
  const dataArray = Array.isArray(memberData) ? memberData : Object.values(memberData);
  return dataArray.find(m =>
    m.minecraft_name.toLowerCase() === minecraftName.toLowerCase()
  );
};

const restoreAccess = async (minecraftName) => {
  const memberData = await loadMemberData();
  const dataArray = Array.isArray(memberData) ? memberData : Object.values(memberData);

  const memberIndex = dataArray.findIndex(m =>
    m.minecraft_name.toLowerCase() === minecraftName.toLowerCase()
  );

  if(memberIndex === -1) {
    return { success: false, reason: 'Member not found in database' };
  }

  const member = dataArray[memberIndex];

  if(member.generated_uuid) {
    return { success: false, reason: 'Member already has an active key' };
  }

  const newUuid = uuidv4();
  dataArray[memberIndex].generated_uuid = newUuid;

  await saveMemberData(dataArray);
  return { success: true, member, newUuid };
};

const sendKeyToUser = async (client, discordName, uuid, minecraftName) => {
  if(!discordName || discordName === 'Not linked') {
    return { sent: false, reason: 'Discord not linked' };
  }

  try {
    const username = discordName.split('#')[0];
    const user = await findUserByUsername(client, username);

    if(!user) {
      return { sent: false, reason: 'User not found' };
    }

    const dmEmbed = new EmbedBuilder()
      .setTitle('Bridge Access Restored')
      .setDescription(
        `Your bridge access has been restored by an administrator.\n\n` +
        `**Minecraft Account:** ${minecraftName}\n\n` +
        `**Your New UUID:**\n\`\`\`${uuid}\`\`\``
      )
      .setColor(0x00FF00)
      .setTimestamp()
      .setFooter({ text: 'Keep this UUID secure and private' });

    await user.send({ embeds: [dmEmbed] });
    return { sent: true };
  } catch(error) {
    console.error('[Command:restore-access] Could not send DM:', error);
    return { sent: false, reason: 'DM failed or user has DMs disabled' };
  }
};

const execute = async (interaction) => {
  try {
    await interaction.deferReply({ flags: 64 });

    if(!await isAuthorized(interaction)) {
      await interaction.editReply('You do not have permission to run this command.');
      return;
    }

    const minecraftName = interaction.options.getString('minecraft-name');

    const memberData = await loadMemberData();
    const member = findMemberByMinecraftName(memberData, minecraftName);

    if(!member) {
      await interaction.editReply({
        content: `Player **${minecraftName}** not found in the database.`
      });
      return;
    }

    if(member.generated_uuid) {
      await interaction.editReply({
        content: `Player **${member.minecraft_name}** already has an active bridge key. Use \`/revoke-access\` first if you need to reset it.`
      });
      return;
    }

    const result = await restoreAccess(minecraftName);

    if(!result.success) {
      await interaction.editReply({
        content: `Failed to restore access: ${result.reason}`
      });
      return;
    }

    await interaction.client.wsServer.reloadValidKeys();

    const dmResult = await sendKeyToUser(
      interaction.client,
      result.member.discord_name,
      result.newUuid,
      result.member.minecraft_name
    );

    const embed = new EmbedBuilder()
      .setTitle('Bridge Access Restored')
      .setDescription(
        `**Minecraft Name:** ${result.member.minecraft_name}\n` +
        `**Discord Name:** ${result.member.discord_name}\n` +
        `**Guild:** ${result.member.guild_name}\n\n` +
        `Bridge access has been restored with a new UUID.\n` +
        (dmResult.sent
          ? 'The new key was sent to the user via DM.\n'
          : `Could not send DM (${dmResult.reason}). Please provide the key manually.\n\n**New UUID:**\n\`\`\`${result.newUuid}\`\`\``)
      )
      .setColor(0x00FF00)
      .setTimestamp()
      .setFooter({ text: `Restored by ${interaction.user.username}` });

    await interaction.editReply({ embeds: [embed] });

    console.log(`[Command:restore-access] Access restored for ${result.member.minecraft_name} by ${interaction.user.username}`);

  } catch(error) {
    console.error('[Command:restore-access] Error:', error);
    await interaction.editReply('Failed to restore access. Please check logs.');
  }
};

const data = new SlashCommandBuilder()
  .setName('restore-access')
  .setDescription('Restore bridge access for a player whose access was revoked (admin only)')
  .addStringOption(option =>
    option
      .setName('minecraft-name')
      .setDescription('The Minecraft username of the player')
      .setRequired(true)
  )
  .setDMPermission(false);

module.exports = { data, execute };
