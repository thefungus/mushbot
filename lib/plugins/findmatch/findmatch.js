"use strict";
let util = require("../../util.js");
let database = require(util.DATABASE);
let cmds = require(util.COMMANDS);

let settings;
let games = new Map();
let messageCounts = new Map();

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
    if (!games.has(msg.guild.id)) {
        return;
    }
    let server = games.get(msg.guild.id);
    if (!server.size) {
        return;
    }
    if (!settings.has(msg.guild.id)) {
        settings.set(msg.guild.id, new Settings());
    }
    let sett = settings.get(msg.guild.id);
    if (sett.channels.length !== 0 && sett.channels.indexOf(msg.channel.id) === -1) {
        return;
    }
    if (!messageCounts.has(msg.channel.id)) {
        messageCounts.set(msg.channel.id, 0);
    }
    let count = messageCounts.get(msg.channel.id);
    messageCounts.set(msg.channel.id, count + 1);
    if ((count + 1) % sett.messages === 0) {
        if (server.size === 1) {
            let game = Array.from(server)[0];
            msg.client.users.find("id", game[0]).send(
                `I'm still looking for a match for you. If you want to cancel this, type \`${cmds.getCommandChar(msg.guild.id)}findmatch\` in the **${msg.guild.name}** server.`
            );
            msg.channel.send(
                `__**Hey guys! ${msg.client.users.find("id", game[0])} is looking to play some games:**__ ${game[1]} ~ Use \`${cmds.getCommandChar(msg.guild.id)}acceptmatch\` to play with them!`
            );
            return;
        }
        let reply = "__**Hey guys! A few people are looking to play some games:**__\n";
        for (let i of server.entries()) {
            reply += `\n${msg.client.users.find("id", i[0])}: ${i[1]}`;
        }
        reply += `\n\n__**Use**__ \`${cmds.getCommandChar(msg.guild.id)}acceptmatch @name\` __**to play with one of them!**__`;
        msg.channel.send(reply);
    }
}

function loadSettings(cb) {
    settings = new Map();
    database.loadAll("findmatch", (err, docs) => {
        if (err) {
            return cb(err);
        }
        for (let doc of docs) {
            settings.set(doc._id, new Settings(doc.data));
        }
        cb();
    });
}

function saveSettings(id, data, cb) {
    database.saveData("findmatch", id, data, cb);
}

let commands = {
    findmatch: {
        names: ["findmatch", "fm", "matchmaking", "mm"],
        allowPrivate: false,
        perms: [],
        userCd: 15,
        code(msg, args, argsStr, cmdName, char) {
            let server;
            if (games.has(msg.guild.id)) {
                server = games.get(msg.guild.id);
                if (server.has(msg.author.id)) {
                    server.delete(msg.author.id);
                    msg.reply(
                        "Okay, I cancelled your request to find a match!"
                    );
                    return;
                }
            } else {
                games.set(msg.guild.id, new Map());
                server = games.get(msg.guild.id);
            }
            if (!args.length) {
                msg.reply(
                    `If you want to find a match to play with someone, use \`${char}findmatch [message]\`. Use the message to describe what game you're playing! Example: \`${char}findmatch smash wii u\``
                );
                return;
            }
            server.set(msg.author.id, argsStr);
            msg.author.send(
                `Alright, I've set up your match. You just need to wait for someone to accept. If you want to cancel the request, type \`${char}findmatch\` again.`
            );
            if (settings.has(msg.guild.id)) {
                let channels = settings.get(msg.guild.id).channels;
                for (let i of channels) {
                    msg.client.channels.find("id", i).send(
                        `__**Hey guys! ${msg.author} is looking to play some games:**__ ${argsStr} ~ Use \`${char}acceptmatch\` to play with them!`
                    );
                }
            } else {
                msg.channel.send(
                    `__**Hey guys! ${msg.author} is looking to play some games:**__ ${argsStr} Use \`${char}acceptmatch\` to play with them!`
                );
            }
        }
    },
    acceptmatch: {
        names: ["acceptmatch", "am"],
        allowPrivate: false,
        perms: [],
        code(msg, args, argsStr, cmdName, char) {
            if (!games.has(msg.guild.id)) {
                return;
            }
            let server = games.get(msg.guild.id);
            if (!server.size) {
                return;
            }
            if (server.size === 1) {
                let game = Array.from(server)[0];
                util.getPrivateChannel(msg.client, game[0]).send(
                    `${msg.author} wants to play in ${msg.channel}! (${game[1]}) Have fun!`
                );
                msg.reply(
                    "Okay, I sent them a message saying you're ready to play! Enjoy!"
                );
                server.clear();
                return;
            }
            if (server.size > 1 && !args.length) {
                msg.reply(
                    `To accept a match, you gotta mention the person's name since there's more than 1 person looking for a match! Use \`${char}acceptmatch @name\`.`
                );
                return;
            }
            let id = util.getUser(args[0]);
            if (!id) {
                return;
            }
            if (server.has(id)) {
                msg.client.users.find("id", id).send(
                    `${msg.author}> wants to play in ${msg.channel}! (${server.get(id)}) Have fun!`
                );
                msg.reply(
                    "Okay, I sent them a message saying you're ready to play! Enjoy!"
                );
                server.delete(id);
                return;
            }
        }
    },
    setfindmatchchannel: {
        names: ["setfmchannel", "setfindmatchchannel"],
        allowPrivate: false,
        perms: util.MOD,
        code(msg) {
            if (!settings.has(msg.guild.id)) {
                settings.set(msg.guild.id, new Settings());
            }
            let sett = settings.get(msg.guild.id);
            if (sett.channels.indexOf(msg.channel.id) > -1) {
                sett.channels.splice(sett.channels.indexOf(msg.channel.id, 1));
                saveSettings(msg.guild.id, sett, () => {
                    msg.reply(
                        "Okay, I removed this channel from the find match channels!"
                    );
                });
                return;
            }
            sett.channels.push(msg.channel.id);
            saveSettings(msg.guild.id, sett, () => {
                msg.reply(
                    "Okay, I added this channel to the list of allowed channels for the findmatch commands!"
                );
            });
        }
    },
    setfindmatchmessages: {
        names: ["setfmmessages", "setfindmatchmessages"],
        allowPrivate: false,
        perms: util.MOD,
        code(msg, args) {
            if (!args.length) {
                msg.reply(
                    "You gotta give me a number!"
                );
                return;
            }
            let num = parseInt(args[0]);
            if (!num) {
                msg.reply(
                    "You gotta give me a valid number!"
                );
                return;
            }
            num = Math.abs(num);
            if (!settings.has(msg.guild.id)) {
                settings.set(msg.guild.id, new Settings());
            }
            let sett = settings.get(msg.guild.id);
            sett.messages = num;
            saveSettings(msg.guild.id, sett, () => {
                msg.reply(
                    `Okay, the findmatch command will send a message every ${num} messages!`
                );
            });
        }
    }
};

function help() {
    return util.dedent`__Find Match Plugin__
        This plugin helps you find matches to play with someone! mushbot will post every few minutes in channels set by the admins to get players to join.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

function Settings(prev = {}) {
    this.channels = prev.channels || [];
    this.messages = prev.messages || 30;
}

module.exports = {
    name: "findmatch",
    help,
    load,
    unload,
    commands
};
