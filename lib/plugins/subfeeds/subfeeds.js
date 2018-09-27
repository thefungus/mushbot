"use strict";
let async = require("async");
let util = require("../../util.js");
let database = require(util.DATABASE);

let servers;

function load(mb, cb) {
    async.parallel([
        loadServers
    ], cb);
}

function unload(mb, cb) {
    cb();
}

function loadServers(cb) {
    database.loadAll("subfeeds", (err, docs) => {
        if (err) {
            return cb(err);
        }
        servers = new Map();
        for (let doc of docs) {
            servers.set(doc._id, doc.data);
        }
        cb();
    });
}

function saveServer(server, data, cb) {
    database.saveData("subfeeds", server, data, cb);
}

function sendUpdate(id, mb, message, cb) {
    if (!mb.users.exists("id", id)) {
        return setTimeout(cb, 4);
    }
    mb.users.find("id", id).sendMessage(message);
    setTimeout(cb, 10000);
}

function sendUpdates(feed, mb, message, cb) {
    async.eachSeries(feed, (id, cb) => {
        sendUpdate(id, mb, message, cb);
    }, cb);
}

let commands = {
    subscribe: {
        names: ["subscribe", "sub"],
        allowPrivate: false,
        perms: [],
        userCd: 15,
        code(msg, args, argsStr, cmdName, char) {
            if (args.length !== 1) {
                msg.reply(
                    `To receive updates for a certain sub feed, use \`${char}sub (name)\`. Please don't use any spaces in the name.`
                );
                return;
            }
            if (!servers.has(msg.guild.id)) {
                msg.reply(
                    "This server doesn't have any feeds yet."
                );
                return;
            }
            let server = servers.get(msg.guild.id);
            let feed = argsStr.toLowerCase();
            if (!server[feed]) {
                msg.reply(
                    "This server doesn't have a feed with that name. Make sure you spelled it correctly."
                );
                return;
            }
            if (server[feed].indexOf(msg.author.id) > -1) {
                msg.reply(
                    `You are already subscribed to this feed. If you want to unsubscribe, use \`${char}unsub ${feed}\` instead.`
                );
                return;
            }
            server[feed].push(msg.author.id);
            saveServer(msg.guild.id, server, () => {
                msg.reply(
                    `Successfully subscribed to the \`${feed}\` feed! To unsubscribe, use \`${char}unsub ${feed}\`.`
                );
            });
        }
    },
    unsubscribe: {
        names: ["unsubscribe", "unsub"],
        allowPrivate: false,
        perms: [],
        code(msg, args, argsStr, cmdName, char) {
            if (args.length !== 1) {
                msg.reply(
                    `To stop receiving updates for a certain sub feed, use \`${char}unsub (name)\`. Please don't use any spaces in the name.`
                );
                return;
            }
            if (!servers.has(msg.guild.id)) {
                msg.reply(
                    "This server doesn't have any feeds."
                );
                return;
            }
            let server = servers.get(msg.guild.id);
            let feed = argsStr.toLowerCase();
            if (!server[feed]) {
                msg.reply(
                    "This server doesn't have a feed with that name. Make sure you spelled it correctly."
                );
                return;
            }
            if (server[feed].indexOf(msg.author.id) === -1) {
                msg.reply(
                    "You aren't subscribed to this feed."
                );
                return;
            }
            server[feed].splice(server[feed].indexOf(msg.author.id), 1);
            saveServer(msg.guild.id, server, () => {
                msg.reply(
                    `Successfully unsubscribed from the \`${feed}\` feed!`
                );
            });
        }
    },
    addfeed: {
        names: ["addfeed", "newfeed", "createfeed"],
        allowPrivate: false,
        perms: util.MOD,
        code(msg, args, argsStr, cmdName, char) {
            if (args.length !== 1) {
                msg.reply(
                    `To create a new sub feed, use \`${char}addfeed (name)\` (for example, \`${char}addfeed stream\`). Please don't use any spaces in the name.`
                );
                return;
            }
            if (!servers.has(msg.guild.id)) {
                servers.set(msg.guild.id, {});
            }
            let server = servers.get(msg.guild.id);
            let feed = argsStr.toLowerCase();
            if (server[feed]) {
                msg.reply(
                    `There is already a sub feed with that name. If you want to delete it, use \`${char}deletefeed ${feed}\`. If you want to send an update to this feed, use \`${char}feed ${feed} (message)\` instead.`
                );
                return;
            }
            server[feed] = [];
            saveServer(msg.guild.id, server, () => {
                msg.reply(
                    `Created a new sub feed: \`${feed}\`! Use \`${char}feed ${feed} (message)\` to send updates to this feed.`
                );
            });
        }
    },
    removefeed: {
        names: ["removefeed", "deletefeed", "delfeed"],
        allowPrivate: false,
        perms: util.MOD,
        code(msg, args, argsStr, cmdName, char) {
            if (args.length !== 1) {
                msg.reply(
                    `To remove a sub feed, use \`${char}deletefeed (name)\`. Please don't use any spaces in the name.`
                );
                return;
            }
            if (!servers.has(msg.guild.id)) {
                msg.reply(
                    "This server doesn't have any feeds yet."
                );
                return;
            }
            let server = servers.get(msg.guild.id);
            let feed = argsStr.toLowerCase();
            if (!server[feed]) {
                msg.reply(
                    "This server doesn't have a feed with that name. Make sure you spelled it correctly."
                );
                return;
            }
            delete server[feed];
            saveServer(msg.guild.id, server, () => {
                msg.reply(
                    `Successfully deleted the \`${feed}\` feed!`
                );
            });
        }
    },
    updatefeed: {
        names: ["updatefeed", "feed", "update"],
        allowPrivate: false,
        perms: util.MOD,
        code(msg, args, argsStr, cmdName, char) {
            if (args.length < 2) {
                msg.reply(
                    `To send an update to a feed, use \`${char}feed (name) (message)\`. Please don't use any spaces in the name.`
                );
                return;
            }
            if (!servers.has(msg.guild.id)) {
                msg.reply(
                    "This server doesn't have any feeds yet."
                );
                return;
            }
            let server = servers.get(msg.guild.id);
            let feed = args[0].toLowerCase();
            if (!server[feed]) {
                msg.reply(
                    "This server doesn't have a feed with that name. Make sure you spelled it correctly."
                );
                return;
            }
            if (!server[feed].length) {
                msg.reply(
                    "Nobody is subscribed to this feed yet!"
                );
                return;
            }
            msg.reply(
                "Okay, I'll send out the update!"
            );
            sendUpdates(server[feed], msg.client, args.slice(1).join(" "), () => {
                msg.reply(
                    "Done sending the update!"
                );
            });
        }
    }
};

function help() {
    return util.dedent`__Sub Feeds Plugin__
        This plugin allows moderators of a server to set up information feeds for users to subscribe to.
        Users can use the \`!subcribe (name)\` to receive updates on a given feed created by a moderator.
        When an update is released, mushbot will DM each subscribed user the new update information.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "subfeeds",
    help,
    load,
    unload,
    commands
};
