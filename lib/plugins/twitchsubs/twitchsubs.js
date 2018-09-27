"use strict";
let util = require("../../util.js");
let database = require(util.DATABASE);
let twitch = require(util.TWITCH);

let settings;

function load(mb, cb) {
    loadSettings((err) => {
        if (err) {
            return cb(err);
        }
        twitch.addEvent("subscription", onSub);
        twitch.addEvent("resub", onResub);
        cb();
    });
}

function unload(mb, cb) {
    twitch.removeEvent("subscription", onSub);
    twitch.removeEvent("resub", onResub);
    cb();
}

function onSub(channel, username) {
    if (!settings.has(channel)) {
        return;
    }
    let sett = settings.get(channel);
    if (sett.welcomeSub) {
        let message = sett.welcomeSub.replace(/\{\{user\}\}/, username);
        twitch.sendMessage(channel, message);
    }
    if (sett.whisperSub) {
        let message = sett.whisperSub.replace(/\{\{user\}\}/, username);
        twitch.sendWhisper(username, message);
    }
}

function onResub(channel, username, months) {
    if (!settings.has(channel)) {
        return;
    }
    let sett = settings.get(channel);
    if (sett.welcomeResub) {
        let message = sett.welcomeResub.replace(/\{\{user\}\}/, username).replace(/\{\{m\}\}/, months);
        twitch.sendMessage(channel, message);
    }
    if (sett.whisperResub) {
        let message = sett.whisperResub.replace(/\{\{user\}\}/, username).replace(/\{\{m\}\}/, months);
        twitch.sendWhisper(username, message);
    }
}

function loadSettings(cb) {
    database.loadAll("twitchsubs", (err, docs) => {
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

function saveSettings(channel, data, cb) {
    database.saveData("twitchsubs", channel, data, cb);
}

let twitchCommands = {
    submessage: {
        names: ["submessage", "submsg"],
        perms: ["mod"],
        desc: "(mods) Set the message that Mushybot sends when someone subs. `{{user}}` gets replaced by the username.",
        code(channel, user, args) {
            if (!settings.get(channel)) {
                settings.set(channel, new Settings());
            }
            let sett = settings.get(channel);
            if (!args.length) {
                sett.welcomeSub = "";
                saveSettings(channel, sett, () => {
                    twitch.reply(channel, user,
                        "Sub message cleared!"
                    );
                });
                return;
            }
            sett.welcomeSub = args.join(" ");
            saveSettings(channel, sett, () => {
                twitch.reply(channel, user,
                    "Sub message set!"
                );
            });
        }
    },
    subwhisper: {
        names: ["subwhisper", "subwhisp"],
        perms: ["mod"],
        desc: "(mods) Set the message that Mushybot whispers when someone subs. `{{user}}` gets replaced by the username.",
        code(channel, user, args) {
            if (!settings.get(channel)) {
                settings.set(channel, new Settings());
            }
            let sett = settings.get(channel);
            if (!args.length) {
                sett.whisperSub = "";
                saveSettings(channel, sett, () => {
                    twitch.reply(channel, user,
                        "Sub whisper message cleared!"
                    );
                });
                return;
            }
            sett.whisperSub = args.join(" ");
            saveSettings(channel, sett, () => {
                twitch.reply(channel, user,
                    "Sub whisper message set!"
                );
            });
        }
    },
    resubmessage: {
        names: ["resubmessage", "resubmsg"],
        perms: ["mod"],
        desc: "(mods) Set the message that Mushybot sends when someone resubs. `{{user}}` gets replaced by the username and `{{m}}` gets replaced by the number of months.",
        code(channel, user, args) {
            if (!settings.get(channel)) {
                settings.set(channel, new Settings());
            }
            let sett = settings.get(channel);
            if (!args.length) {
                sett.welcomeResub = "";
                saveSettings(channel, sett, () => {
                    twitch.reply(channel, user,
                        "Resub message cleared!"
                    );
                });
                return;
            }
            sett.welcomeResub = args.join(" ");
            saveSettings(channel, sett, () => {
                twitch.reply(channel, user,
                    "Resub message set!"
                );
            });
        }
    },
    resubwhisper: {
        names: ["resubwhisper", "resubwhisp"],
        perms: ["mod"],
        desc: "(mods) Set the message that Mushybot whispers when someone resubs. `{{user}}` gets replaced by the username and `{{m}}` gets replaced by the number of months.",
        code(channel, user, args) {
            if (!settings.get(channel)) {
                settings.set(channel, new Settings());
            }
            let sett = settings.get(channel);
            if (!args.length) {
                sett.whisperResub = "";
                saveSettings(channel, sett, () => {
                    twitch.reply(channel, user,
                        "Resub whisper message cleared!"
                    );
                });
                return;
            }
            sett.whisperResub = args.join(" ");
            saveSettings(channel, sett, () => {
                twitch.reply(channel, user,
                    "Resub whisper message set!"
                );
            });
        }
    }
};

function Settings(prev = {}) {
    this.welcomeSub = prev.welcomeSub || "";
    this.welcomeResub = prev.welcomeResub || "";
    this.whisperSub = prev.whisperSub || "";
    this.whisperResub = prev.whisperResub || "";
}

function help() {
    return util.dedent`__Twitchsubs Plugin__
        This plugin allows you to set a message for mushbot to send in your Twitch chat when a viewer subscribes or resubscribes.
        You can also set a message for mushbot to whisper to new subs or resubs.
        (Mushybot needs to be in your Twitch chat for this to work.)

        Twitch Commands:
        ${util.generateCommandsInfo(twitchCommands)}`;
}

module.exports = {
    name: "twitchsubs",
    help,
    load,
    unload,
    twitchCommands
};
