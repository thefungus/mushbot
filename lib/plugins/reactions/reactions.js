"use strict";
let util = require("../../util.js");
let database = require(util.DATABASE);

let settings;

function load(mb, cb) {
    loadReactions((err) => {
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
    if (msg.author.equals(msg.client.user)) {
        return;
    }
    if (msg.channel.type !== "text") {
        return;
    }
    let str = msg.content.split(/\s+/);
    if (!str || !str.length) {
        return;
    }
    if (!settings.has(msg.guild.id)) {
        return;
    }
    let sett = settings.get(msg.guild.id);
    for (let i of str) {
        if (sett[i.toLowerCase()]) {
            msg.react(sett[i.toLowerCase()])
                .catch(console.log);
            return;
        }
    }
}

function loadReactions(cb) {
    settings = new Map();
    database.loadAll("reactions", (err, docs) => {
        if (err) {
            return cb(err);
        }
        for (let doc of docs) {
            settings.set(doc._id, doc.data);
        }
        cb();
    });
}

function saveReaction(server, data, cb) {
    database.saveData("reactions", server, data, cb);
}

let commands = {
    addreact: {
        names: ["addreact", "addreaction"],
        allowPrivate: false,
        perms: util.MOD,
        code(msg, args) {
            if (args.length !== 2) {
                msg.reply(
                    "You gotta supply two arguments: a word to react to and an emoji to react with."
                );
                return;
            }
            let sett;
            if (!settings.has(msg.guild.id)) {
                sett = {};
                settings.set(msg.guild.id, sett);
            } else {
                sett = settings.get(msg.guild.id);
            }
            if (sett[args[0].toLowerCase()]) {
                msg.reply("A reaction to that word already exists.");
                return;
            }
            let emoji = args[1];
            let re = /<a?:.+:(\d+)>/.exec(emoji);
            if (re && re.length > 1) {
                let id = re[1];
                if (!msg.client.emojis.has(id)) {
                    msg.reply("I don't have access to that emoji.");
                    return;
                }
                sett[args[0].toLowerCase()] = id;
                saveReaction(msg.guild.id, sett, () => {
                    msg.reply("Reaction saved!");
                });
            } else {
                msg.react(args[1])
                    .then(() => {
                        sett[args[0].toLowerCase()] = args[1];
                        saveReaction(msg.guild.id, sett, () => {
                            msg.reply("Reaction saved!");
                        });
                    })
                    .catch((e) => {
                        console.log(e);
                        console.log(args[1]);
                        msg.reply("Invalid emoji.");
                    });
            }
        }
    },
    deletereact: {
        names: ["deletereaction", "deletereact", "delreact", "delreaction", "removereaction", "removereact", "remreaction", "remreact"],
        allowPrivate: false,
        perms: util.MOD,
        code(msg, args) {
            if (args.length !== 1) {
                msg.reply(
                    "You gotta supply one argument: the word to delete a reaction for."
                );
                return;
            }
            if (!settings.has(msg.guild.id)) {
                msg.reply(
                    "This server doesn't have any words to react to."
                );
                return;
            }
            let sett = settings.get(msg.guild.id);
            if (!sett[args[0].toLowerCase()]) {
                msg.reply("That word isn't being reacted to.");
                return;
            }
            delete sett[args[0].toLowerCase()];
            saveReaction(msg.guild.id, sett, () => {
                msg.reply("Reaction to that word removed!");
            });
        }
    }
};

function help() {
    return util.dedent`__Reactions Plugin__
    Plugin that allows mushbot to react to certain words or messages.

    Commands:
    ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "reactions",
    help,
    load,
    unload,
    commands
};
