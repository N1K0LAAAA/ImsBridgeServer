const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs/promises");
const path = require("path");

class GuildMemberUpdater {
    constructor(apiKey, guildNames = ["Ironman Sweats", "Ironman Casuals", "Ironman Academy"]) {
        this.API_KEY = apiKey;
        this.GUILD_NAMES = guildNames;
        this.JSON_FILE = path.join(__dirname, "../../guild_members.json");

        // Rate limiting constants
        this.MAX_REQUESTS_PER_5MIN = 300;
        this.RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
        this.SAFETY_BUFFER = 10;

        this.rateLimiter = new RateLimiter(this.MAX_REQUESTS_PER_5MIN, this.RATE_LIMIT_WINDOW_MS);
    }

    async updateGuildMembers() {
        const existingMembers = await this.loadExistingMembers();
        const existingMap = new Map(existingMembers.map(m => [m.minecraft_uuid, m]));
        const allCurrentUUIDs = new Set();
        const updatedMembers = [];

        let totalNewMembers = 0;
        let totalProcessed = 0;
        let updateLog = [];

        for(let i = 0; i < this.GUILD_NAMES.length; i++) {
            const guild = this.GUILD_NAMES[i];
            console.log(`\n📥 Processing guild: ${guild}`);
            updateLog.push(`Processing guild: ${guild}`);

            const uuids = await this.getGuildMemberUUIDs(guild);

            for(const uuid of uuids) {
                allCurrentUUIDs.add(uuid);
                const existing = existingMap.get(uuid);

                if(existing) {
                    existing.guild_name = guild;
                    updatedMembers.push(existing);
                } else {
                    console.log(`🔍 Fetching info for new member... (${this.rateLimiter.getRequestsRemaining()} requests remaining)`);

                    const info = await this.getPlayerInfo(uuid);
                    if(!info) {
                        console.log(`⚠️  Could not fetch info for UUID: ${uuid}`);
                        continue;
                    }

                    const generated_uuid = uuidv4();
                    updatedMembers.push({
                        ...info,
                        generated_uuid,
                        guild_name: guild
                    });

                    console.log(`➕ Added new member: ${info.minecraft_name} (${guild})`);
                    updateLog.push(`Added new member: ${info.minecraft_name} (${guild})`);
                    totalNewMembers++;
                }

                totalProcessed++;
            }

            console.log(`✅ Completed ${guild}: ${uuids.length} members processed`);
            updateLog.push(`Completed ${guild}: ${uuids.length} members processed`);
        }

        // Remove players who left all 3 guilds
        const membersWhoLeft = updatedMembers.filter(member => !allCurrentUUIDs.has(member.minecraft_uuid));
        const finalList = updatedMembers.filter(member => allCurrentUUIDs.has(member.minecraft_uuid));

        await this.saveMembers(finalList);

        const summary = {
            totalProcessed,
            newMembersAdded: totalNewMembers,
            membersWhoLeft: membersWhoLeft.length,
            finalMemberCount: finalList.length,
            updateLog
        };

        console.log(`\n📊 Update Summary:`);
        console.log(`   • Total members processed: ${totalProcessed}`);
        console.log(`   • New members added: ${totalNewMembers}`);
        console.log(`   • Members who left: ${membersWhoLeft.length}`);
        console.log(`   • Final member count: ${finalList.length}`);
        console.log(`✅ Update complete.`);

        return summary;
    }

    async loadExistingMembers() {
        try {
            const file = await fs.readFile(this.JSON_FILE, "utf-8");
            return JSON.parse(file);
        } catch {
            return [];
        }
    }

    async saveMembers(data) {
        await fs.writeFile(this.JSON_FILE, JSON.stringify(data, null, 2));
        console.log("✅ Saved updated guild_members.json");
    }

    async getGuildMemberUUIDs(guildName) {
        await this.rateLimiter.waitIfNeeded();

        const url = `https://api.hypixel.net/guild?key=${this.API_KEY}&name=${encodeURIComponent(guildName)}`;
        const res = await axios.get(url);

        if(!res.data.success) {
            throw new Error(`Failed to fetch guild ${guildName}: ${res.data.cause}`);
        }

        console.log(`📥 Found ${res.data.guild.members.length} members in ${guildName}`);
        return res.data.guild.members.map(m => m.uuid);
    }

    async getPlayerInfo(uuid) {
        await this.rateLimiter.waitIfNeeded();

        const url = `https://api.hypixel.net/player?key=${this.API_KEY}&uuid=${uuid}`;
        const res = await axios.get(url);

        if(!res.data.success || !res.data.player) {
            return null;
        }

        const player = res.data.player;
        return {
            minecraft_name: player.displayname || uuid,
            minecraft_uuid: uuid,
            discord_name: player?.socialMedia?.links?.DISCORD || "Not linked"
        };
    }
}

// Rate limiter class
class RateLimiter {
    constructor(maxRequests, windowMs) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = [];
    }

    async waitIfNeeded() {
        const now = Date.now();

        // Remove requests older than the window
        this.requests = this.requests.filter(time => now - time < this.windowMs);

        // If we're at the limit, wait until the oldest request expires
        if(this.requests.length >= this.maxRequests - 10) { // SAFETY_BUFFER = 10
            const oldestRequest = this.requests[0];
            const waitTime = this.windowMs - (now - oldestRequest) + 1000; // Add 1 second buffer

            if(waitTime > 0) {
                console.log(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
                await this.sleep(waitTime);
            }
        }

        // Record this request
        this.requests.push(now);
    }

    getRequestsRemaining() {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.windowMs);
        return Math.max(0, this.maxRequests - 10 - this.requests.length); // SAFETY_BUFFER = 10
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = GuildMemberUpdater;