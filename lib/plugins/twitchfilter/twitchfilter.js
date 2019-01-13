"use strict";
let util = require("../../util.js");
let database = require(util.DATABASE);
let twitch = require(util.TWITCH);
//let words = require("categorized-words");

let settings;

let chatted = new Set();

let FILTER = {
    TWITCH: /(https?:\/\/)?(www\.)?twitch\.tv\/\S+/,
    CLIP: /(https?:\/\/)?clips\.twitch\.tv\/\S+/,
    ODDSHOT: /(https?:\/\/)?(www\.)?oddshot\.tv\/\S+/,
    SMASHGG: /(https?:\/\/)?(www\.)?smash\.gg\/\S+/,
    CHALLONGE: /(https?:\/\/)?(www\.)?challonge\.com\/\S+/,
    LINK: /(https?:\/\/)?(www\.)?\w+\.\w{2,}\/\S{2,}/
};

function load(mb, cb) {
    loadSettings((err) => {
        if (err) {
            return cb(err);
        }
        twitch.addEvent("chat", chatHandler);
        cb();
    });
}

function unload(mb, cb) {
    twitch.removeEvent("chat", chatHandler);
    cb();
}

function loadSettings(cb) {
    database.loadAll("twitchfilter", (err, docs) => {
        if (err) {
            return cb(err);
        }
        settings = new Map();
        for (let doc of docs) {
            settings.set(doc._id, new Settings(doc.data));
        }
        cb();
    });
}

/*function isBot(user) {
    for (let i of words["A"]) {
        for (let j of words["N"]) {
            let re = new RegExp(`${i}${j}\\d{1,3}`);
            if (re.test(user.username) && !chatted.has(user.username)) {
                return true;
            }
        }
    }
}*/

function saveSettings(channel, data, cb) {
    database.saveData("twitchfilter", channel, data, cb);
}

function chatFilter(msg) {
    return !FILTER.CLIP.test(msg) &&
        !FILTER.ODDSHOT.test(msg) &&
        !FILTER.SMASHGG.test(msg) &&
        !FILTER.CHALLONGE.test(msg) &&
        FILTER.LINK.test(msg);
}

function chatHandler(channel, user, message, self) {
    if (self) {
        return;
    }
    if (twitch.hasBadge(user) || twitch.isSub(user) || twitch.isOp(channel, user)) {
        return;
    }
    if (!settings.has(channel)) {
        chatted.add(user.username);
        return;
    }
    let sett = settings.get(channel);
    if (!sett.enabled) {
        chatted.add(user.username);
        return;
    }
    if (chatted.has(user.username)) {
        return;
    }
    /*if (isBot(user)) {
        console.log(`Found user to ban: ${user.username}`);
        //twitch.banUser(channel, user.username, "mushbot autoban bot detection; if you aren't a bot, whisper a mod");
        return;
    }*/
    if (chatFilter(message)) {
        twitch.timeoutUser(channel, user.username, 600, "mushbot autoban bot detection; if you aren't a bot, whisper a mod");
        return;
    }
    chatted.add(user.username);
}

let twitchCommands = {
    botfilter: {
        names: ["botfilter", "filter"],
        perms: ["admin"],
        desc: "(admins) Toggle the Bot Filter for Twitch chat if Mushybot is in your channel.",
        code(channel, user) {
            if (!settings.has(channel)) {
                settings.set(channel, new Settings());
            }
            let sett = settings.get(channel);
            sett.enabled = !sett.enabled;
            saveSettings(channel, sett, () => {
                twitch.reply(channel, user,
                    `Bot filter ${sett.enabled ? "enabled" : "disabled"}!`
                );
            });
        }
    }
};

function Settings(prev = {}) {
    this.enabled = prev.enabled || false;
}

function help() {

}

module.exports = {
    name: "twitchfilter",
    help,
    load,
    unload,
    twitchCommands
};
