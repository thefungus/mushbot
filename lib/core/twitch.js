"use strict";
let irc = require("tmi.js");
let async = require("async");
let util = require("../util.js");

const COLORS = new Set([
    "Blue",
    "BlueViolet",
    "CadetBlue",
    "Chocolate",
    "Coral",
    "DodgerBlue",
    "Firebrick",
    "GoldenRod",
    "Green",
    "HotPink",
    "OrangeRed",
    "Red",
    "SeaGreen",
    "SpringGreen",
    "YellowGreen"
]);
const USER_TYPES = new Set([
    "mod",
    "global_mod",
    "admin",
    "staff"
]);

let channels = new Set();
var mush;

function init(un, pw, cb) {
    mush = new irc.client({
        connection: {
            reconnect: true
        },
        identity: {
            username: un,
            password: pw
        }
    });
    mush.connect().then(() => {
        cb();
    }).catch((err) => {
        console.log("error connecting", err);
        cb(err);
    });
}

function addEvent(event, cb) {
    mush.on(event, cb);
}

function removeEvent(event, cb) {
    mush.removeListener(event, cb);
}

function getChannel(channel) {
    return (channel.charAt(0) === "#" ? channel : `#${channel}`).toLowerCase();
}

function setColor(color, cb = () => {}) {
    if (!COLORS.has(color)) {
        return setTimeout(() => {
            cb("Twitch Error: invalid color");
        }, 4);
    }
    mush.color(color).then(() => {
        cb();
    }).catch((/*err*/) => {
        console.log("error setting color", color);
        cb();
    });
}

function joinChannel(channel, cb = () => {}) {
    let ch = getChannel(channel);
    if (channels.has(ch)) {
        return setTimeout(cb, 4);
    }
    mush.join(ch).then(() => {
        channels.add(ch);
        cb();
    }).catch(() => {
        console.log("error joining channel", ch);
        cb();
    });
}

function leaveChannel(channel, cb = () => {}) {
    let ch = getChannel(channel);
    if (!channels.has(ch)) {
        return setTimeout(() => {
            cb("Twitch Error: bot isn't in that channel");
        }, 4);
    }
    mush.part(ch).then(() => {
        channels.delete(ch);
        cb();
    }).catch((err) => {
        console.log("error leaving channel", ch);
        cb(err);
    });
}

function sendMessage(channel, message, cb = () => {}) {
    if (!channel || !message) {
        return;
    }
    let ch = getChannel(channel);
    if (!channels.has(ch)) {
        return setTimeout(() => {
            cb("Twitch Error: bot isn't in that channel");
        }, 4);
    }
    let msgs = util.convertLongMessageTwitch(message.split(" "));
    async.eachSeries(msgs, (msg, cb) => {
        mush.say(ch, msg).then(() => {
            cb();
        }).catch((err) => {
            console.log("error sending message", ch, msg);
            cb(err);
        });
    }, cb);
}

function sendAction(channel, message, cb = () => {}) {
    if (!channel || !message) {
        return;
    }
    let ch = getChannel(channel);
    if (!channels.has(ch)) {
        return setTimeout(() => {
            cb("Twitch Error: bot is not in that channel");
        }, 4);
    }
    let msgs = util.convertLongMessageTwitch(message.split(" "));
    async.eachSeries(msgs, (msg, cb) => {
        mush.action(ch, msg).then(() => {
            cb();
        }).catch((err) => {
            console.log("error sending action", ch, msg);
            cb(err);
        });
    }, cb);
}

function sendWhisper(user, message, cb = () => {}) {
    let username = user.username || user;
    let msgs = util.convertLongMessageTwitchPM(message.split(" "));
    async.eachSeries(msgs, (msg, cb) => {
        mush.whisper(username, msg).then(() => {
            cb();
        }).catch((err) => {
            console.log("error sending whisper", username, msg);
            cb(err);
        });
    }, cb);
}

function reply(channel, user, message, cb = () => {}) {
    let ch = getChannel(channel);
    let username = user["display-name"] || user.username || user;
    sendMessage(ch, `@${username}, ${message}`, cb);
}

function banUser(channel, user, reason = "mushbot", cb = () => {}) {
    let ch = getChannel(channel);
    let username = user.username || user;
    mush.ban(ch, username, reason).then(() => {
        cb();
    }).catch((err) => {
        console.log("error banning user", ch, username, reason);
        cb(err);
    });
}

function timeoutUser(channel, user, duration, callback) {
    let cb;
    let dur;
    if (typeof duration === "function") {
        cb = duration;
    } else {
        dur = duration || 300;
        cb = callback || (() => {});
    }
    let ch = getChannel(channel);
    let username = user.username || user;
    mush.timeout(ch, username, dur).then(() => {
        cb();
    }).catch((err) => {
        console.log("error timeout user", ch, username, dur);
        cb(err);
    });
}

function isStreamer(channel, user) {
    return channel.replace("#", "") === user.username;
}

function isOp(channel, user) {
    if (isStreamer(channel, user)) {
        return true;
    }
    if (user.mod) {
        return true;
    }
    if (USER_TYPES.has(user["user-type"])) {
        return true;
    }
    return false;
}

function isSub(user) {
    return user.subscriber;
}

function hasBadge(/*user*/) {
    return /*user.badges && user.badges.keys().length;*/ false;
}

module.exports = {
    init,
    addEvent,
    removeEvent,
    sendAction,
    setColor,
    joinChannel,
    leaveChannel,
    sendMessage,
    sendWhisper,
    reply,
    banUser,
    timeoutUser,
    isStreamer,
    isOp,
    isSub,
    hasBadge
};
