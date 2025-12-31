const cleanGuildMessage = (msg) =>
  msg
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/§\w/g, '')
    .replace(/^Guild\s?>?\s?/, '')
    .replace(/[♲ቾ⚒♻️♾️✨★☆♠♣♥♦✓✔︎•·●○◉◎★☆¤§©®™✓☑️❌➤➔→←↑↓↔↕]/g, '')
    .trim();

const normalizeForDeduplication = (msg) =>
  cleanGuildMessage(msg)
    .replace(/\s+/g, ' ')
    .toLowerCase();

module.exports = {
  cleanGuildMessage,
  normalizeForDeduplication
};
