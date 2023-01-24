"use strict";
let async = require("async");
let util = require("../../util.js");
let database = require(util.DATABASE);

let settings;

function load(mb, cb) {
    loadSettings(err => {
        if (err) {
            return cb(err);
        }
        cb();
    });
}

function unload(mb, cb) {
    cb();
}

function loadSettings(cb) {
    settings = new Map();
    database.loadAll("rolecolors", (err, docs) => {
        if (err) {
            return cb(err);
        }
        for (let doc of docs) {
            settings.set(doc._id, doc.data);
        }
        cb();
    });
}

function saveSetting(id, sett, cb) {
    database.saveData("rolecolors", id, sett, cb);
}

function getRandomColor() {
    // Colors are numbers between 0 and 0xFFFFFF
    return Math.floor(Math.random() * 0xFFFFFF);
}

let commands = {
    togglerolecolors: {
        names: ["togglerolecolors", "togglerolecolours"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "Toggles whether the role colors plugin is enabled.",
        code(msg, args, argsStr, cmdName, char) {
            let sett;
            if (!settings.has(msg.guild.id)) {
                sett = new Settings();
                settings.set(msg.guild.id, sett);
            } else {
                sett = settings.get(msg.guild.id);
            }
            sett.enabled = !sett.enabled;
            saveSetting(msg.guild.id, sett, () => {
                msg.reply(`Role colors commands **${sett.enabled ? "enabled" : "disabled"}**! ${sett.enabled ? `Also, ${sett.allowAll ? "**anyone** is" : "**only mods** are"} allowed to change their color, and **${sett.allowCustom ? "random and custom" : "only random"}** colors are allowed.` : ""}`);
            });
        }
    },
    togglecustomrolecolors: {
        names: ["togglecustomrolecolors", "togglecustomrolecolours"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "Toggles whether the role colors plugin allows custom colors instead of just random colors.",
        code(msg, args, argsStr, cmdName, char) {
            let sett;
            if (!settings.has(msg.guild.id)) {
                sett = new Settings();
                settings.set(msg.guild.id, sett);
            } else {
                sett = settings.get(msg.guild.id);
            }
            if (!sett.enabled) {
                return;
            }
            sett.allowCustom = !sett.allowCustom;
            saveSetting(msg.guild.id, sett, () => {
                msg.reply(`Custom role colors **${sett.enabled ? "enabled" : "disabled"}**!`);
            });
        }
    },
    togglerolecolorsall: {
        names: ["togglerolecolorsall", "togglerolecoloursall"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "Toggles whether anyone is allowed to change their role color, or just mods.",
        code(msg, args, argsStr, cmdName, char) {
            let sett;
            if (!settings.has(msg.guild.id)) {
                sett = new Settings();
                settings.set(msg.guild.id, sett);
            } else {
                sett = settings.get(msg.guild.id);
            }
            if (!sett.enabled) {
                return;
            }
            sett.allowAll = !sett.allowAll;
            saveSetting(msg.guild.id, sett, () => {
                msg.reply(`${sett.allowAll ? "**Anyone** is" : "**Only mods** are"} now allowed to change their color!`);
            });
        }
    },
    setcolorrole: {
        names: ["setcolorrole", "setcolourrole"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "Set which role the user uses for their color in the server.",
        code(msg, args, argsStr, cmdName, char) {
            let sett;
            if (!settings.has(msg.guild.id)) {
                sett = new Settings();
                settings.set(msg.guild.id, sett);
            } else {
                sett = settings.get(msg.guild.id);
            }
            if (!sett.enabled) {
                return;
            }
            if (!msg.mentions.roles.size || !msg.mentions.members.size) {
                msg.reply(`Command usage: \`${char}setcolorrole @username @role\``);
                return;
            }
            let user = msg.mentions.members.first();
            let role = msg.mentions.roles.first();
            if (!user.roles.has(role.id)) {
                msg.reply(`I couldn't find that role on that user.`);
                return;
            }
            sett.userRoles[user.id] = role.id;
            saveSetting(msg.guild.id, sett, () => {
                msg.reply("Saved that color role for that user!");
            });
        }
    },
    setrandomcolor: {
        names: ["setrandomcolor", "setrandomcolour", "getrandomcolor", "getrandomcolour"],
        allowPrivate: false,
        perms: [],
        desc: "Set yourself a randomly generated color.",
        code(msg, args, argsStr, cmdName, char) {
            let sett;
            if (!settings.has(msg.guild.id)) {
                sett = new Settings();
                settings.set(msg.guild.id, sett);
            } else {
                sett = settings.get(msg.guild.id);
            }
            if (!sett.enabled) {
                return;
            }
            if (!sett.allowAll && !(msg.member.hasPermission("BAN_MEMBERS", false, true, true) || msg.member.hasPermission("MANAGE_GUILD", false, true, true))) {
                return;
            }
            if (!sett.userRoles[msg.author.id]) {
                msg.reply(`You need a mod to set your color role first, with \`${char}setcolorrole @yourname @yourcolorrole\``);
                return;
            }
            msg.member.roles.get(sett.userRoles[msg.author.id]).setColor(getRandomColor());
            msg.reply("Enjoy your new color!");
        }
    },
    setcustomcolor: {
        names: ["setcustomcolor", "setcolor", "setcustomcolour", "setcolour"],
        allowPrivate: false,
        perms: [],
        desc: "Set yourself a custom color.",
        code(msg, args, argsStr, cmdName, char) {
            let sett;
            if (!settings.has(msg.guild.id)) {
                sett = new Settings();
                settings.set(msg.guild.id, sett);
            } else {
                sett = settings.get(msg.guild.id);
            }
            if (!sett.enabled || !sett.allowCustom) {
                return;
            }
            if (!sett.allowAll && !(msg.member.hasPermission("BAN_MEMBERS", false, true, true) || msg.member.hasPermission("MANAGE_GUILD", false, true, true))) {
                return;
            }
            if (!sett.userRoles[msg.author.id]) {
                msg.reply(`You need a mod to set your color role first, with \`${char}setcolorrole @yourname @yourcolorrole\``);
                return;
            }
            if (!args.length) {
                msg.reply(`Command usage: \`${char}setcustomcolor 0xFF12AB\` or \`${char}setcustomcolor 1234567\``);
                return;
            }
            let color = parseInt(args[0]);
            if (isNaN(color) || color < 0 || color > 0xFFFFFF) {
                msg.reply("Invalid color");
                return;
            }
            msg.member.roles.get(sett.userRoles[msg.author.id]).setColor(color);
            msg.reply("Enjoy your new color!");
        }
    }
};

function Settings(prev = {}) {
    this.enabled = prev.enabled || false;
    this.allowAll = prev.allowAll || false;
    this.allowCustom = prev.allowCustom || false;
    this.userRoles = prev.userRoles || {};
}

function help() {
    return util.dedent`__Role Colors Plugin__
        This plugin lets you change your name color in a server.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "rolecolors",
    help,
    load,
    unload,
    commands
};
