"use strict";
let util = require("../../util.js");
let database = require(util.DATABASE);

let settings;

function load(mb, cb) {
    loadSettings((err) => {
        if (err) {
            return cb(err);
        }
        mb.on("guildMemberAdd", joinHandler);
        mb.on("guildMemberRemove", leaveHandler);
        cb();
    });
}

function unload(mb, cb) {
    mb.removeListener("guildMemberAdd", joinHandler);
    mb.removeListener("guildMemberRemove", leaveHandler);
    cb();
}

function joinHandler(member) {
    let user = member;
    let server = member.guild;
    if (!settings.has(server.id)) {
        return;
    }
    let sett = settings.get(server.id);
    if (sett.welcomePub && sett.greetChannel) {
        if (!server.channels.exists("id", sett.greetChannel)) {
            return;
        }
        let message = sett.welcomePub.replace(/\{\{user\}\}/, `${user.user}`);
        server.channels.find("id", sett.greetChannel).send(message);
    }
    if (sett.welcomePm) {
        let message = sett.welcomePm.replace(/\{\{user\}\}/, user.user.username);
        user.send(message);
    }
}

function leaveHandler(member) {
    let user = member;
    let server = member.guild;
    if (!settings.has(server.id)) {
        return;
    }
    let sett = settings.get(server.id);
    if (sett.goodbyeMsg && sett.greetChannel) {
        if (!server.channels.find("id", sett.greetChannel)) {
            sett.greetChannel = "";
            saveSettings(server.id, sett);
            return;
        }
        let message = sett.goodbyeMsg.replace(/\{\{user\}\}/, user.user.username);
        server.channels.find("id", sett.greetChannel).send(message);
    }
}

function loadSettings(cb) {
    database.loadAll("greeting", (err, docs) => {
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

function saveSettings(server, data, cb) {
    database.saveData("greeting", server, data, cb);
}

let commands = {
    setwelcome: {
        names: ["setwelcome", "setjoin"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "(mods) Set the welcome message or the channel to send it in.",
        code(msg, args, argsStr, cmdName, char) {
            if (!settings.get(msg.guild.id)) {
                settings.set(msg.guild.id, new Settings());
            }
            let sett = settings.get(msg.guild.id);
            switch (args[0]) {
                case "public":
                case "pub":
                case "msg":
                case "message":
                    if (args.length < 2 || !args[1]) {
                        sett.welcomePub = "";
                        saveSettings(msg.guild.id, sett, () => {
                            msg.reply(
                                "Public welcome message cleared!"
                            );
                        });
                        return;
                    }
                    sett.welcomePub = args.slice(1).join(" ");
                    saveSettings(msg.guild.id, sett, () => {
                        msg.reply(
                            `Public welcome message set! Don't forget to set the welcome channel with \`${char}setwelcome channel [name]\`!`
                        );
                    });
                    return;
                case "private":
                case "priv":
                case "pm":
                    if (args.length < 2 || !args[1]) {
                        sett.welcomePm = "";
                        saveSettings(msg.guild.id, sett, () => {
                            msg.reply(
                                "Private welcome message cleared!"
                            );
                        });
                        return;
                    }
                    sett.welcomePm = args.slice(1).join(" ");
                    saveSettings(msg.guild.id, sett, () => {
                        msg.reply(
                            "Private welcome message set!"
                        );
                    });
                    return;
                case "channel":
                case "ch": {
                    if (args.length < 2 || !args[1]) {
                        sett.greetChannel = msg.guild.channels.first().id;
                        saveSettings(msg.guild.id, sett, () => {
                            msg.reply(
                                `The greeting channel has been set to <#${sett.greetChannel}>!`
                            );
                        });
                        return;
                    }
                    let channel = util.getChannel(args[1]);
                    if (channel) {
                        if (msg.guild.channels.exists("id", channel)) {
                            sett.greetChannel = channel;
                            saveSettings(msg.guild.id, sett, () => {
                                msg.reply(
                                    `The greeting channel has been set to <#${channel}>!`
                                );
                            });
                            return;
                        }
                        msg.reply(
                            "Uh oh! Looks like that channel is invalid. Check to make sure you spelled the name correctly and that the channel still exists."
                        );
                        return;
                    }
                    if (msg.guild.channels.exists("name", args[1])) {
                        let channel = msg.guild.channels.find("name", args[1]);
                        sett.greetChannel = channel.id;
                        saveSettings(msg.guild.id, sett, () => {
                            msg.reply(
                                `The greeting channel has been set to <#${channel.id}>!`
                            );
                        });
                        return;
                    }
                    msg.reply(
                        "Uh oh! Looks like that channel is invalid. Check to make sure you spelled the name correctly and that the channel still exists."
                    );
                    return;
                }
                default:
                    msg.reply(
                        util.dedent`To set up a welcome message, use \`${char}setwelcome [public/private] [message]\` (for example, \`${char}setwelcome public Welcome, {{user}}!\`).
                        Using \`public\` sends a message to a channel, and \`private\` sends a message to the new user privately.
                        The keyword \`{{user}}\` in the message will automatically be replaced with the user's name.
                        To get rid of the message, just use \`${char}setwelcome [public/private]\` without a message.
                        You also need to set the channel where the welcome message will be sent with \`${char}setwelcome channel [channel name]\`.`
                    );
            }
        }
    },
    setgoodbye: {
        names: ["setgoodbye", "setleave"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "(mods) Set the goodbye message or the channel to send it in.",
        code(msg, args, argsStr, cmdName, char) {
            if (!settings.get(msg.guild.id)) {
                settings.set(msg.guild.id, new Settings());
            }
            let sett = settings.get(msg.guild.id);
            switch (args[0]) {
                case "msg":
                case "message":
                    if (args.length < 2 || !args[1]) {
                        sett.goodbyeMsg = "";
                        saveSettings(msg.guild.id, sett, () => {
                            msg.reply(
                                "Goodbye message cleared!"
                            );
                        });
                        return;
                    }
                    sett.goodbyeMsg = args.slice(1).join(" ");
                    saveSettings(msg.guild.id, sett, () => {
                        msg.reply(
                            `Goodbye message set! Don't forget to set the welcome channel with \`${char}setwelcome channel [name]\`!`
                        );
                    });
                    return;
                case "channel":
                case "ch": {
                    if (args.length < 2 || !args[1]) {
                        sett.greetChannel = msg.guild.channels.first().id;
                        saveSettings(msg.guild.id, sett, () => {
                            msg.reply(
                                `The greeting channel has been set to <#${sett.greetChannel}>!`
                            );
                        });
                        return;
                    }
                    let channel = util.getChannel(args[1]);
                    if (channel) {
                        if (msg.guild.channels.exists("id", channel)) {
                            sett.greetChannel = channel;
                            saveSettings(msg.guild.id, sett, () => {
                                msg.reply(
                                    `The greeting channel has been set to <#${channel}>!`
                                );
                            });
                            return;
                        }
                        msg.reply(
                            "Uh oh! Looks like that channel is invalid. Check to make sure you spelled the name correctly and that the channel still exists."
                        );
                        return;
                    }
                    if (msg.guild.channels.exists("name", args[1])) {
                        let channel = msg.guild.channels.find("name", args[1]);
                        sett.greetChannel = channel.id;
                        saveSettings(msg.guild.id, sett, () => {
                            msg.reply(
                                `The greeting channel has been set to <#${channel.id}>!`
                            );
                        });
                        return;
                    }
                    msg.reply(
                        "Uh oh! Looks like that channel is invalid. Check to make sure you spelled the name correctly and that the channel still exists."
                    );
                    return;
                }
                default:
                    msg.reply(
                        util.dedent`To set up a goodbye message, use \`${char}setgoodbye msg [message]\` (for example, \`${char}setgoodbye msg Goodbye, {{user}}, you will be missed :(\`).
                        The keyword \`{{user}}\` in the message will automatically be replaced with the user's name.
                        To get rid of the message, just use \`${char}setgoodbye msg\` without a message.
                        You also need to set the channel where the goodbye message will be sent with \`${char}setgoodbye channel [channel name]\` unless you've already done so for the welcome message.`
                    );
            }
        }
    },
    welcome: {
        names: ["welcome"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "(mods) Display the welcome message or channel.",
        code(msg, args, argsStr, cmdName, char) {
            if (!settings.get(msg.guild.id)) {
                settings.set(msg.guild.id, new Settings());
            }
            let sett = settings.get(msg.guild.id);
            switch ((args[0] || "").toLowerCase()) {
                case "public":
                case "pub":
                case "msg":
                case "message":
                    if (!sett.welcomePub) {
                        msg.reply(
                            `A public welcome message hasn't been set yet. Set a message with \`${char}setwelcome public [message]\`.`
                        );
                        return;
                    }
                    msg.reply(
                        `Here is the server's public welcome message:\n${sett.welcomePub}`
                    );
                    return;
                case "private":
                case "priv":
                case "pm":
                    if (!sett.welcomePm) {
                        msg.reply(
                            `A private welcome message hasn't been set yet. Set a message with \`${char}setwelcome private [message]\`.`
                        );
                        return;
                    }
                    msg.reply(
                        `Here is the server's private welcome message:\n${sett.welcomePm}`
                    );
                    return;
                case "channel":
                case "ch":
                    if (!sett.greetChannel) {
                        msg.reply(
                            `A greeting channel hasn't been set yet. Set a channel with \`${char}setwelcome channel [channel name]\`.`
                        );
                        return;
                    }
                    msg.reply(
                        `The server's greeting channel is set to <#${sett.greetChannel}>.`
                    );
                    return;
                default:
                    msg.reply(
                        util.dedent`Use \`${char}welcome [public/private]\` to display the public or private welcome messages.
                        You can also check the greeting channel with \`${char}welcome channel\`.`
                    );
            }
        }
    },
    goodbye: {
        names: ["goodbye"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "(mods) Display the goodbye message or channel.",
        code(msg, args, argsStr, cmdName, char) {
            if (!settings.get(msg.guild.id)) {
                settings.set(msg.guild.id, new Settings());
            }
            let sett = settings.get(msg.guild.id);
            switch ((args[0] || "").toLowerCase()) {
                case "msg":
                case "message":
                    if (!sett.welcomePub) {
                        msg.reply(
                            `A goodbye message hasn't been set yet. Set a message with \`${char}setgoodbye msg [message]\`.`
                        );
                        return;
                    }
                    msg.reply(
                        `Here is the server's goodbye message:\n${sett.goodbyeMsg}`
                    );
                    return;
                case "channel":
                case "ch":
                    if (!sett.greetChannel) {
                        msg.reply(
                            `A greeting channel hasn't been set yet. Set a channel with \`${char}setgoodbye channel [channel name]\`.`
                        );
                        return;
                    }
                    msg.reply(
                        `The server's greeting channel is set to <#${sett.greetChannel}>.`
                    );
                    return;
                default:
                    msg.reply(
                        util.dedent`Use \`${char}goodbye msg\` to display the server's goodbye message.
                        You can also check the greeting channel with \`${char}goodbye channel\`.`
                    );
            }
        }
    }
};

function Settings(prev = {}) {
    this.welcomePub = prev.welcomePub || "";
    this.welcomePm = prev.welcomePm || "";
    this.goodbyeMsg = prev.goodbyeMsg || "";
    this.greetChannel = prev.greetChannel || "";
}

function help() {
    return util.dedent`__Greeting Plugin__
        This plugin allows mushbot to automatically greet new users to the server, and also bid farewell to users leaving the server.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "greeting",
    help,
    load,
    unload,
    commands
};
