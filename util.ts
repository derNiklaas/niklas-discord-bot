

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


async function checkIfUserReactedWhenBotOffline() {
    const channel = client.channels.cache.get(ROLES_CHANNEL_ID) as TextChannel;
    if (channel.type !== 'text') {
        console.log(`Ich hab einen channel gefunden mit der id "${ROLES_CHANNEL_ID}" aber das ist kein TextChannel!`);
    } else {
        const messages = await channel.messages.fetch();
        let arr: MessageReaction[];
        for (const msg of messages.array()) arr.push(...msg.reactions.cache.values());

        const reactions = await Promise.all(arr.map(reaction => reaction.fetch())).then(reactions => reactions.filter(reaction => reactableEmotes.has(reaction.emoji.id)));
        const members = (await channel.guild.members.fetch()).array();

        const twitch = reactions.find(react => react.emoji.id === TWITCH_ROLE_ID);
        const umfragen = reactions.find(react => react.emoji.id === UMFRAGEN_ROLE_ID);
        if (twitch) await addRoles('twitch', twitch.users.cache.array(), members, twitch);
        if (umfragen) await addRoles('umfragen', umfragen.users.cache.array(), members, umfragen);

        if (twitch) await removeRoles('twitch', members, twitch.users.cache.array(), twitch);
        if (umfragen) await removeRoles('umfragen', members, twitch.users.cache.array(), umfragen);

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
                    }
                } else {
                    console.log("jemand gefunden der nicht mehr auf dem server ist...");
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
                    }
                } else {
                    console.log("jemand gefunden der nicht mehr auf dem server ist...");
                    await reaction.users.remove(user);
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
                    }
                } else {
                    console.log("jemand gefunden der nicht mehr auf dem server ist...");
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
                    }
                } else {
                    console.log("jemand gefunden der nicht mehr auf dem server ist...");
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
            "Authorization": "Bearer " + process.env.TWITCH_TOKEN
        }
    });
    if (response.ok) {
        const data: TwitchStreamReturn = await response.json();/*.then( => {
            json = json.data[0];
            if (json && json.type === "live") {
                reconnectTries = 3;
                const discordLiveChat = client.channels.cache.get(LIVE_CHANNEL_ID) as TextChannel;

                streamCache.title = json.title;
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
        });*/
        if (data.data?.length) {
            const json = data.data[0];

            if (json.type === '' && !lastLiveNotification) {
                console.log('du bist life aber anscheinend doch nicht....');
                return;
            }
            if (json.viewer_count !== streamCache.viewers) streamCache.viewers = json.viewer_count;
            if (streamCache.gameID !== json.game_id) streamCache.gameID = await getGameByID(json.game_id);
            json.title = ``
        }
    } else {
        console.log("Error - Invalid OAuth Token?");
        console.log(response.statusText);
    }
}

function buildEmbed(streamInfo: StreamInfo): MessageEmbed {
    const embed = new MessageEmbed();
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

async function getGameByID(id: string): Promise<string> {
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
