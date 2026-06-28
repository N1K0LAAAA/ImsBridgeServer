const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { loadMemberData, saveMemberData } = require('../utils/dataUtils');

const findMemberByMinecraftName = (memberData, ign) => {
  const dataArray = Array.isArray(memberData) ? memberData : Object.values(memberData);
  return dataArray.find(m => m.minecraft_name?.toLowerCase() === ign.toLowerCase());
};

const fetchLinkedDiscord = async (uuid) => {
  const url = `https://api.hypixel.net/player?key=${process.env.HYPIXEL_API_KEY}&uuid=${uuid}`;
  const { data } = await axios.get(url);

  if(!data.success) throw new Error(data.cause || 'Hypixel API request failed');
  if(!data.player) return { found: false, discord: null };

  return { found: true, discord: data.player?.socialMedia?.links?.DISCORD || null };
};

const execute = async (interaction) => {
  await interaction.deferReply({ flags: 64 });

  try {
    const ign = interaction.options.getString('minecraft', true).trim();
    const memberData = await loadMemberData();
    const member = findMemberByMinecraftName(memberData, ign);

    if(!member) {
      await interaction.editReply({
        content: `No guild member found with the Minecraft IGN \`${ign}\`. Double-check the spelling and try again.`
      });
      return;
    }

    const { found, discord: linkedDiscord } = await fetchLinkedDiscord(member.minecraft_uuid);

    if(!found) {
      await interaction.editReply({
        content: `Hypixel has no data for **${member.minecraft_name}**. Try again later.`
      });
      return;
    }

    if(!linkedDiscord) {
      await interaction.editReply({
        content: `**${member.minecraft_name}** has no Discord linked on Hypixel. Link your Discord in-game (Profile → Social Media) and try again.`
      });
      return;
    }

    const oldDiscordName = member.discord_name;

    if(oldDiscordName === linkedDiscord) {
      await interaction.editReply({
        content: `Discord name for **${member.minecraft_name}** is already up to date (\`${linkedDiscord}\`).`
      });
      return;
    }

    member.discord_name = linkedDiscord;
    await saveMemberData(memberData);

    const embed = new EmbedBuilder()
      .setTitle('Discord Name Synced')
      .addFields(
        { name: 'Minecraft IGN', value: member.minecraft_name, inline: true },
        { name: 'Discord Name', value: `${oldDiscordName || 'none'} → ${linkedDiscord}`, inline: true }
      )
      .setColor(0x00AE86)
      .setTimestamp()
      .setFooter({ text: 'Pulled from the Hypixel-linked Discord' });

    await interaction.editReply({ embeds: [embed] });
  } catch(error) {
    console.error('[Command:sync-discord] Error:', error);
    await interaction.editReply({
      content: 'An error occurred while syncing from Hypixel. Please try again later.'
    });
  }
};

const data = new SlashCommandBuilder()
  .setName('sync-discord')
  .setDescription('Sync a guild member\'s Discord name from their Hypixel-linked Discord')
  .addStringOption(option =>
    option
      .setName('minecraft')
      .setDescription('The Minecraft IGN to sync')
      .setRequired(true));

module.exports = { data, execute };
