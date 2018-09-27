"use strict";
let util = require("../../util.js");

function load(mb, cb) {
    cb();
}

function unload(mb, cb) {
    cb();
}

let commands = {
    joindate: {
        names: ["joindate", "jd", "joined"],
        allowPrivate: false,
        perms: [],
        userCd: 30,
        desc: "Checks your join date.",
        code(msg) {
            let options = {
                weekday: "long", year: "numeric", month: "short",
                day: "numeric", hour: "2-digit", minute: "2-digit"
            };
            msg.reply(`You joined on ${(new Date(msg.member.joinedTimestamp))
                .toLocaleString("en-us", options)}`);
            return "10";
        }
    }
};

function help() {
    return util.dedent`__Join Date Plugin__
        This plugin lets you check your own server join date.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "joindate",
    help,
    load,
    unload,
    commands
};
