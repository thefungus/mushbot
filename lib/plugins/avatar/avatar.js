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
        code(msg, args, argsStr) {
            if (msg.channel.id == "82343511336157184") {
                return;
            }
            let user;
            if (msg.mentions.members.size !== 0) {
                user = msg.mentions.members.first();
                if (user.id == "282357771905662977") {
                    user = msg.member;
                }
            } else {
                if (!args.length) {
                    user = msg.member;
                } else {
                    // by ID
                    if (msg.guild.members.has(args[0])) {
                        user = msg.guild.members.get(args[0]);
                    } else {
                        // by username#discriminator
                        let [ username, discriminator ] = argsStr.replace("@", "").split("#");
                        user = msg.guild.members.find(val => val.user.username.toLowerCase() === username.toLowerCase() && val.user.discriminator === discriminator);
                        if (!user) {
                            // by nickname or username
                            user = msg.guild.members.find(val => val.user.username.toLowerCase() == argsStr.toLowerCase() || (val.nickname && val.nickname.toLowerCase() == argsStr.toLowerCase()));
                            if (!user) {
                                // name or username starts with
                                user = msg.guild.members.find(val => val.user.username.toLowerCase().indexOf(argsStr.toLowerCase()) == 0 || (val.nickname && val.nickname.toLowerCase().indexOf(argsStr.toLowerCase()) == 0));
                                if (!user) {
                                    // name or username contain
                                    user = msg.guild.members.find(val => val.user.username.toLowerCase().indexOf(argsStr.toLowerCase()) > -1 || (val.nickname && val.nickname.toLowerCase().indexOf(argsStr.toLowerCase()) > -1));
                                    if (!user) {
                                        msg.reply("User not found.");
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }
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
            let url;
            if (msg.guild.iconURL.indexOf("a_") > -1) {
                url = msg.guild.iconURL.replace(".jpg", ".gif");
            } else {
                url = msg.guild.iconURL;
            }
            let embed = util.richEmbed()
                .setImage(url)
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
