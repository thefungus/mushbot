"use strict";
let util = require("../../util.js");

function load(mb, cb) {
    cb();
}

function unload(mb, cb) {
    cb();
}

let commands = {
    bigemoji: {
        names: ["bigemoji", "largeemoji", "emojibig", "emojilarge"],
        allowPrivate: true,
        perms: [],
        desc: "Enlarges an emoji.",
        code(msg, args) {
            if (!args.length) {
                msg.reply("You need to select an emoji to enlarge.");
                return;
            }
            let emoji = args[0];
            let re = /<(a)?:(.+):(\d+)>/.exec(emoji);
            if (re && re.length > 1) {
                let id = re[3];
                let type = re[1] ? "gif" : "png";
                let name = re[2];
                let embed = util.richEmbed()
                    .setImage(`https://cdn.discordapp.com/emojis/${id}.${type}`)
                    .setAuthor(name);
                msg.channel.send(embed);
                return;
            } else {
                msg.reply("Custom emoji not found.");
                return;
            }
        }
    }
};

function help() {
    return util.dedent`__Big Emoji Plugin__
        Plugin for displaying Emojis larger than normal so you can see them easier.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "bigemoji",
    help,
    load,
    unload,
    commands
};
