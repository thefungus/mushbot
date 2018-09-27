"use strict";
let util = require("../../util.js");
let cmds = require(util.COMMANDS);
let database = require(util.DATABASE);

let info;

function load(mb, cb) {
    loadCommands((err) => {
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
    let char = msg.channel.type === "dm" ? "!" : cmds.getCommandChar(msg.guild.id);
    if (msg.content.charAt(0) !== char) {
        return;
    }
    if (msg.author.equals(msg.client.user)) {
        return;
    }
    let args = msg.content.substr(1).split(" ");
    let cmd = args.shift().toLowerCase();
    if (cmd.indexOf("set") === 0 && info.has(cmd.slice(3))) {
        executeSetInfo(msg, cmd.slice(3), args);
    } else if (info.has(cmd)) {
        executeGetInfo(msg, cmd, args, char);
    }
}

function executeSetInfo(msg, cmd, args) {
    let data = args.join(" ").trim();
    setInfo(cmd, msg.author.id, data, (err) => {
        if (err) {
            msg.reply(
                `There was an error with setting your ${cmd} info. Please try again later.`
            );
            return;
        }
        let message;
        if (data) {
            message = `Successfully set your ${cmd} to \`${data}\`!`;
        } else {
            message = `Successfully deleted your ${cmd} info!`;
        }
        msg.reply(message);
    });
}

function setInfo(cmd, id, data, cb) {
    if (!data || data.length === 0) {
        return database.deleteData(`info-${cmd}`, id, cb);
    }
    database.saveData(`info-${cmd}`, id, data, cb);
}

function executeGetInfo(msg, cmd, args, char) {
    let user;
    if (args.length) {
        user = util.getUser(args[0]);
        if (!user) {
            let name = args.join(" ");
            if (name.indexOf("@") === 0) {
                name = name.slice(1);
            }
            user = util.getUserByName(msg.client, msg.author.id, name);
            if (!user) {
                msg.reply(
                    "I couldn't find that user. Make sure you @mentioned them or typed their name correctly."
                );
                return;
            }
        }
    } else {
        user = msg.author.id;
    }
    let isSelf = user === msg.author.id;
    getInfo(cmd, user, (err, doc) => {
        if (err) {
            msg.reply(
                `Sorry, there was an error with getting \`${cmd}\` info. Maybe try again later?`
            );
            return;
        }
        if (!doc) {
            msg.reply(
                `${isSelf ? "You don't" : "That user doesn't"} have info set for \`${cmd}\` yet. ${isSelf ? "You can" : "They can"} use the \`${char}set${cmd} [info]\` command to save info.`
            );
            return;
        }
        msg.channel.sendMessage(
            `[${isSelf ? msg.author.username : msg.client.users.find("id", user).username}] \`${cmd}\`: ${doc.data}`
        );
    });
}

function getInfo(cmd, id, cb) {
    database.loadData(`info-${cmd}`, id, cb);
}

function saveCommand(cmd, cb) {
    info.add(cmd);
    database.saveData("info", "cmds", Array.from(info), cb);
}

function loadCommands(cb) {
    database.loadData("info", "cmds", (err, doc) => {
        if (err) {
            return cb(err);
        }
        info = new Set(doc ? (doc.data || []) : []);
        cb();
    });
}

let commands = {
    addinfocmd: {
        names: ["addinfocmd"],
        allowPrivate: true,
        perms: ["fungus"],
        code(msg, args) {
            if (args.length !== 1) {
                msg.reply(
                    "You gotta supply one argument, dimwit."
                );
                return;
            }
            let cmd = args[0].toLowerCase().trim();
            if (info.has(cmd)) {
                msg.reply(
                    "There's already an info command with that name. Choose a different name."
                );
                return;
            }
            if (cmds.checkCommand(cmd)) {
                msg.reply(
                    "A plugin already has a command with that name. Choose a different name."
                );
                return;
            }
            saveCommand(cmd, (err) => {
                if (err) {
                    msg.reply(
                        "There was an error with saving the new info command. Try again later or something."
                    );
                    return;
                }
                msg.reply(
                    `Successfully created a new info command: ${cmd}!`
                );
            });
        }
    }
};

function help() {
    return util.dedent`__Info Plugin__
        This plugin keeps a database of various information for certain custom commands that anyone can use.
        To set information for one of the listed commands below, add \`set\` before the command (for example, \`!setabout [info]\`).
        To display your information, use the command as usual (for example, \`!about\`).
        You can also display others' information by mentioning them (for example, \`!about @mushbot\`).

        __Commands list__: \`!${Array.from(info).join("`, `!")}\`

        If you feel your server could benefit from more of these commands, contact fungus#9999 please! :)`;
}

module.exports = {
    name: "info",
    help,
    load,
    unload,
    commands
};
