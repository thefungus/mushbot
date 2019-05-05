"use strict";
let util = require("../../util.js");

function load(mb, cb) {
    cb();
}

function unload(mb, cb) {
    cb();
}

let commands = {
    avatar: {
        names: ["avatar", "avi", "profilepic", "pp"],
        allowPrivate: false,
        perms: [],
        channelCd: 10,
        desc: "Display a user's Discord avatar.",
        code(msg) {
            let user;
            if (msg.mentions.members.size !== 0) {
                user = msg.mentions.members.first();
            } else {
                user = msg.member;
            }
            let embed = util.richEmbed()
                .setImage(user.user.displayAvatarURL)
                .setAuthor(`${user.displayName}'s avatar`);
            msg.channel.send(embed);
            return "11";
        }
    },
    serveravatar: {
        names: ["serveravatar", "serveravi", "serverpic"],
        allowPrivate: false,
        perms: [],
        channelCd: 60,
        desc: "Display the current server's icon.",
        code(msg) {
            let embed = util.richEmbed()
                .setImage(msg.guild.iconURL)
                .setAuthor(`Server icon for ${msg.guild.name}`);
            msg.channel.send(embed);
            return "11";
        }
    }
};

function help() {
    return util.dedent`__Avatar Plugin__
        Plugin for displaying Discord user and server avatars.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "avatar",
    help,
    load,
    unload,
    commands
};
