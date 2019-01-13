"use strict";
let util = require("../../util.js");
let twitch = require(util.TWITCH);
let database = require(util.DATABASE);

let settings;
let channels;
let tempCodes = new Map();
let mbot;

let createInvite = (server, cb) => {
    let sett = settings.get(server);
    let options = {
        maxAge: sett.time,
        maxUses: sett.uses,
        temporary: sett.temp,
        xkcd: sett.xkcd
    };
    mbot.channels.find("id", sett.inviteChannel).createInvite(options).then((code) => {
        cb(null, code);
    }).catch(cb);
};

function load(mb, cb) {
    mbot = mb;
    loadSettings((err) => {
        if (err) {
            return cb(err);
        }
        loadChannels();
        cb();
    });
}

function unload(mb, cb) {
    createInvite = null;
    mbot = null;
    cb();
}

function loadSettings(cb) {
    database.loadAll("twitchinvite", (err, docs) => {
        if (err) {
            return cb(err);
        }
        settings = new Map();
        for (let doc of docs) {
            settings.set(doc._id, doc.data);
        }
        cb();
    });
}

function loadChannels() {
    channels = new Map();
    for (let i of settings) {
        if (i[1].twitchChannel) {
            channels.set(i[1].twitchChannel, i[0]);
        }
    }
}

function saveSettings(server, data, cb) {
    database.saveData("twitchinvite", server, data, cb);
}

let commands = {
    setinvitechannel: {
        names: ["setinvitechannel", "settwitchchannel"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "(mods) Set the Discord channel to which the invitation link should send new users.",
        code(msg, args) {
            let channel;
            if (args.length) {
                channel = util.getChannel(args[0]);
                if (channel) {
                    if (!msg.guild.channels.exists("id", channel)) {
                        msg.reply(
                            "Uh oh! Looks like that channel is invalid. Check to make sure you spelled the name correctly and that the channel still exists."
                        );
                        return;
                    }
                } else {
                    if (msg.guild.channels.exists("name", args[0])) {
                        channel = msg.guild.channels.find("name", args[0]).id;
                    } else {
                        msg.reply(
                            "Uh oh! Looks like that channel is invalid. Check to make sure you spelled the name correctly and that the channel still exists."
                        );
                        return;
                    }
                }
            } else {
                channel = msg.guild.channels.first().id;
            }
            let code = Math.random().toString(36).substr(2, 4);
            tempCodes.set(code, {server: msg.guild.id, channel});
            msg.author.send(
                `Alright! All you need to do now is use the \`setinvitechannel ${code}\` command in the Twitch channel where you want to invite people. Don't worry, the code will expire once you use it, so it won't do anything.`
            );
        }
    }
};

let twitchCommands = {
    invite: {
        names: ["invite", "discordinvite", "invitediscord"],
        perms: ["mod"],
        desc: "(mods) Send an invite to a user on Twitch. The invite is sent by whispers.",
        code(channel, user, args) {
            if (!channels.has(channel)) {
                twitch.sendWhisper(user,
                    "This channel doesn't have a Discord group linked yet! Go on discord and use the setinvitechannel [name] command to set the channel I should invite people to."
                );
                return;
            }
            if (!args.length) {
                return;
            }
            let username = args[0].replace("@", "");
            createInvite(channels.get(channel), (err, invite) => {
                if (err) {
                    console.log(err);
                    twitch.reply(channel, user,
                        "Something went wrong with the invite! It didn't work!"
                    );
                    return;
                }
                twitch.sendWhisper(username,
                    `Here's your Discord invite link! https://discord.gg/${invite.code}`,
                    (err) => {
                        if (err) {
                            twitch.reply(channel, user,
                                "Something went wrong with the invite! It didn't work!"
                            );
                            return;
                        }
                        twitch.reply(channel, user,
                            "Okay! I sent them a Discord invite!"
                        );
                    }
                );
            });
        }
    },
    setinvitechannel: {
        names: ["setinvitechannel", "settwitchchannel"],
        perms: ["mod"],
        desc: "(mods) Related to the setinvitechannel discord command above. Use that one first.",
        code(channel, user, args, char) {
            if (!args.length) {
                return;
            }
            let code = args[0];
            if (!tempCodes.has(code)) {
                return;
            }
            let info = tempCodes.get(code);
            if (!settings.has(info.server)) {
                settings.set(info.server, new Settings());
            }
            let sett = settings.get(info.server);
            sett.inviteChannel = info.channel;
            sett.twitchChannel = channel;
            tempCodes.delete(code);
            saveSettings(info.server, sett, () => {
                channels.set(channel, info.server);
                twitch.reply(channel, user,
                    `Done! The ${char}invite command should work now! Enjoy!`
                );
            });
        }
    }
};

function Settings(prev = {}) {
    this.inviteChannel = prev.inviteChannel || "";
    this.twitchChannel = prev.twitchChannel || "";
    this.time = prev.time || 1800;
    this.uses = prev.uses || 3;
    this.temp = prev.temp || false;
    this.xkcd = prev.xkcd || false;
}

function help() {
    return util.dedent`__Twitch Invite Plugin__
        This plugin allows you to have Mushybot, the Twitch bot, send out invites to users with a command.
        Note that this plugin requires you to have Mushybot in your Twitch channel. (Contact fungus#9999 if interested maybe?)

        Commands:
        ${util.generateCommandsInfo(commands)}
        Twitch Commands:
        ${util.generateCommandsInfo(twitchCommands)}`;
}

module.exports = {
    name: "twitchinvite",
    help,
    load,
    unload,
    commands,
    twitchCommands
};
