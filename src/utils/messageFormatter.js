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

const normalizeForDeduplication = (msg) =>
  cleanGuildMessage(msg)
    .replace(/\s+/g, ' ')
    .toLowerCase();

module.exports = {
  cleanGuildMessage,
  normalizeForDeduplication
};
