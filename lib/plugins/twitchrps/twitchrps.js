"use strict";
let util = require("../../util.js");
let twitch = require(util.TWITCH);

function load(mb, cb) {
    cb();
}

function unload(mb, cb) {
    cb();
}

let twitchCommands = {
    rps: {
        names: ["rps", "rockpaperscissors", "countdown"],
        perms: ["mods"],
        channelCd: 10,
        desc: "(mods) Initiate the 3-2-1 countdown.",
        code(channel) {
            twitch.sendMessage(channel, "5", () => {
                setTimeout(() => {
                    twitch.sendMessage(channel, "4", () => {
                        setTimeout(() => {
                            twitch.sendMessage(channel, "3", () => {
                                setTimeout(() => {
                                    twitch.sendMessage(channel, "2", () => {
                                        setTimeout(() => {
                                            twitch.sendMessage(channel, "1");
                                        }, 1100);
                                    });
                                }, 1100);
                            });
                        }, 1100);
                    });
                }, 1100);
            });
            return "01";
        }
    }
};

function help() {
    return util.dedent`__Twitch RPS Plugin__
        This plugin is a _really_ simple rock paper scissors plugin. It counts down from 3. That's it.

        Twitch Commands:
        ${util.generateCommandsInfo(twitchCommands)}`;
}

module.exports = {
    name: "twitchrps",
    help,
    load,
    unload,
    twitchCommands
};
