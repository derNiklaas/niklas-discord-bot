import {Client, GuildMember, Message, MessageEmbed, MessageReaction, PartialUser, TextChannel, User} from "discord.js";
import fetch from "node-fetch";

const client: Client = new Client({partials: ['CHANNEL', 'MESSAGE', 'REACTION']});
const reactableEmotes = ["rainbowsheepgif"];
const TWITCH_ROLE_ID: string = "622830603342970901"; // "Twitch" Role
const ROLES_CHANNEL_ID: string = "686356862324834305"; // Roles Channel
const LIVE_CHANNEL_ID: string = "497003072288194580"; // Live Channel
//const LIVE_CHANNEL_ID: string = "738740086438625280"; // Test Channel

let lastLiveNotification: Message;
let width = 550;
require('dotenv').config();

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    checkTwitchStatus().then();
    setInterval(checkTwitchStatus, 60000);
});

client.on('messageReactionAdd', (reaction: MessageReaction, user: User | PartialUser) => {
    if (!reactableEmotes.includes(reaction.emoji.name)) {
        return;
    }
    if (reaction.message.channel.id !== ROLES_CHANNEL_ID) {
        return;
    }
    const member: GuildMember = reaction.message.guild.member(user.id);

    if (!member.roles.cache.has(TWITCH_ROLE_ID)) {
        member.roles.add(TWITCH_ROLE_ID).then();
    }
});

client.on('messageReactionRemove', (reaction: MessageReaction, user: User | PartialUser) => {
    if (!reactableEmotes.includes(reaction.emoji.name)) {
        return;
    }
    if (reaction.message.channel.id !== ROLES_CHANNEL_ID) {
        return;
    }
    const member: GuildMember = reaction.message.guild.member(user.id);

    if (member.roles.cache.has(TWITCH_ROLE_ID)) {
        member.roles.remove(TWITCH_ROLE_ID).then();
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
                const test = client.channels.cache.get(LIVE_CHANNEL_ID) as TextChannel;
                const game = await getGameFromID(json.game_id);
                const viewer = json.viewer_count;
                const thumbnail = json.thumbnail_url.replace("{width}", width).replace("{height}", Math.round(width / 16 * 9));
                width++;
                if (lastLiveNotification) {
                    lastLiveNotification.edit(`<@&${TWITCH_ROLE_ID}>: Niklas ist jetzt live`, buildEmbed(json.title, game, viewer, thumbnail)).then();
                } else {
                    lastLiveNotification = await test.send(`<@&${TWITCH_ROLE_ID}>: Niklas ist jetzt live`, buildEmbed(json.title, game, viewer, thumbnail));
                }
            } else {
                if (lastLiveNotification) {
                    lastLiveNotification.delete().then();
                    lastLiveNotification = undefined;
                }
            }
        });
    } else {
        console.log("Error");
    }
}

function buildEmbed(title: string, game: string, viewer: string, thumbnail: string): MessageEmbed {
    const embed: MessageEmbed = new MessageEmbed();
    embed.setColor("#9400D3");
    embed.setAuthor("derNiklaas", "https://cdn.discordapp.com/avatars/153113441429749760/a_5d47b975cfdd39ca9f82be920008958d.webp", "https://www.twitch.tv/derNiklaas");
    embed.setTitle(title);
    embed.setURL("https://www.twitch.tv/derNiklaas");
    embed.addField("Kategorie", game, true);
    embed.addField("Zuschauer", viewer, true);
    embed.setImage(thumbnail);

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
        console.log(json);
        if (json.data.length === 0) {
            return "Unbekannt";
        } else {
            return json.data[0].name;
        }
    } else {
        console.log("Error");
        return "Fehler";
    }
}

client.login(process.env.DISCORD_TOKEN).then();