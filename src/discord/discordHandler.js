const { EmbedBuilder } = require('discord.js');
const {
  getGuildByChannelId,
  getChannelIdByGuildName,
  getGuildColor,
  getGuildDisplayName
} = require('../utils/guildMapper');

const createDiscordHandler = (client, channelIds, wsServer) => {
  const getMessageRoutingInfo = (channelId) => {
    if(channelId === channelIds.COMBINED_CHANNEL_ID) {
      return { combinedBridge: true, targetGuild: null };
    }

    const targetGuild = getGuildByChannelId(channelId, channelIds);
    return targetGuild ? { combinedBridge: false, targetGuild } : null;
  };

  const handleDiscordMessage = (msg) => {
    if(msg.author.bot) return;

    const routingInfo = getMessageRoutingInfo(msg.channel.id);
    if(!routingInfo) return;

    const displayName = msg.member?.displayName || msg.author.username;
    const messageToSend = {
      from: 'discord',
      msg: `${displayName}: ${msg.content}`,
      combinedbridge: routingInfo.combinedBridge,
      guild: routingInfo.targetGuild
    };

    wsServer.sendToMinecraft(messageToSend, routingInfo.targetGuild);
    console.log(`[Discord] Forwarded to ${routingInfo.targetGuild || 'All Guilds'}: ${displayName}: ${msg.content}`);
  };

  const bounceMinecraftMessage = ({ msg, player, combinedbridge, guild }) => {
    try {
      wsServer.sendToMinecraft({
        from: 'mc',
        msg: `${player}: ${msg}`,
        combinedbridge,
        fromplayer: player,
        guild
      }, null, null);

      console.log(`[MC] Bounced combined chat msg: ${player}: ${msg}`);
    } catch(err) {
      console.error('[MC] Bounce error:', err);
    }
  };

  const bounceMinecraftShowMessage = ({ msg, player, combinedbridge, guild, jsonStack }) => {
    try {
      wsServer.sendToMinecraft({
        from: 'mc',
        msg: `${player}: ${msg}`,
        combinedbridge,
        fromplayer: player,
        guild,
        jsonStack: jsonStack,
        show: 'true'
      }, null, null);

      console.log(`[MC] Bounced show chat msg: ${player}: ${msg}`);
    } catch(err) {
      console.error('[MC] Bounce error:', err);
    }
  };

  const parseMessage = (message, player, combinedbridge, show) => {
    if(combinedbridge || show) {
      return { author: player, text: message };
    }

    const [author, ...messageParts] = message.split(" : ");
    return { author, text: messageParts.join(" : ") };
  };

  const createMessageEmbed = (author, text, guild, player) => {
    const guildDisplayName = getGuildDisplayName(guild);

    return new EmbedBuilder()
      .setColor(getGuildColor(guild))
      .setAuthor({
        name: author,
        iconURL: `https://www.mc-heads.net/avatar/${author}`
      })
      .setDescription(text)
      .setTimestamp()
      .setFooter({ text: `Received from: ${guildDisplayName} ${player}` });
  };

  const sendMinecraftMessageToDiscord = async ({ message, player, combinedbridge, guild, show }) => {
    try {
      const channelId = combinedbridge
        ? channelIds.COMBINED_CHANNEL_ID
        : getChannelIdByGuildName(guild, channelIds);

      if(!channelId) {
        console.warn(`[Discord] Unknown guild: ${guild}`);
        return;
      }

      const { author, text } = parseMessage(message, player, combinedbridge, show);
      const embed = createMessageEmbed(author, text, guild, player);

      const channel = await client.channels.fetch(channelId);
      await channel.send({ embeds: [embed] });

      const displayName = getGuildDisplayName(guild);
      console.log(`[Discord] Sent embed to ${combinedbridge ? '[CBRIDGE]' : displayName} from ${player}`);
    } catch(err) {
      console.error('[Discord] Send error:', err);
    }
  };

  client.on('messageCreate', handleDiscordMessage);
  wsServer.on('minecraftMessage', sendMinecraftMessageToDiscord);
  wsServer.on('minecraftBounce', bounceMinecraftMessage);
  wsServer.on('minecraftBounceShow', bounceMinecraftShowMessage);

  return { handleDiscordMessage, sendMinecraftMessageToDiscord, bounceMinecraftMessage, bounceMinecraftShowMessage };
};

module.exports = createDiscordHandler;
