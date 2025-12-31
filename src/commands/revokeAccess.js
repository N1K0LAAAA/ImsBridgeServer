const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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

const revokeAccess = async (minecraftName) => {
  const memberData = await loadMemberData();
  const dataArray = Array.isArray(memberData) ? memberData : Object.values(memberData);

  const memberIndex = dataArray.findIndex(m =>
    m.minecraft_name.toLowerCase() === minecraftName.toLowerCase()
  );

  if(memberIndex === -1) {
    return { success: false, reason: 'Member not found in database' };
  }

  const member = dataArray[memberIndex];
  dataArray[memberIndex].generated_uuid = null;

  await saveMemberData(dataArray);
  return { success: true, member };
};

const notifyUserRevoked = async (client, discordName, minecraftName, reason) => {
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
      .setTitle('Bridge Access Revoked')
      .setDescription(
        `Your bridge access has been revoked by an administrator.\n\n` +
        `**Minecraft Account:** ${minecraftName}\n\n` +
        `**Reason:** ${reason || 'No reason provided'}\n\n` +
        `If you believe this is a mistake, please contact an administrator.`
      )
      .setColor(0xFF0000)
      .setTimestamp();

    await user.send({ embeds: [dmEmbed] });
    return { sent: true };
  } catch(error) {
    console.error('[Command:revoke-access] Could not send DM:', error);
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
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const memberData = await loadMemberData();
    const member = findMemberByMinecraftName(memberData, minecraftName);

    if(!member) {
      await interaction.editReply({
        content: `Player **${minecraftName}** not found in the database.`
      });
      return;
    }

    if(!member.generated_uuid) {
      await interaction.editReply({
        content: `Player **${member.minecraft_name}** already has no active bridge key.`
      });
      return;
    }

    const result = await revokeAccess(minecraftName);

    if(!result.success) {
      await interaction.editReply({
        content: `Failed to revoke access: ${result.reason}`
      });
      return;
    }

    await interaction.client.wsServer.reloadValidKeys();
    const disconnected = await interaction.client.wsServer.disconnectUser(result.member.minecraft_name);

    const dmResult = await notifyUserRevoked(
      interaction.client,
      result.member.discord_name,
      result.member.minecraft_name,
      reason
    );

    const embed = new EmbedBuilder()
      .setTitle('Bridge Access Revoked')
      .setDescription(
        `**Minecraft Name:** ${result.member.minecraft_name}\n` +
        `**Discord Name:** ${result.member.discord_name}\n` +
        `**Guild:** ${result.member.guild_name}\n` +
        `**Reason:** ${reason}\n\n` +
        `Bridge access has been revoked.\n` +
        `${disconnected ? 'User was disconnected from the bridge.\n' : 'User was not currently connected.\n'}` +
        `${dmResult.sent ? 'User was notified via DM.\n' : `Could not send DM (${dmResult.reason}).\n`}\n` +
        `The player will need to contact an administrator to get access restored.`
      )
      .setColor(0xFF0000)
      .setTimestamp()
      .setFooter({ text: `Revoked by ${interaction.user.username}` });

    await interaction.editReply({ embeds: [embed] });

    console.log(`[Command:revoke-access] Access revoked for ${result.member.minecraft_name} by ${interaction.user.username} - Reason: ${reason}`);

  } catch(error) {
    console.error('[Command:revoke-access] Error:', error);
    await interaction.editReply('Failed to revoke access. Please check logs.');
  }
};

const data = new SlashCommandBuilder()
  .setName('revoke-access')
  .setDescription('Revoke bridge access for a player (admin only)')
  .addStringOption(option =>
    option
      .setName('minecraft-name')
      .setDescription('The Minecraft username of the player')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for revoking access (will be sent to user)')
      .setRequired(false)
  )
  .setDMPermission(false);

module.exports = { data, execute };
