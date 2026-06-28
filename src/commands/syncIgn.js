const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { loadMemberData, saveMemberData } = require('../utils/dataUtils');

const normalizeUuid = (uuid) => uuid?.replace(/-/g, '').toLowerCase();

const findMemberByUuid = (memberData, uuid) => {
  const dataArray = Array.isArray(memberData) ? memberData : Object.values(memberData);
  const target = normalizeUuid(uuid);
  return dataArray.find(m => normalizeUuid(m.minecraft_uuid) === target);
};

const resolveMojangProfile = async (ign) => {
  try {
    const url = `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(ign)}`;
    const { data } = await axios.get(url);
    if(!data?.id || !data?.name) return null;
    return { uuid: data.id, name: data.name };
  } catch(error) {
    if(error.response && [204, 404].includes(error.response.status)) return null;
    throw error;
  }
};

const execute = async (interaction) => {
  await interaction.deferReply({ flags: 64 });

  try {
    const ign = interaction.options.getString('minecraft', true).trim();
    const profile = await resolveMojangProfile(ign);

    if(!profile) {
      await interaction.editReply({
        content: `No Minecraft account found with the name \`${ign}\`. Make sure you typed your current IGN correctly.`
      });
      return;
    }

    const memberData = await loadMemberData();
    const member = findMemberByUuid(memberData, profile.uuid);

    if(!member) {
      await interaction.editReply({
        content: `\`${profile.name}\` isn't in the guild records. Only existing guild members can sync their name.`
      });
      return;
    }

    const oldName = member.minecraft_name;

    if(oldName === profile.name) {
      await interaction.editReply({
        content: `Your name is already up to date (\`${profile.name}\`).`
      });
      return;
    }

    member.minecraft_name = profile.name;
    await saveMemberData(memberData);
    await interaction.client.wsServer.reloadValidKeys();

    const embed = new EmbedBuilder()
      .setTitle('Minecraft Name Synced')
      .addFields(
        { name: 'Minecraft IGN', value: `${oldName || 'unknown'} → ${profile.name}`, inline: true },
        { name: 'Guild', value: member.guild_name || 'unknown', inline: true }
      )
      .setColor(0x00AE86)
      .setTimestamp()
      .setFooter({ text: 'Resolved from the Mojang API' });

    await interaction.editReply({ embeds: [embed] });
  } catch(error) {
    console.error('[Command:sync-ign] Error:', error);
    await interaction.editReply({
      content: 'An error occurred while syncing your name. Please try again later.'
    });
  }
};

const data = new SlashCommandBuilder()
  .setName('sync-ign')
  .setDescription('Update your saved Minecraft name after an in-game name change')
  .addStringOption(option =>
    option
      .setName('minecraft')
      .setDescription('Your current (new) Minecraft IGN')
      .setRequired(true));

module.exports = { data, execute };
