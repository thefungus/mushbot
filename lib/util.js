"use strict";
let async = require("async");
let path = require("path");
let Discord = require("discord.js");

const FUNGU = "81608609099677696";
const FUNGU_TWITCH = "41977126";
const HELP_LINK = "";

const DAY = 1000 * 60 * 60 * 24;
const MOD = ["BAN_MEMBERS", "MANAGE_GUILD"];

const COMMANDS = `${__dirname}/core/commands.js`;
const DATABASE = `${__dirname}/core/database.js`;
const PLUGINS = `${__dirname}/core/plugins.js`;
const TWITCH = `${__dirname}/core/twitch.js`;
const CREDS = path.resolve(`${__dirname}/../creds.json`);

function error(module, when, err) {
    let msg = dedent`There was an error with module: ${module}
        Error happened during: ${when}
        Error: ${err}`;
    console.log(msg);
}

function chooseRandom(arg) {
    if (typeof arg === "string") {
        return arg.charAt(Math.floor(Math.random() * arg.length));
    }
    return arg[Math.floor(Math.random() * arg.length)];
}

function getUser(str) {
    let re = /^<@!?(\d+)>/.exec(str);
    return re ? re[1] : null;
}

function getUserByName(mb, id, name) {
    if (!mb.users.exists("username", name)) {
        return null;
    }
    for (let server of mb.guilds) {
        if (server.members.exists("id", id) && server.members.exists("username", name)) {
            return server.members.find("username", name).id;
        }
    }
    return null;
}

function getChannel(str) {
    let re = /^<#(\d+)>/.exec(str);
    return re ? re[1] : null;
}

function convertLongMessage(msgs) {
    let replies = [""];
    for (let i of msgs) {
        if (replies[replies.length - 1].length + i.length > 2000) {
            replies.push("");
        }
        replies[replies.length - 1] += i;
    }
    return replies;
}

function convertLongMessageTwitch(msgs) {
    let replies = [""];
    for (let i of msgs) {
        if (replies[replies.length - 1].length + i.length > 495) {
            replies.push("");
        }
        replies[replies.length - 1] += `${i} `;
    }
    return replies;
}

function convertLongMessageTwitchPM(msgs) {
    let replies = [""];
    for (let i of msgs) {
        if (replies[replies.length - 1].length + i.length > 250) {
            replies.push("");
        }
        replies[replies.length - 1] += `${i} `;
    }
    return replies;
}

function sendMultiple(target, msgs, cb = () => {}) {
    async.eachSeries(msgs, (msg, cb) => {
        target.send(msg).then(cb);
    }, cb);
}

function dedent(str) {
    let payload = "";
    let args = Array.apply(null, arguments).slice(1);
    for (let i of str) {
        payload += i;
        payload += args.shift() || "";
    }
    return payload
        .split("\n")
        .map((s) => s.replace(/^[\s\uFEFF\xA0]+/g, ""))
        .join("\n");
}

function containsIgnoreCase(coll, item) {
    if (Array.isArray(coll)) {
        for (let i = 0; i < coll.length; i++) {
            if (coll[i].toLowerCase() === item.toLowerCase()) {
                return i;
            }
        }
        return -1;
    }
    for (let i of coll.entries()) {
        if (i[0].toLowerCase() === item.toLowerCase()) {
            return 0;
        }
    }
    return -1;
}

function deleteSetIgnoreCase(coll, item) {
    for (let i of coll) {
        if (i.toLowerCase() === item.toLowerCase()) {
            coll.delete(i);
            return;
        }
    }
}

function generateCommandsInfo(commands) {
    let payload = "";
    for (let i in commands) {
        if (commands[i].desc) {
            payload += `\`!${i}\` - ${commands[i].desc}\n`;
        }
    }
    return payload || "This plugin's commands are hidden! Sorry!";
}

function getPrivateChannel(client, id) {
    for (let i of client.channels) {
        if (i.type === "dm" && i.recipient.id === id) {
            return i;
        }
    }
    return client.users.find("id", id);
}

function shuffleInPlace(a) {
    var j, x, i;
    for (i = a.length; i; i--) {
        j = Math.floor(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
}

function getRandomN(arr, n) {
    var res = [];
    while (n--) {
        var i = Math.floor(Math.random() * arr.length);
        res.push(arr[i]);
        arr.splice(i, 1);
    }
    return res;
}

function objectValues(obj) {
    let res = [];
    for (let i in obj) {
        res.push(obj[i]);
    }
    return res;
}

function richEmbed() {
    return new Discord.RichEmbed().setColor(14549102);
}

module.exports = {
    FUNGU,
    FUNGU_TWITCH,
    HELP_LINK,
    DAY,
    MOD,
    COMMANDS,
    DATABASE,
    PLUGINS,
    TWITCH,
    CREDS,
    error,
    chooseRandom,
    getUser,
    getUserByName,
    getChannel,
    convertLongMessage,
    convertLongMessageTwitch,
    convertLongMessageTwitchPM,
    sendMultiple,
    dedent,
    containsIgnoreCase,
    deleteSetIgnoreCase,
    generateCommandsInfo,
    getPrivateChannel,
    shuffleInPlace,
    getRandomN,
    objectValues,
    richEmbed
};
