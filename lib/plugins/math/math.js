"use strict";
let util = require("../../util.js");

const math = require("mathjs");

function load(mb, cb) {
    cb();
}

function unload(cb) {
    cb();
}

let commands = {
    math: {
        names: ["math", "calc", "calculate", "eval", "evaluate"],
        allowPrivate: true,
        perms: [],
        desc: "Evaluates mathematical expressions.",
        code(msg, args, argsStr) {
            try {
                msg.reply(math.eval(argsStr));
            } catch (e) {
                msg.reply("Invalid expression.");
            }
        }
    }
};

function help() {
    return util.dedent`__Math Plugin__
        This plugin has commands related to math.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "math",
    help,
    load,
    unload,
    commands
};
