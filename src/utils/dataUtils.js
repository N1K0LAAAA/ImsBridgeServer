const fs = require('fs/promises');
const path = require('path');

const MEMBER_DATA_PATH = path.join(__dirname, '../../guild_members.json');

const loadMemberData = async () => {
  try {
    const data = await fs.readFile(MEMBER_DATA_PATH, 'utf8');
    return JSON.parse(data);
  } catch(error) {
    if(error.code === 'ENOENT') {
      console.warn('[Data] guild_members.json not found.');
      return [];  
    }
    console.error('[Data] Error loading member data:', error);
    throw error;
  }
};

const saveMemberData = async (data) => {
  try {
    await fs.writeFile(MEMBER_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.log('[Data] Successfully saved member data');
  } catch(error) {
    console.error('[Data] Error saving member data:', error);
    throw error;
  }
};

module.exports = { loadMemberData, saveMemberData };
