import {Client, GuildMember, Message, MessageEmbed, MessageReaction, PartialUser, TextChannel, User} from "discord.js";
import fetch from "node-fetch";

const client = new Client({partials: ["CHANNEL", "MESSAGE", "REACTION", "GUILD_MEMBER", "USER"]});

/** Whether the bot should output debug messages. */
const DEBUG = false

/** The name of the twitch channel. */
const TWITCH_CHANNEL = "derniklaas"
/** The id for the twitch role. */
const TWITCH_ROLE_ID = "622830603342970901";
/** The id of the poll roll. */
const POLL_ROLE_ID = "775304475756724244";
/** The id of the roles channel. */
const ROLES_CHANNEL_ID = "686356862324834305";
/** The id of the live channel. */
const LIVE_CHANNEL_ID = "497003072288194580";
/** The id of the debug live channel. */
const DEBUG_LIVE_CHANNEL_ID = "738740086438625280";

const REACTABLE_EMOTES = new Map();
REACTABLE_EMOTES.set("rainbowsheepgif", TWITCH_ROLE_ID);
REACTABLE_EMOTES.set("umfragen", POLL_ROLE_ID);

let discordLiveChat: TextChannel;

let reconnectTries = 3;
let streamCache = {
    title: "",
    game: "",
    viewers: -1,
    thumbnail: ""
}

let lastLiveNotification: Message;
let width = 550;
require('dotenv').config();

// Start checking for streams when the discord bot is ready.
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    discordLiveChat = client.channels.cache.get(DEBUG ? DEBUG_LIVE_CHANNEL_ID : LIVE_CHANNEL_ID) as TextChannel
    checkTwitchStatus().then();
    setInterval(checkTwitchStatus, 60 * 1000);
});

client.on('messageReactionAdd', async (reaction: MessageReaction, user: User | PartialUser) => {
    // Check if the reaction is in the correct channel
    if (reaction.message.channel.id !== ROLES_CHANNEL_ID) return;

    // Check if there is a role for that emoji
    if (!REACTABLE_EMOTES.has(reaction.emoji.name)) return;

    let member: GuildMember = await reaction.message.guild.members.fetch(user.id);
    const roleID = REACTABLE_EMOTES.get(reaction.emoji.name);

    await member.roles.add(roleID);

    if (DEBUG) {
        console.log(`[Info] Added role to ${user.username}`);
    }
});

client.on('messageReactionRemove', async (reaction: MessageReaction, user: User | PartialUser) => {
    // Check if the reaction is in the correct channel
    if (reaction.message.channel.id !== ROLES_CHANNEL_ID) return;

    // Check if there is a role for that emoji
    if (!REACTABLE_EMOTES.has(reaction.emoji.name)) return;

    const member: GuildMember = await reaction.message.guild.members.fetch(user.id);
    const roleID = REACTABLE_EMOTES.get(reaction.emoji.name);

    await member.roles.remove(roleID);

    if (DEBUG) {
        console.log(`[Info] Removed role from ${user.username} if they had one.`);
    }
});

async function checkTwitchStatus() {
    const response = await fetch(`https://api.twitch.tv/helix/streams?user_login=${TWITCH_CHANNEL}`, {
        headers: {
            "Client-ID": process.env.TWITCH_CLIENT_ID,
            "Authorization": `Bearer ${process.env.TWITCH_TOKEN}`
        }
    });
    // Check if there has been an error.
    if (!response.ok) {
        console.error("There has been an error while checking the online status:");
        console.error(response.statusText);
        return;
    }

    let json = await response.json();

    json = json.data[0];
    if (json && json.type === "live") {
        reconnectTries = 3;

        streamCache.title = json.title;
        streamCache.game = await getGameFromID(json.game_id);
        streamCache.viewers = json.viewer_count;
        streamCache.thumbnail = json.thumbnail_url.replace("{width}", width).replace("{height}", Math.round(width / 16 * 9));
        width++;

        await updateMessage();

    } else {
        if (lastLiveNotification === undefined) return

        if (reconnectTries === 0) {
            await lastLiveNotification.delete();
            lastLiveNotification = undefined;
        } else {
            reconnectTries--;
            await updateMessage();
        }
    }
}

/** Updates the message in the live chat. */
async function updateMessage() {
    if (lastLiveNotification !== undefined) {
        await lastLiveNotification.edit(`<@&${TWITCH_ROLE_ID}>: Niklas ist jetzt live`, buildEmbed(streamCache));
    } else {
        lastLiveNotification = await discordLiveChat.send(`<@&${TWITCH_ROLE_ID}>: Niklas ist jetzt live`, buildEmbed(streamCache));
    }
}

/** Generates an embed with given twitch stream information. */
function buildEmbed(streamInfo: any): MessageEmbed {
    const embed = new MessageEmbed();
    embed.setColor("#9400D3");
    embed.setAuthor("derNiklaas", "https://cdn.discordapp.com/avatars/153113441429749760/a_5d47b975cfdd39ca9f82be920008958d.webp", "https://www.twitch.tv/derNiklaas");
    embed.setTitle(streamInfo.title);
    embed.setURL(`https://www.twitch.tv/${TWITCH_CHANNEL}`);
    embed.addField("Kategorie", streamInfo.game, true);
    embed.addField("Zuschauer", streamInfo.viewers, true);
    embed.setImage(streamInfo.thumbnail);

    const date = new Date(Date.now());

    let tries = "";
    if (reconnectTries !== 3) {
        tries = `Offline? Noch ${reconnectTries} Versuche.`;
    }

    const hours = date.getHours() < 10 ? "0" + date.getHours() : date.getHours();
    const minutes = date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes();
    const seconds = date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds();

    embed.setFooter(`Letztes Update: ${hours}:${minutes}:${seconds} ${tries}`);

    return embed;
}

async function getGameFromID(id: string): Promise<string> {
    const response = await fetch(`https://api.twitch.tv/helix/games?id=${id}`, {
        headers: {
            "Client-ID": process.env.TWITCH_CLIENT_ID,
            "Authorization": `Bearer ${process.env.TWITCH_TOKEN}`
        }
    });

    if (response.ok) {
        const json = await response.json();
        if (json.data.length === 0) {
            return "Unbekannt";
        } else {
            return json.data[0].name;
        }
    } else {
        console.error("Error - Invalid OAuth Token?");
        console.error(response.statusText);
        return "Fehler";
    }
}

client.login(process.env.DISCORD_TOKEN).then();