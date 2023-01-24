"use strict";
let util = require("../../util.js");
let database = require(util.DATABASE);

let settings;

const FILTER_ACTION = {
    NOTHING: 0,
    DELETE: 1,
    MUTE: 2,
    KICK: 3,
    BAN: 4
};

const CMD_ACTIONS = {
    "delete": FILTER_ACTION.DELETE,
    "mute": FILTER_ACTION.MUTE,
    "kick": FILTER_ACTION.KICK,
    "ban": FILTER_ACTION.BAN
};

function load(mb, cb) {
    loadSettings((err) => {
        if (err) {
            return cb(err);
        }
        mb.on("message", chatHandler);
        cb();
    });
}

function unload(mb, cb) {
    mb.removeListener("message", chatHandler);
    cb();
}

function chatHandler(msg) {
    if (msg.author.equals(msg.client.user)) {
        return;
    }
    if (msg.channel.type !== "text") {
        return;
    }
    if (!msg.member) {
        return;
    }
    if (msg.member.hasPermission("ADMINISTRATOR")) {
        return;
    }
    if (!settings.has(msg.guild.id)) {
        return;
    }
    let sett = settings.get(msg.guild.id);
    if (!sett.enabled) {
        return;
    }
    if (sett.exemptChannels.indexOf(msg.channel.id) > -1) {
        return;
    }
    let msgSplit = msg.cleanContent.toLowerCase().split(" ");
    let actionToTake = FILTER_ACTION.NOTHING;
    for (let segment of msgSplit) {
        if (sett.whitelist.indexOf(segment) > -1) {
            continue;
        }
        for (let banword in sett.filter) {
            if (segment.indexOf(banword) > -1) {
                let action = sett.filter[banword];
                actionToTake = Math.max(action, actionToTake);
                if (actionToTake == FILTER_ACTION.BAN) {
                    takeAction(msg, sett, actionToTake);
                    return;
                }
            }
        }
    }
    takeAction(msg, sett, actionToTake);
}

function takeAction(msg, sett, action) {
    switch (action) {
        case FILTER_ACTION.NOTHING:
            return;
        case FILTER_ACTION.DELETE:
            msg.delete();
            if (sett.deleteMessage) {
                msg.channel.send(sett.deleteMessage);
            }
            return;
        case FILTER_ACTION.MUTE:
            msg.delete();
            if (sett.timeoutRole) {
                msg.member.addRole(sett.timeoutRole);
            }
            if (sett.muteMessage) {
                msg.channel.send(sett.muteMessage);
            }
            return;
        case FILTER_ACTION.KICK:
            msg.delete();
            msg.member.kick();
            if (sett.kickMessage) {
                msg.channel.send(sett.kickMessage);
            }
            return;
        case FILTER_ACTION.BAN:
            msg.delete();
            msg.member.ban();
            if (sett.banMessage) {
                msg.channel.send(sett.banMessage);
            }
            return;
    }
}

function loadSettings(cb) {
    settings = new Map();
    database.loadAll("discordfilter", (err, docs) => {
        if (err) {
            return cb(err);
        }
        for (let doc of docs) {
            settings.set(doc._id, new Settings(doc.data));
        }
        cb();
    });
}

function saveSetting(server, data, cb) {
    database.saveData("discordfilter", server, data, cb);
}

let commands = {
    togglediscordfilter: {
        names: ["togglediscordfilter"],
        allowPrivate: false,
        perms: util.MOD,
        code(msg) {
            let sett;
            if (!settings.has(msg.guild.id)) {
                sett = new Settings();
                settings.set(msg.guild.id, sett);
            } else {
                sett = settings.get(msg.guild.id);
            }
            sett.enabled = !sett.enabled;
            saveSetting(msg.guild.id, sett, () => {
                msg.reply(`Word filter ${sett.enabled ? "activated" : "deactivated"}.`);
            });
        }
    },
    blacklistword: {
        names: ["blacklistword", "addblacklistword"],
        allowPrivate: false,
        perms: util.MOD,
        code(msg, args) {
            let sett;
            if (!settings.has(msg.guild.id)) {
                sett = new Settings();
                settings.set(msg.guild.id, sett);
            } else {
                sett = settings.get(msg.guild.id);
            }
            if (args.length !== 2) {
                msg.reply("Please indicate a word to add to the blacklist in the form of !blacklistword [word] [nothing/delete/mute/kick/ban].");
                return;
            }
            let word = args[0].toLowerCase();
            let action = args[1].toLowerCase();
            if (action == "nothing" && word in sett.filter) {
                delete sett.filter[word];
                saveSetting(msg.guild.id, sett, () => {
                    msg.reply("Removed that word from the words blacklist.");
                });
            } else if (action in CMD_ACTIONS) {
                sett.filter[word] = CMD_ACTIONS[action];
                saveSetting(msg.guild.id, sett, () => {
                    msg.reply("Added that word to the words blacklist.");
                });
            } else {
                msg.reply("Please indicate a word to add to the blacklist in the form of !blacklistword [word] [nothing/delete/mute/kick/ban].");
            }
        }
    },
    settimeoutrole: {
        names: ["settimeoutrole"],
        allowPrivate: false,
        perms: util.MOD,
        code(msg) {
            let sett;
            if (!settings.has(msg.guild.id)) {
                sett = new Settings();
                settings.set(msg.guild.id, sett);
            } else {
                sett = settings.get(msg.guild.id);
            }
            if (msg.mentions.roles.size == 0) {
                msg.reply("Please indicate a role to add as the timeout role.");
                return;
            }
            sett.timeoutRole = msg.mentions.roles.firstKey();
            saveSetting(msg.guild.id, sett, () => {
                msg.reply("Ok, I added that role as the timeout role.");
            });
        }
    }
};

function Settings(prev = {}) {
    this.enabled = prev.enabled || false;
    this.filter = prev.filter || {};
    this.whitelist = prev.whitelist || [];
    this.timeoutRole = prev.timeoutRole || null;
    this.exemptChannels = prev.exemptChannels || [];
    this.deleteMessage = prev.deleteMessage || null;
    this.muteMessage = prev.muteMessage || null;
    this.kickMessage = prev.kickMessage || null;
    this.banMessage = prev.banMessage || null;
}


function help() {
    return util.dedent`__Thoughts Plugin__
        Plugin that makes mushbot say random things from the chat history at random times.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "thoughts",
    help,
    load,
    unload,
    commands
};
