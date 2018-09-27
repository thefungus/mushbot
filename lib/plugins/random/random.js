"use strict";
let util = require("../../util.js");

function load(mb, cb) {
    cb();
}

function unload(mb, cb) {
    cb();
}

let commands = {
    coin: {
        names: ["coin", "cointoss", "coinflip", "flipcoin", "tosscoin"],
        allowPrivate: true,
        perms: [],
        userCd: 12,
        channelCd: 5,
        desc: "Flip a coin with two sides.",
        code(msg) {
            msg.reply(
                "Tossing a coin..."
            );
            let outcome = Math.floor(Math.random() * 2) ? "Heads" : "Tails";
            setTimeout(() => {
                msg.reply(
                    `The coin landed on ${outcome}!`
                );
            }, this.channelCd * 1000);
            return "11";
        }
    },
    dice: {
        names: ["get", "roll", "dice"],
        allowPrivate: true,
        perms: [],
        userCd: 17.4,
        desc: "Roll an n-sided die with `!dice n`. Defaults to 6 sides.",
        code(msg, args) {
            if (msg.channel.type === "text" && msg.channel.name === "gets") {
                msg.reply(Math.floor(Math.random() * 900000000 + 100000000));
                return;
            }
            let sides = args.length ? parseInt(args[0]) : 6;
            if (isNaN(sides) || sides < 1) {
                msg.reply(
                    "You gotta give me a valid number of sides!"
                );
                return;
            }
            let roll = Math.floor(Math.random() * sides + 1);
            msg.reply(`You rolled ${roll}!`);
            return "10";
        }
    }
};

function help() {
    return util.dedent`__Random Plugin__
        This plugin features a couple commands that rely on randomness!

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "random",
    help,
    load,
    unload,
    commands
};
