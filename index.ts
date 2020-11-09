import { Client, GuildMember, Message, MessageEmbed, MessageReaction, TextChannel, User } from "discord.js";
import fetch from "node-fetch";
import { offline, online } from './texte.json';
const client = new Client({ partials: ["CHANNEL", "MESSAGE", "REACTION", "GUILD_MEMBER", "USER"] });

const TWITCH_ROLE_ID = "622830603342970901"; // "Twitch" Role
const UMFRAGEN_ROLE_ID = "775304475756724244"; // "Umfragen" Role
const ROLES_CHANNEL_ID = "686356862324834305"; // Roles Channel
const LIVE_CHANNEL_ID = "497003072288194580"; // Live Channel
const SHOULD_CLOSE_CHANNEL_AFTER_ENDING = process.env.LOCK_CHANNEL === "true";
const MESSAGE_ID = "775314333211033651";
const ratelimit = new Map<string, GuildMember>();
let onlineText: string;
let offlineText: string;
//const LIVE_CHANNEL_ID: string = "738740086438625280"; // Test Channel

const reactableEmotes = new Map<string, string>([
    ["rainbowsheepgif", TWITCH_ROLE_ID],
    ["umfragen", UMFRAGEN_ROLE_ID]
]);
interface TwitchStreamReturnData {
    type: 'live' | ''; // empty string if there is a error
    game_id: string;
    title: string;
    viewer_count: number;
    thumbnail_url: string;
    started_at: string;
}

interface TwitchStreamReturn {
    data: TwitchStreamReturnData[];
}
interface StreamInfo {
    title: string;
    game: string;
    viewers: number;
    gameID: string | null;
    thumbnail: string;
}
let reconnectTries = 3;
let streamCache: StreamInfo = {
    title: "",
    game: "",
    viewers: -1,
    thumbnail: "",
    gameID: null
}

let lastLiveNotification: Message;
let width = 550;

client.on("ready", async () => {
    try {
        console.log(`Logged in as ${client.user.tag}`);

        await checkIfUserReactedWhenBotOffline();

        await checkTwitchStatus();

        setInterval(checkTwitchStatus, 60000);
        changeText();
    } catch (error) {
        console.log(`error on init ${error.name}: ${error.message}\n${error.stack ? error.stack : ''}`)

    }
});

client.on("messageReactionAdd", async (reaction, user) => {
    if (!correctChannel(reaction) || userRatelimited(user.id)) return;
    const member = await reaction.message.guild.members.fetch(user.id);
    if (!member) {
        console.log("[DEBUG] reaction add from a unknown member");
        return;
    }
    const roleID = reactableEmotes.get(reaction.emoji.name);

    if (!member.roles.cache.has(roleID)) {
        member.roles.add(roleID).then();
    }
});

client.on("messageReactionRemove", async (reaction, user) => {
    if (!correctChannel(reaction) || userRatelimited(user.id)) return;
    const member = await reaction.message.guild.members.fetch(user.id);
    if (!member) {
        console.log("[DEBUG] reaction add from a unknown member");
        return;
    }
    const roleID = reactableEmotes.get(reaction.emoji.name);

    if (member.roles.cache.has(roleID)) {
        member.roles.remove(roleID).then();
    }
    ratelimit.set(user.id, member);
});


function correctChannel(reaction: MessageReaction) {
    if (!reactableEmotes.has(reaction.emoji.name)) {
        return false;
    }
    if (reaction.message.channel.id !== ROLES_CHANNEL_ID) {
        return false;
    }
    return true;
}

function userRatelimited(userID: string) {
    if (ratelimit.has(userID)) return true;
    return false;
}

function changeText() {
    onlineText = online[Math.floor(Math.random() * online.length)];
    offlineText = offline[Math.floor(Math.random() * offline.length)]
}

async function checkIfUserReactedWhenBotOffline() {
    const channel = client.channels.cache.get(ROLES_CHANNEL_ID) as TextChannel;
    if (channel?.type !== 'text') {
        console.log("i found a channel but it's not one for texts.");
    } else {
        const msg = await channel.messages.fetch(MESSAGE_ID);

        const members = await (await channel.guild.members.fetch()).array();
        await Promise.all(msg.reactions.cache.filter(reaction => reactableEmotes.has(reaction.emoji.name)));


        const twitch = msg.reactions.cache.find(reaction => reaction.emoji.name === "rainbowsheepgif");
        const umfragen = msg.reactions.cache.find(reaction => reaction.emoji.name === "umfragen");

        if (twitch) {
            await addRoles('twitch', twitch.users.cache.array(), members, twitch);
            await removeRoles('twitch', members, twitch.users.cache.array(), twitch);

        }
        if (umfragen) {
            await removeRoles('umfragen', members, umfragen.users.cache.array(), umfragen);
            await addRoles('umfragen', umfragen.users.cache.array(), members, umfragen);
        }



    }
}

async function addRoles(reactions: 'twitch' | 'umfragen', users: User[], members: GuildMember[], reaction: MessageReaction) {

    switch (reactions) {
        case 'twitch':
            for (const user of users) {
                const member = members.find(mem => mem.id === user.id);
                if (member) {
                    if (member.roles.cache.has(TWITCH_ROLE_ID)) {
                        continue;
                    }
                    else {
                        await member.roles.add(TWITCH_ROLE_ID);
                        console.log("[INFO] added \"twitch\" role to a user ");

                    }
                } else {
                    console.log("someone has reacted but is not anymore on this server");
                    await reaction.users.remove(user);
                }
            }
            break;

        case 'umfragen':
            for (const user of users) {
                const member = members.find(mem => mem.id === user.id);
                if (member) {
                    if (member.roles.cache.has(UMFRAGEN_ROLE_ID)) {
                        continue;
                    }
                    else {
                        await member.roles.add(UMFRAGEN_ROLE_ID);
                        console.log("[INFO] added \"Umfragen\" role to a user ");

                    }
                } else {
                    console.log("someone has reacted but is not anymore on this server.");
                }
            }
            break;
        default:
            break;
    }
}

async function removeRoles(reactions: 'twitch' | 'umfragen', members: GuildMember[], users: User[], reaction: MessageReaction) {
    switch (reactions) {
        case 'twitch':
            for (const user of users) {
                const member = members.find(mem => mem.id === user.id);
                if (member) {
                    if (!member.roles.cache.has(TWITCH_ROLE_ID)) {
                        continue;
                    }
                    else {
                        await member.roles.remove(TWITCH_ROLE_ID);
                        console.log("[INFO] removed \"twitch\" role from a user ");

                    }
                } else {
                    console.log("someone has reacted but is not anymore on this server.");
                }
            }
            break;

        case 'umfragen':
            for (const user of users) {
                const member = members.find(mem => mem.id === user.id);
                if (member) {
                    if (!member.roles.cache.has(UMFRAGEN_ROLE_ID)) {
                        continue;
                    }
                    else {
                        await member.roles.remove(UMFRAGEN_ROLE_ID);
                        console.log("[INFO] removed \"Umfragen\" role from a user ");

                    }
                } else {
                    console.log("someone has reacted but is not anymore on this server.");
                }
            }
            break;
        default:
            break;
    }
}

async function checkTwitchStatus() {

    const response = await fetch("https://api.twitch.tv/helix/streams?user_login=derniklaas", {
        headers: {
            "Client-ID": process.env.TWITCH_CLIENT_ID,
            "Authorization": `Bearer ${process.env.TWITCH_TOKEN}`
        }
    });
    const discordLiveChat = client.channels.cache.get(LIVE_CHANNEL_ID) as TextChannel;
    if (response.ok) {
        const data: TwitchStreamReturn = await response.json();
        if (data.data?.length) {
            const json = data.data[0];

            if (json.type === '' && !lastLiveNotification) {
                console.log("twitch error...");
                return;
            }
            if (json.viewer_count !== streamCache.viewers) streamCache.viewers = json.viewer_count;
            if (streamCache.gameID !== json.game_id) {
                streamCache.game = await getGameByID(json.game_id);
                streamCache.gameID = json.game_id;
            }
            streamCache.title = `[${json.title}](https://twitch.tv/derNiklaas)`;
            streamCache.thumbnail = json.thumbnail_url.replace("{width}", width.toString()).replace("{height}", Math.round(width / 16 * 9).toString());
            width++;
            const text = onlineText
                .replace(/{{MENTION}}/g, `<@&${TWITCH_ROLE_ID}`)
                .replace(/{{GAME}}/g, streamCache.game)
                .replace(/{{TYPE}}/g, streamCache.game.includes('scien') ? 'programieren' : 'spielen')
                .replace(/{{TITLE}}/g, json.title)
                .replace(/{{VIEWERCOUNT}}/g, streamCache.viewers.toString());
            if (lastLiveNotification) {
                lastLiveNotification.edit(text, buildEmbed(streamCache)).then();
            } else {
                lastLiveNotification = await discordLiveChat.send(text, buildEmbed(streamCache));
            }

        } else {
            if (lastLiveNotification) {
                if (reconnectTries === 0) {
                    if (SHOULD_CLOSE_CHANNEL_AFTER_ENDING) {
                        const text = offlineText
                            .replace(/{{MENTION}}/g, `<@&${TWITCH_ROLE_ID}`)
                            .replace(/{{GAME}}/g, streamCache.game)
                            //don't know what the id of sience and technology is so....
                            .replace(/{{TYPE}}/g, streamCache.game.includes('scien') ? 'programieren' : 'spielen')
                            .replace(/{{TITLE}}/g, streamCache.title.slice(1, "](https://twitch.tv/derNiklaas)".length))
                            .replace(/{{VIEWERCOUNT}}/g, streamCache.viewers.toString());
                        lastLiveNotification.edit(text, { embed: null });
                        await discordLiveChat.overwritePermissions([
                            {
                                id: discordLiveChat.guild.id,
                                deny: ['SEND_MESSAGES']
                            }
                        ]);
                        changeText();
                        return;
                    } else {
                        lastLiveNotification.delete().then();
                        lastLiveNotification = undefined;
                        changeText();
                        return;
                    }
                } else {
                    reconnectTries--;
                    lastLiveNotification.edit(`<@&${TWITCH_ROLE_ID}>: Niklas ist jetzt live`, buildEmbed(streamCache)).then();
                    changeText()
                }
            }
        }
    } else {
        console.log(`irgendwas ist ist broken... ${response.status}: ${response.statusText} `);
    }
}

function buildEmbed(streamInfo: StreamInfo): MessageEmbed {
    const embed = new MessageEmbed();
    embed.setColor("#9400D3");
    embed.setAuthor("@derNiklaas",
        "https://cdn.discordapp.com/avatars/153113441429749760/a_5d47b975cfdd39ca9f82be920008958d.gif",
        "https://www.twitch.tv/derNiklaas");

    embed.setTitle(streamInfo.title);
    embed.setURL("https://www.twitch.tv/derNiklaas");
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

async function getGameByID(id: string): Promise<string> {
    if (!id) return "Unbekanntest Spiel";
    const response = await fetch(`https://api.twitch.tv/helix/games?id=${id}`, {
        headers: {
            "Client-ID": process.env.TWITCH_CLIENT_ID,
            "Authorization": "Bearer " + process.env.TWITCH_TOKEN
        }
    });
    if (response.ok) {
        const json = await response.json() as { data: any[]; };
        if (!json.data.length) {
            return "Unbekanntes Spiel";
        } else {
            return json.data[0].name === "" ? "Unbekanntes Spiel" : json.data[0].name;
        }
    } else {
        console.log("Error - Invalid OAuth Token?");
        console.log(response.statusText);
        return "Unbekanntes spiel";
    }
}

client.login().then();