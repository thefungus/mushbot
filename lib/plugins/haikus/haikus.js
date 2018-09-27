"use strict";
let Haikudos = require("haikudos");
let util = require("../../util.js");

function load(mb, cb) {
    cb();
}

function unload(mb, cb) {
    cb();
}

let commands = {
    haiku: {
        names: ["haiku", "haikus"],
        allowPrivate: true,
        perms: [],
        userCd: 20,
        channelCd: 12,
        desc: "Post a randomly-generated haiku.",
        code(msg) {
            Haikudos((haiku) => {
                msg.reply(`\n${haiku}`);
            });
            return "11";
        }
    }
};

function help() {
    return util.dedent`__Haikus Plugin__
        This plugin lets mushbot post random haikus.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "haikus",
    help,
    load,
    unload,
    commands
};
