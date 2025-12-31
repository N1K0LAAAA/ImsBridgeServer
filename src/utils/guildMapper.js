const { GUILD_CONFIG } = require('../config/constants');

const getGuildByChannelId = (channelId, channelIds) =>
  GUILD_CONFIG.find(({ channelKey }) => channelIds[channelKey] === channelId)?.name ?? null;

const getConfigByGuildName = (guildName) =>
  GUILD_CONFIG.find(({ name }) => name === guildName);

const getChannelIdByGuildName = (guildName, channelIds) => {
  const config = getConfigByGuildName(guildName);
  return config ? channelIds[config.channelKey] : null;
};

const getGuildColor = (guildName) =>
  getConfigByGuildName(guildName)?.color ?? 0x00AE86;

const getGuildDisplayName = (guildName) =>
  getConfigByGuildName(guildName)?.displayName ?? '[UNKNOWN]';

const getAllGuildNames = () =>
  GUILD_CONFIG.map(({ name }) => name);

module.exports = {
  getGuildByChannelId,
  getConfigByGuildName,
  getChannelIdByGuildName,
  getGuildColor,
  getGuildDisplayName,
  getAllGuildNames
};
