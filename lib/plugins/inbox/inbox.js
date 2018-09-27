"use strict";
let util = require("../../util.js");
let database = require(util.DATABASE);

let inbox;

function load(mb, cb) {
    loadInboxes((err) => {
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
    if (msg.mentions.users.size) {
        let inc = new Set();
        for (let i of msg.mentions.users.values()) {
            if (inc.has(i.id)) {
                continue;
            }
            inc.add(i.id);
            if (!inbox.has(i.id)) {
                inbox.set(i.id, []);
            }
            let message = {
                id: msg.author.id,
                name: msg.author.username,
                time: Date.now(),
                content: msg.content,
                channel: msg.channel.id,
                server: msg.guild.name
            };
            let box = inbox.get(i.id);
            box.push(message);
            if (box.length > 10) {
                box.shift();
            }
            saveInbox(i.id, box);
        }
    }
}

function loadInboxes(cb) {
    database.loadAll("inbox", (err, docs) => {
        inbox = new Map();
        if (err) {
            return cb(err);
        }
        for (let doc of docs) {
            inbox.set(doc._id, doc.data);
        }
        cb();
    });
}

function saveInbox(id, inbox) {
    database.saveData("inbox", id, inbox);
}

function getTime(date) {
    let totalMins = Math.floor((Date.now() - date) / 60000);
    let minutes = totalMins % 60;
    let hours = Math.floor(totalMins / 60) % 24;
    let days = Math.floor(totalMins / 60 / 24);
    let minMsg = minutes ? ` ${minutes} minute${minutes === 1 ? "" : "s"}` : "";
    let hourMsg = hours ? ` ${hours} hour${hours === 1 ? "" : "s"}` : "";
    let daysMsg;
    switch (days) {
        case 0:
            daysMsg = "Today";
            break;
        case 1:
            daysMsg = "Yesterday";
            break;
        default:
            daysMsg = `${days} days`;
    }
    return `${daysMsg}${(hourMsg || minMsg) ? "," : ""}${hourMsg}${minMsg}${(hourMsg || minMsg || days > 1) ? " ago" : ""}`;
}

let commands = {
    inbox: {
        names: ["inbox", "lastmentions", "mentioninbox", "mentionsinbox", "mentions"],
        allowPrivate: true,
        perms: [],
        desc: "Display the last few messages in which you were mentioned.",
        code(msg) {
            let box = inbox.get(msg.author.id);
            if (!box || !box.length) {
                msg.reply(
                    "You don't have anything in your mentions inbox yet. If you use the command after being mentioned, the most recent messages will be shown."
                );
                return;
            }
            let replies = [];
            for (let i of box) {
                let message = `From ${i.name || `<@!${i.id}>`} in **[${i.server}]** <#${i.channel}> *${getTime(i.time)}*\n${i.content}\n\n\n`;
                if (message.length > 2000) {
                    message = `${message.slice(0, 1900)} [...]\n\n\n`;
                }
                replies.push(message);
            }
            replies = util.convertLongMessage(replies);
            util.sendMultiple(msg.author, replies);
        }
    }
};

function help() {
    return util.dedent`__Inbox Plugin__
        mushbot will keep track of any messages in which you are mentioned in case you missed a mention a few hours ago and can't be bothered scrolling way back up.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "inbox",
    help,
    load,
    unload,
    commands
};
