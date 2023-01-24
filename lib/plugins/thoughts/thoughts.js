"use strict";
let util = require("../../util.js");
let database = require(util.DATABASE);

let settings;

const DEFAULT_ODDS = 0.005;

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
    if (!settings.has(msg.guild.id)) {
        return;
    }
    let sett = settings.get(msg.guild.id);
    if (sett.channels.indexOf(msg.channel.id) == -1) {
        return;
    }
    if (sett.enabled && sett.channels.indexOf(msg.channel.id) > -1) {
        let odds;
        if (msg.author.id in sett.userodds) {
            odds = Math.min(sett.userodds[msg.author.id], sett.odds * 2);
        } else {
            odds = sett.odds;
        }
        if (randomChance(odds)) {
            let mention = msg.author.id in sett.usermention ? sett.usermention[msg.author.id] : false;
            sendRandomMessage(msg, mention);
        }
    }
}

function randomChance(odds) {
    return Math.random() <= odds;
}

function generateSnowflake(msg) {
    let cid = parseInt(msg.channel.id);
    let mid = parseInt(msg.id);
    return (Math.floor(Math.random() * (mid - cid + 1)) + cid) + "";
}

function sendRandomMessage(msg, mention) {
    msg.channel.fetchMessages({
        limit: 10,
        around: generateSnowflake(msg)
    }).then((msgs) => {
        let fmsg = msgs.filter(m => !m.author.equals(msg.client.user) && ((m.cleanContent && m.cleanContent.length > 0) || (m.attachments.size))).random();
        if (!fmsg) {
            return;
        }
        let formattedMsg = "";
        if (!mention) {
            formattedMsg += `@${msg.member ? msg.member.displayName : msg.author.username}, `;
        }
        formattedMsg += fmsg.cleanContent;
        let options = {};
        if (fmsg.attachments.size) {
            options.files = [ fmsg.attachments.first().url ];
        }
        if (mention) {
            options.reply = msg.author;
        }
        msg.channel.send(formattedMsg, options);
    }).catch((err) => {
        console.log(err);
        msg.reply("thoughts error (tell fungus plz)");
    });
}

function loadSettings(cb) {
    settings = new Map();
    database.loadAll("thoughts", (err, docs) => {
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
    database.saveData("thoughts", server, data, cb);
}

let commands = {
    togglethoughts: {
        names: ["togglethoughts"],
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
                msg.reply(`I will ${sett.enabled ? "now" : "no longer"} randomly share my thoughts in this server.`);
            });
        }
    },
    serverthoughtsodds: {
        names: ["serverthoughtsodds"],
        allowPrivate: false,
        perms: util.MOD,
        code(msg, args, argsStr, cmdName, char) {
            let sett;
            if (!settings.has(msg.guild.id)) {
                sett = new Settings();
                settings.set(msg.guild.id, sett);
            } else {
                sett = settings.get(msg.guild.id);
            }
            if (!args.length) {
                msg.reply(`The current server thoughts odds are ${sett.odds * 100}%. To change the server odds, use \`${char}serverthoughtsodds (percentage)\`.`);
                return;
            }
            let odds = parseFloat(args[0].replace("%", ""));
            if (isNaN(odds)) {
                msg.reply(`Invalid percentage. Example: \`${char}serverthoughtsodds ${DEFAULT_ODDS*100}%\` (default)`);
                return;
            }
            if (odds <= 0) {
                msg.reply(`Please supply odds that are larger than 0%. Example: \`${char}serverthoughtsodds ${DEFAULT_ODDS*100}%\` (default). If you want to disable thoughts, do \`${char}togglethoughts\`.`);
                return;
            }
            sett.odds = odds / 100;
            saveSetting(msg.guild.id, sett, () => {
                msg.reply("Saved the odds at which I will share my thoughts!");
            });
        }
    },
    thoughtsodds: {
        names: ["thoughtsodds"],
        allowPrivate: false,
        perms: [],
        userCd: 10,
        code(msg, args, argsStr, cmdName, char) {
            let sett;
            if (!settings.has(msg.guild.id)) {
                return;
            } else {
                sett = settings.get(msg.guild.id);
            }
            if (!sett.enabled) {
                return;
            }
            if (!args.length) {
                let currentOdds;
                if (!(msg.author.id in sett.userodds)) {
                    currentOdds = sett.odds;
                } else {
                    currentOdds = sett.userodds[msg.author.id];
                }
                currentOdds = Math.min(currentOdds, sett.odds * 2);
                let oddsString = currentOdds * 100;
                oddsString = +oddsString.toFixed(2);
                msg.reply(`Your current personal thoughts odds are ${oddsString}%. To change your personal odds, use \`${char}thoughtsodds (percentage)\`.`);
                return;
            }
            let odds = parseFloat(args[0].replace("%", ""));
            if (isNaN(odds)) {
                msg.reply(`Invalid percentage. Example: \`${char}thoughtsodds ${DEFAULT_ODDS*100}%\` (default)`);
                return;
            }
            if (odds < 0) {
                msg.reply(`Please supply odds that are at least 0%. Example: \`${char}thoughtsodds ${DEFAULT_ODDS*100}%\` (default).`);
                return;
            }
            let oddsConverted = odds / 100;
            oddsConverted = Math.min(sett.odds * 2, oddsConverted);
            sett.userodds[msg.author.id] = oddsConverted;
            saveSetting(msg.guild.id, sett, () => {
                let oddsString = oddsConverted * 100;
                oddsString = +oddsString.toFixed(2);
                msg.reply(`Saved the odds at which I will share my thoughts for you! (${oddsString}%)`);
            });
            return "11";
        }
    },
    togglethoughtschannel: {
        names: ["togglethoughtschannel", "thoughtschannel"],
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
            if (sett.channels.indexOf(msg.channel.id) > -1) {
                sett.channels.splice(sett.channels.indexOf(msg.channel.id), 1);
                saveSetting(msg.guild.id, sett, () => {
                    msg.reply(`Removed ${msg.channel} from the list of channels in which I will randomly share my thoughts.`);
                });
                return;
            }
            sett.channels.push(msg.channel.id);
            saveSetting(msg.guild.id, sett, () => {
                msg.reply(`Added ${msg.channel} to the list of channels in which I will randomly share my thoughts.`);
            });
        }
    },
    thoughtsmention: {
        names: ["thoughtsmention", "thoughtsmentions", "togglethoughtsmention", "togglethoughtsmentions"],
        allowPrivate: false,
        perms: [],
        userCd: 5,
        code(msg) {
            let sett;
            if (!settings.has(msg.guild.id)) {
                return;
            } else {
                sett = settings.get(msg.guild.id);
            }
            if (!sett.enabled) {
                return;
            }
            if (msg.author.id in sett.usermention) {
                sett.usermention[msg.author.id] = !sett.usermention[msg.author.id];
            } else {
                sett.usermention[msg.author.id] = false;
            }
            saveSetting(msg.guild.id, sett, () => {
                msg.reply(`I will now ${sett.usermention[msg.author.id] ? "" : "no longer"} ping you when I randomly share my thoughts.`);
            });
            return "11";
        }
    }
};

function Settings(prev = {}) {
    this.enabled = prev.enabled || false;
    this.channels = prev.channels || [];
    this.odds = prev.odds || DEFAULT_ODDS;
    this.userodds = prev.userodds || {};
    this.usermention = prev.usermention || {};
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
