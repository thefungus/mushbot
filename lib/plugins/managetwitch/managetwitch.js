"use strict";
let async = require("async");
let util = require("../../util.js");
let twitch = require(util.TWITCH);
let database = require(util.DATABASE);

let settings;
let tempLeave = new Map();

function load(mb, cb) {
    async.series([
        loadSettings,
        (cb) => {
            async.parallel([
                setColor,
                joinChannels
            ], cb);
        }
    ], cb);
}

function unload(mb, cb) {
    for (let i of tempLeave.values()) {
        clearTimeout(i);
    }
    cb();
}

function loadSettings(cb) {
    database.loadData("managetwitch", "settings", (err, doc) => {
        if (err) {
            return cb(err);
        }
        settings = new Settings(doc ? (doc.data || {}) : {});
        cb();
    });
}

function setColor(cb) {
    console.log("setting color");
    twitch.setColor(settings.color, cb);
}

function joinChannels(cb) {
    console.log("joining channels");
    async.each(settings.channels, (channel, cb) => {
        twitch.joinChannel(channel, (err) => {
            if (err) {
                return cb(err);
            }
            if (settings.joinMsg) {
                twitch.sendMessage(channel, settings.joinMsg, cb);
            } else {
                cb();
            }
        });
    }, cb);
}

function saveSettings(cb) {
    database.saveData("managetwitch", "settings", settings, cb);
}

let commands = {
    jointwitch: {
        names: ["jointwitch"],
        allowPrivate: true,
        perms: ["fungus"],
        code(msg, args) {
            if (msg.channel.type !== "dm") {
                return;
            }
            if (!args.length) {
                return;
            }
            let ch = args[0].toLowerCase();
            twitch.joinChannel(ch, (err) => {
                if (err) {
                    msg.reply("failed to join");
                    return;
                }
                if (settings.channels.indexOf(ch) === -1) {
                    settings.channels.push(ch);
                }
                saveSettings(() => {
                    if (settings.joinMsg) {
                        twitch.sendMessage(ch, settings.joinMsg);
                    }
                    msg.reply("success!");
                });
            });
        }
    },
    getid: {
        names: ["getid"],
        allowPrivate: false,
        perms: ["fungus"],
        code(msg, args) {
            msg.reply(util.getUser(args[0]));
        }
    }
};

let twitchCommands = {
    setcolor: {
        names: ["setcolor"],
        perms: ["fungus"],
        code(channel, user, args) {
            if (!args.length) {
                return;
            }
            twitch.setColor(args[0], (err) => {
                if (err) {
                    twitch.reply(channel, user,
                        "Well, that didn't work. Wanna try again, but this time be smarter?"
                    );
                } else {
                    settings.color = args[0];
                    saveSettings(() => {
                        setTimeout(() => {
                            twitch.reply(channel, user,
                                "Yay! I look so much cuter in this color!"
                            );
                        }, 2000);
                    });
                }
            });
        }
    },
    setjoinmsg: {
        names: ["setjoinmsg"],
        perms: ["fungus"],
        code(channel, user, args) {
            if (args.length) {
                settings.joinMsg = args.join(" ");
            } else {
                settings.joinMsg = "";
            }
            saveSettings(() => {
                twitch.reply(channel, user,
                    "Okay, I updated the join message!"
                );
            });
        }
    },
    leavechannel: {
        names: ["leavechannel"],
        perms: ["streamer"],
        code(channel, user, args, char) {
            if (tempLeave.has(channel)) {
                clearTimeout(tempLeave.get(channel));
                tempLeave.delete(channel);
                twitch.sendMessage(channel, "Okay! BibleThump Goodbye!", () => {
                    twitch.leaveChannel(channel, () => {
                        console.log(`left channel ${channel}`);
                    });
                });
            } else {
                tempLeave.set(channel, setTimeout(() => {
                    tempLeave.delete(channel);
                }, 2 * 1000 * 60));
                twitch.reply(channel, user,
                    `Are you really sure you want me to leave?? I won't come back! Type ${char}leavechannel again if you really want me to go.`
                );
            }
        }
    }
};

function Settings(prev = {}) {
    this.channels = prev.channels || [];
    this.color = prev.color || "Blue";
    this.joinMsg = prev.joinMsg || "";
}

module.exports = {
    name: "managetwitch",
    load,
    unload,
    commands,
    twitchCommands
};
