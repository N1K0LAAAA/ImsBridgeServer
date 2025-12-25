const userCache = new Map();

const findUserByUsername = async (client, username) => {
  if(userCache.has(username.toLowerCase())) {
    const userId = userCache.get(username.toLowerCase());
    try {
      return await client.users.fetch(userId);
    } catch {
      userCache.delete(username.toLowerCase());
    }
  }
  for(const guild of client.guilds.cache.values()) {
    const member = guild.members.cache.find(m =>
      m.user.username.toLowerCase() === username.toLowerCase()
    );

    if(member) {
      userCache.set(username.toLowerCase(), member.user.id);
      return member.user;
    }
  }

  return null;
};

const clearCache = () => userCache.clear();

module.exports = { findUserByUsername, clearCache };
