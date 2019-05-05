"use strict";
let util = require("../../util.js");
let db = require(util.DATABASE);

const QUOTE_REGEX = /https:\/\/discordapp.com\/channels\/(\d+)\/(\d+)\/(\d+)/i;

let settings;

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
    if (msg.channel.type === "dm") {
        return;
    }
    if (msg.author.equals(msg.client.user)) {
        return;
    }
    if (!settings.has(msg.guild.id)) {
        return;
    }
    let sett = settings.get(msg.guild.id);
    if (!sett.on) {
        return;
    }
    let re = QUOTE_REGEX.exec(msg.content);
    if (re && re.length === 4) {
        let ch = re[2];
        if (!sett.xserver && !msg.guild.channels.has(ch)) {
            return;
        }
        let mid = re[3];
        let guild = msg.client.guilds.get(re[1]);
        if (!guild) {
            return;
        }
        guild.channels.get(ch).fetchMessage(mid)
            .then(qmsg => {
                msg.channel.send(`Quoted by ${msg.author}`, generateEmbed(qmsg));
                if (re[0] === msg.content) {
                    msg.delete();
                }
            })
            .catch();
    }
}

function generateEmbed(msg) {
    let edited = msg.editedTimestamp || false;
    let footer = `➡️ Sent in #${msg.channel.name}${edited ? " and edited" : ""}`;
    let embed = util.richEmbed()
        .setAuthor(msg.member ? msg.member.displayName : msg.author.username, msg.author.displayAvatarURL)
        .setDescription(msg.content)
        .setFooter(footer)
        .setTimestamp(msg.editedAt || msg.createdAt);
    if (msg.member) {
        embed.setColor(msg.member.displayColor);
    }
    return embed;
}

function loadSettings(cb) {
    settings = new Map();
    db.loadAll("quoting", (err, docs) => {
        if (err) {
            return cb(err);
        }
        for (let doc of docs) {
            settings.set(doc._id, doc.data);
        }
        cb();
    });
}

function saveSettings(id, sett, cb) {
    db.saveData("quoting", id, sett, cb);
}

let commands = {
    togglequoting: {
        names: ["togglequote", "togglequoting", "togglequotes"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "Enable or disable quoting of messages.",
        code(msg) {
            if (!settings.has(msg.guild.id)) {
                settings.set(msg.guild.id, new Settings());
            }
            let sett = settings.get(msg.guild.id);
            sett.on = !sett.on;
            saveSettings(msg.guild.id, sett, () => {
                msg.reply(`Message quoting ${sett.on ? "enabled" : "disabled"}!`);
            });
        }
    },
    xserverquoting: {
        names: ["xserverquoting", "xserverquotes", "xserverquote"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "Enable or disable quoting messages from other servers.",
        code(msg) {
            if (!settings.has(msg.guild.id)) {
                settings.set(msg.guild.id, new Settings());
            }
            let sett = settings.get(msg.guild.id);
            sett.xserver = !sett.xserver;
            saveSettings(msg.guild.id, sett, () => {
                msg.reply(`Cross-server quoting ${sett.on ? "enabled" : "disabled"}!`);
            });
        }
    }
};

function Settings(prev = {}) {
    this.on = prev.on || false;
    this.xserver = prev.xserver || false;
}

function help() {
    return util.dedent`__Quoting Plugin__
        Allow mushbot to display quoted messages via links.
        To quote a message, get the message's link by clicking on the 3 dots on the right of the message, then select Copy Link.
        For this to work, you need to enable developer mode in your Discord settings.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "quoting",
    help,
    load,
    unload,
    commands
};
