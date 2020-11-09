import {Client, GuildMember, Message, MessageEmbed, MessageReaction, PartialUser, TextChannel, User} from "discord.js";
import fetch from "node-fetch";

const client: Client = new Client({partials: ["CHANNEL", "MESSAGE", "REACTION", "GUILD_MEMBER", "USER"]});

const TWITCH_ROLE_ID: string = "622830603342970901"; // "Twitch" Role
const ROLES_CHANNEL_ID: string = "686356862324834305"; // Roles Channel
const LIVE_CHANNEL_ID: string = "497003072288194580"; // Live Channel
//const LIVE_CHANNEL_ID: string = "738740086438625280"; // Test Channel

const reactableEmotes = new Map();
reactableEmotes.set("rainbowsheepgif", TWITCH_ROLE_ID); // Twitch Role
reactableEmotes.set("umfragen", "775304475756724244"); // Umfragen Role

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

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    checkTwitchStatus().then();
    setInterval(checkTwitchStatus, 60000);
    console.log("test");
});

client.on('messageReactionAdd', async (reaction: MessageReaction, user: User | PartialUser) => {
    if (!reactableEmotes.has(reaction.emoji.name)) {
        return;
    }
    if (reaction.message.channel.id !== ROLES_CHANNEL_ID) {
        return;
    }
    const member: GuildMember = await reaction.message.guild.members.fetch(user.id);
    const roleID = reactableEmotes.get(reaction.emoji.name);

    if (!member.roles.cache.has(roleID)) {
        member.roles.add(roleID).then();
        console.log(`[Info] Added role to ${user.username}`);
    }
});

client.on('messageReactionRemove', async (reaction: MessageReaction, user: User | PartialUser) => {
    if (!reactableEmotes.has(reaction.emoji.name)) {
        return;
    }
    if (reaction.message.channel.id !== ROLES_CHANNEL_ID) {
        return;
    }
    const member: GuildMember = await reaction.message.guild.members.fetch(user.id);
    const roleID = reactableEmotes.get(reaction.emoji.name);

    if (member.roles.cache.has(roleID)) {
        member.roles.remove(roleID).then();
        console.log(`[Info] Removed role from ${user.username}`);
    }
});


async function checkTwitchStatus() {
    const response = await fetch("https://api.twitch.tv/helix/streams?user_login=derniklaas", {
        headers: {
            "Client-ID": process.env.TWITCH_CLIENT_ID,
            "Authorization": "Bearer " + process.env.TWITCH_TOKEN
        }
    });
    if (response.ok) {
        response.json().then(async json => {
            json = json.data[0];
            if (json && json.type === "live") {
                reconnectTries = 3;
                const discordLiveChat = client.channels.cache.get(LIVE_CHANNEL_ID) as TextChannel;

                streamCache.title = json.title;
                streamCache.game = await getGameFromID(json.game_id);
                streamCache.viewers = json.viewer_count;
                streamCache.thumbnail = json.thumbnail_url.replace("{width}", width).replace("{height}", Math.round(width / 16 * 9));
                width++;

                if (lastLiveNotification) {
                    lastLiveNotification.edit(`<@&${TWITCH_ROLE_ID}>: Niklas ist jetzt live`, buildEmbed(streamCache)).then();
                } else {
                    lastLiveNotification = await discordLiveChat.send(`<@&${TWITCH_ROLE_ID}>: Niklas ist jetzt live`, buildEmbed(streamCache));
                }

            } else {
                if (lastLiveNotification) {
                    if (reconnectTries === 0) {
                        lastLiveNotification.delete().then();
                        lastLiveNotification = undefined;
                    } else {
                        reconnectTries--;
                        lastLiveNotification.edit(`<@&${TWITCH_ROLE_ID}>: Niklas ist jetzt live`, buildEmbed(streamCache)).then();
                    }
                }
            }
        });
    } else {
        console.log("Error - Invalid OAuth Token?");
        console.log(response.statusText);
    }
}

function buildEmbed(streamInfo: object): MessageEmbed {
    const embed: MessageEmbed = new MessageEmbed();
    embed.setColor("#9400D3");
    embed.setAuthor("derNiklaas", "https://cdn.discordapp.com/avatars/153113441429749760/a_5d47b975cfdd39ca9f82be920008958d.webp", "https://www.twitch.tv/derNiklaas");
    // @ts-ignore
    embed.setTitle(streamInfo.title);
    embed.setURL("https://www.twitch.tv/derNiklaas");
    // @ts-ignore
    embed.addField("Kategorie", streamInfo.game, true);
    // @ts-ignore
    embed.addField("Zuschauer", streamInfo.viewers, true);
    // @ts-ignore
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
            "Authorization": "Bearer " + process.env.TWITCH_TOKEN
        }
    });
    if (response.ok) {
        const json = await response.json();
        //console.log(json);
        if (json.data.length === 0) {
            return "Unbekannt";
        } else {
            return json.data[0].name;
        }
    } else {
        console.log("Error - Invalid OAuth Token?");
        console.log(response.statusText);
        return "Fehler";
    }
}

client.login(process.env.DISCORD_TOKEN).then();