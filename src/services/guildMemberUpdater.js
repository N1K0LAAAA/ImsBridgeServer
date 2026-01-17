const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs/promises");
const path = require("path");
const createRateLimiter = require("./rateLimiter");
const { RATE_LIMIT } = require("../config/constants");
const { getAllGuildNames } = require("../utils/guildMapper");

const createGuildMemberUpdater = (apiKey, guildNames = getAllGuildNames()) => {
  const jsonFile = path.join(__dirname, "../../guild_members.json");
  const rateLimiter = createRateLimiter(
    RATE_LIMIT.MAX_REQUESTS_PER_5MIN,
    RATE_LIMIT.WINDOW_MS,
    RATE_LIMIT.SAFETY_BUFFER
  );

  const loadExistingMembers = async () => {
    try {
      const file = await fs.readFile(jsonFile, "utf-8");
      return JSON.parse(file);
    } catch {
      return [];
    }
  };

  const saveMembers = async (data) => {
    await fs.writeFile(jsonFile, JSON.stringify(data, null, 2));
    console.log("Saved updated guild_members.json");
  };

  const getGuildMemberUUIDs = async (guildName) => {
    await rateLimiter.waitIfNeeded();

    const url = `https://api.hypixel.net/guild?key=${apiKey}&name=${encodeURIComponent(guildName)}`;
    const { data } = await axios.get(url);

    if(!data.success) {
      throw new Error(`Failed to fetch guild ${guildName}: ${data.cause}`);
    }

    console.log(`Found ${data.guild.members.length} members in ${guildName}`);
    return data.guild.members.map(({ uuid }) => uuid);
  };

  const getPlayerInfo = async (uuid) => {
    await rateLimiter.waitIfNeeded();

    const url = `https://api.hypixel.net/player?key=${apiKey}&uuid=${uuid}`;
    const { data } = await axios.get(url);

    if(!data.success || !data.player) return null;

    const { player } = data;
    return {
      minecraft_name: player.displayname || uuid,
      minecraft_uuid: uuid,
      discord_name: player?.socialMedia?.links?.DISCORD || "Not linked"
    };
  };

  const fetchNewMemberInfo = async (uuid, guild) => {
    console.log(`Fetching info for new member... (${rateLimiter.getRequestsRemaining()} requests remaining)`);

    const info = await getPlayerInfo(uuid);
    if(!info) {
      console.log(`Could not fetch info for UUID: ${uuid}`);
      return null;
    }

    return {
      ...info,
      generated_uuid: uuidv4(),
      guild_name: guild
    };
  };

  const processGuild = async (guild, existingMap, allCurrentUUIDs, updatedMembersMap) => {
    console.log(`Processing guild: ${guild}`);
    const log = [`Processing guild: ${guild}`];
    let newMembers = 0;

    try {
      const uuids = await getGuildMemberUUIDs(guild);

      for(const uuid of uuids) {
        allCurrentUUIDs.add(uuid);

        const existing = existingMap.get(uuid);

        if(existing) {
          updatedMembersMap.set(uuid, {
            minecraft_name: existing.minecraft_name,
            minecraft_uuid: existing.minecraft_uuid,
            discord_name: existing.discord_name,
            generated_uuid: existing.generated_uuid,
            guild_name: guild
          });
          console.log(`Updated existing member: ${existing.minecraft_name} (${guild}) - Key preserved`);
        } else {
          const info = await fetchNewMemberInfo(uuid, guild);
          if(info) {
            updatedMembersMap.set(uuid, info);
            console.log(`Added new member: ${info.minecraft_name} (${guild}) - New key generated`);
            log.push(`Added new member: ${info.minecraft_name} (${guild})`);
            newMembers++;
          }
        }
      }

      console.log(`Completed ${guild}: ${uuids.length} members processed`);
      log.push(`Completed ${guild}: ${uuids.length} members processed`);
    } catch(error) {
      console.error(`Error processing guild ${guild}:`, error.message);
      log.push(`Error processing ${guild}: ${error.message}`);
    }

    return { newMembers, log };
  };

  const buildSummary = (totalProcessed, newMembersAdded, membersWhoLeft, finalMemberCount, updateLog) => {
    const summary = {
      totalProcessed,
      newMembersAdded,
      membersWhoLeft,
      finalMemberCount,
      updateLog
    };

    console.log(`Update Summary:`);
    console.log(`Total members processed: ${totalProcessed}`);
    console.log(`New members added: ${newMembersAdded}`);
    console.log(`Members who left: ${membersWhoLeft}`);
    console.log(`Final member count: ${finalMemberCount}`);
    console.log(`Update complete.`);

    return summary;
  };

  const updateGuildMembers = async (wsServer = null) => {
    const existingMembers = await loadExistingMembers();
    const existingMap = new Map(existingMembers.map(m => [m.minecraft_uuid, m]));
    const allCurrentUUIDs = new Set();
    const updatedMembersMap = new Map(); 

    let totalNewMembers = 0;
    const updateLog = [];

    for(const guild of guildNames) {
      const { newMembers, log } = await processGuild(guild, existingMap, allCurrentUUIDs, updatedMembersMap);
      totalNewMembers += newMembers;
      updateLog.push(...log);
    }

    const updatedMembers = Array.from(updatedMembersMap.values());

    const membersWhoLeft = existingMembers.filter(
      ({ minecraft_uuid }) => !allCurrentUUIDs.has(minecraft_uuid)
    );

    const finalList = updatedMembers;
    await saveMembers(finalList);

    if(wsServer && membersWhoLeft.length > 0) {
      console.log(`Processing ${membersWhoLeft.length} players who left guilds...`);

      await wsServer.reloadValidKeys();

      for(const member of membersWhoLeft) {
        const disconnected = await wsServer.disconnectUser(member.minecraft_name);
        if(disconnected) {
          console.log(`[AutoKick] Disconnected ${member.minecraft_name} - left ${member.guild_name}`);
          updateLog.push(`Disconnected ${member.minecraft_name} - no longer in ${member.guild_name}`);
        }
      }
    }

    return buildSummary(
      updatedMembers.length,
      totalNewMembers,
      membersWhoLeft.length,
      finalList.length,
      updateLog
    );
  };

  return { updateGuildMembers };
};

module.exports = createGuildMemberUpdater;
