"use strict";
let Discord = require("discord.js");
let async = require("async");
let util = require("./util.js");
let database = require(util.DATABASE);
let plugins = require(util.PLUGINS);
let commands = require(util.COMMANDS);
let twitch = require(util.TWITCH);
let creds = require(util.CREDS);

let mb = new Discord.Client({
    autoReconnect: true,
    forceFetchUsers: true
});

mb.on("disconnect", () => {
    console.log("bot disconnected");
});

async.waterfall([
    (cb) => {
        mb.login(creds.discord)
            .then(() => {
                console.log("discord logged in");
                cb();
            })
            .catch(cb);
    },
    (cb) => {
        database.init(cb);
    },
    (cb) => {
        twitch.init(creds.twitch, cb);
    },
    (cb) => {
        plugins.loadAll(mb, cb);
    },
    (pluginInfo, cb) => {
        commands.init(mb, pluginInfo, cb);
    }
], (err) => {
    if (err) {
        console.log("launcher.js: init error");
        console.log(err);
        return;
    }
    console.log("successfully launched");
});
