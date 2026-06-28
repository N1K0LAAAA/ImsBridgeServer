const cleanName = (name) =>
  name
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/§\w/g, '')
    .replace(/^Guild\s?>?\s?/, '')
    .replace(/[♲ቾ⚒♻️♾️✨★☆♠♣♥♦✓✔︎•·●○◉◎★☆¤§©®™✓☑️❌➤➔→←↑↓↔↕]/g, '')
    .trim();

const cleanGuildMessage = (msg) => {
  const colonIndex = msg.indexOf(':');
  if(colonIndex === -1) return cleanName(msg);

  const name = cleanName(msg.slice(0, colonIndex));
  const body = msg.slice(colonIndex + 1).trim();

  return `${name} : ${body}`;
};

const normalizeForDeduplication = (msg) =>{
  return cleanGuildMessage(msg)
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const sanitizeDiscordText = (text = '') => {
  return String(text)
    .replace(/please be mindful of discord links in chat as they may pose a security risk/gi, '')
    .replace(/https?:\/\/(?:www\.)?discord\.gg\/\S+/gi, '')
    .replace(/https?:\/\/(?:www\.)?discord\.com\/invite\/\S+/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    .replace(/@/g, '@\u200B')
    .replace(/([\\*_`~>|#[\]()])/g, '\\$1')
    .replace(/\s+/g, ' ')
    .trim();
};

module.exports = {
  cleanGuildMessage,
  normalizeForDeduplication,
  sanitizeDiscordText
};

