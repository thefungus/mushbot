"use strict";
let util = require("../../util.js");

const RELEASE_DATE = new Date("December 7, 2018 EST");

const SECOND = 1000;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;

function load(mb, cb) {
    cb();
}

function unload(mb, cb) {
    cb();
}

function getDays(time) {
    return Math.floor(time / DAY) || 0;
}

function getHours(time) {
    return Math.floor(
        (time -
            getDays(time) * DAY
        ) / HOUR) || 0;
}

function getMinutes(time) {
    return Math.floor(
        (time -
            getDays(time) * DAY -
            getHours(time) * HOUR
        ) / MINUTE) || 0;
}

function getSeconds(time) {
    return Math.floor(
        (time -
            getDays(time) * DAY -
            getHours(time) * HOUR -
            getMinutes(time) * MINUTE
        ) / SECOND) || 0;
}

let commands = {
    smush: {
        names: ["smush", "countdown"],
        allowPrivate: true,
        perms: [],
        channelCd: 30,
        desc: "Check how long we have to wait for Super Smash Bros. Ultimate to be released.",
        code(msg) {
            let time = RELEASE_DATE - new Date();
            msg.channel.send(
                util.dedent`${getDays(time).toString()} DAYS
                ${getHours(time).toString()} HOURS
                ${getMinutes(time).toString()} MINUTES
                ${getSeconds(time).toString()} SECONDS`
            );

            return "11";
        }
    }
};

function help() {
    return util.dedent`__Smush Plugin__
        Plugin for commands related to Smush.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "smush",
    help,
    load,
    unload,
    commands
};
