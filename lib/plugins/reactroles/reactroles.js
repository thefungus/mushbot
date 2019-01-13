"use strict";
let util = require("../../util.js");
let db = require(util.DATABASE);
let Async = require("async");

let settings;

function load(mb, cb) {
    loadSettings(mb, (err) => {
        if (err) {
            return cb(err);
        }
        mb.on("messageReactionAdd", addHandler);
        mb.on("messageReactionRemove", removeHandler);
        cb();
    });
}

function unload(mb, cb) {
    mb.removeListener("messageReactionAdd", addHandler);
    mb.removeListener("messageReactionRemove", removeHandler);
    cb();
}

function loadSettings(mb, cb) {
    settings = new Map();
    db.loadAll("reactroles", (err, docs) => {
        if (err) {
            return cb(err);
        }
        Async.each(docs, (doc, cb) => {
            if (mb.guilds.has(doc.data.guild)) {
                let gd = mb.guilds.get(doc.data.guild);
                if (gd.channels.has(doc.data.channel)) {
                    let ch = gd.channels.get(doc.data.channel);
                    ch.fetchMessage(doc._id)
                        .then(() => {
                            settings.set(doc._id, new Settings(doc.data));
                            cb();
                        })
                        .catch(err => {
                            cb(err);
                        });
                } else {
                    console.log("delete this record: no channel found", doc);
                }
            } else {
                console.log("delete this record: no guild found", doc);
            }
        }, (err) => {
            if (err) {
                return cb(err);
            }
            cb();
        });
    });
}

function saveSettings(id, data, cb) {
    db.saveData("reactroles", id, data, cb);
}

function addHandler(reaction, user) {
    if (!settings.has(reaction.message.id)) {
        return;
    }
    let sett = settings.get(reaction.message.id);
    if (sett.emojis[reaction.emoji.id]) {
        reaction.message.guild.fetchMember(user)
            .then((member) => {
                member.addRole(sett.emojis[reaction.emoji.id])
                    .catch(console.log);
            })
            .catch(console.log);
    }
}

function removeHandler(reaction, user) {
    if (!settings.has(reaction.message.id)) {
        return;
    }
    let sett = settings.get(reaction.message.id);
    if (sett.emojis[reaction.emoji.id]) {
        reaction.message.guild.fetchMember(user)
            .then((member) => {
                member.removeRole(sett.emojis[reaction.emoji.id])
                    .catch(console.log);
            })
            .catch(console.log);
    }
}

let commands = {
    addreactionrole: {
        names: ["addreactionrole", "setreactionrole", "addrolereaction", "setrolereaction"],
        allowPrivate: false,
        perms: ["fungus"],
        desc: "Bind a role to a specific reaction emoji on a message.",
        code(msg, args) {
            if (args.length !== 4) {
                msg.reply("Command usage: !addreactionrole messageid channel role emoji");
                return;
            }
            let id = args[0];
            let channel = msg.mentions.channels.first();
            channel.fetchMessage(id)
                .then((rMsg) => {
                    if (!settings.has(id)) {
                        settings.set(id, new Settings({
                            channel: channel.id,
                            guild: msg.guild.id
                        }));
                    }
                    let sett = settings.get(id);
                    let role = msg.mentions.roles.first();
                    let emojistr = args[args.length - 1];
                    let re = /<a?:.+:(\d+)>/.exec(emojistr);
                    if (re && re.length > 1) {
                        let eid = re[1];
                        if (!msg.client.emojis.has(eid)) {
                            msg.reply("I don't have that emoji.");
                            return;
                        }
                        rMsg.react(eid)
                            .then(() => {
                                sett.emojis[eid] = role.id;
                                saveSettings(id, sett, () => {
                                    msg.reply("Saved that role for that reaction!");
                                });
                            })
                            .catch(err => {
                                console.log(err);
                                msg.reply("There was an error with reacting to the message.");
                            });
                    } else {
                        rMsg.react(args[args.length - 1])
                            .then(() => {
                                sett.emojis[args[args.length - 1]] = role.id;
                                saveSettings(id, sett, () => {
                                    msg.reply("Saved that role for that reaction!");
                                });
                            })
                            .catch((e) => {
                                console.log(e);
                                console.log(args[1]);
                                msg.reply("Invalid emoji.");
                            });
                    }
                })
                .catch(err => {
                    console.log(err);
                    msg.reply("There was an error with getting that message ID.");
                });
        }
    },
    fixreactionrole: {
        names: ["fixreactionrole"],
        allowPrivate: false,
        perms: ["fungus"],
        desc: "Fix roles if discord fucked up and roles weren't added due to server downtime.",
        code(msg, args) {
            if (args.length !== 2) {
                msg.reply("Command usage: !fixreactionrole messageid channel");
                return;
            }
            if (!settings.has(args[0])) {
                msg.reply("That message doesn't have any roles bound to reactions.");
                return;
            }
            let sett = settings.get(args[0]);
            let channel = msg.mentions.channels.first();
            channel.fetchMessage(args[0])
                .then(rMsg => {
                    Async.each(rMsg.reactions, (r, cb) => {
                        let reaction = r[1];
                        if (reaction.emoji.id in sett.emojis) {
                            let a = true;
                            let after = "0";
                            Async.whilst(
                                () => {
                                    return a;
                                },
                                (cb) => {
                                    reaction.fetchUsers(100, {after})
                                        .then(users => {
                                            users.sort((a, b) => {
                                                a.id < b.id ? -1 : 1;
                                            });
                                            if (users.size !== 100) {
                                                a = false;
                                            }
                                            after = users.lastKey();
                                            Async.each(users, (u, cb) => {
                                                let user = u[1];
                                                msg.guild.fetchMember(user)
                                                    .then(member => {
                                                        if (!member.roles.has(sett.emojis[reaction.emoji.id])) {
                                                            member.addRole(sett.emojis[reaction.emoji.id])
                                                                .then(() => cb())
                                                                .catch(cb);
                                                        } else {
                                                            cb();
                                                        }
                                                    })
                                                    .catch(cb);
                                            }, cb);
                                        })
                                        .catch(cb);
                                },
                                cb
                            );
                        } else {
                            cb();
                        }
                    }, (err) => {
                        if (err) {
                            console.log(err);
                            msg.reply("Error with fetching guild member from user, check console.log");
                            return;
                        }
                        msg.reply("Done!");
                    });
                })
                .catch(err => {
                    console.log(err);
                    msg.reply("There was an error with getting that message ID.");
                });
        }
    }
};

function Settings(prev = {}) {
    this.emojis = prev.emojis || {};
    this.channel = prev.channel;
    this.guild = prev.guild;
}

function help() {
    return util.dedent`__Reaction Roles Plugin__
        Allows admins to set roles based on what users react to on a message.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "reactroles",
    help,
    load,
    unload,
    commands
};
