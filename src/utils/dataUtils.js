const fs = require('fs/promises');
const path = require('path');

const MEMBER_DATA_PATH = path.join(__dirname, '../../guild_members.json');

async function loadMemberData() {
    try {
        const data = await fs.readFile(MEMBER_DATA_PATH, 'utf8');
        return JSON.parse(data);
    } catch(error) {
        if(error.code === 'ENOENT') {
            console.warn('[Data] guild_members.json not found.');
            return {};
        }
        console.error('[Data] Error loading member data:', error);
        throw error;
    }
}

module.exports = {
    loadMemberData,
};