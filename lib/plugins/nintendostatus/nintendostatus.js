"use strict";
let request = require("request");
let util = require("../../util.js");

let cache = null;

function load(mb, cb) {
    cb();
}

function unload(mb, cb) {
    cb();
}

function fetchStatus(cb) {
    request({
        uri: "https://www.nintendo.co.jp/netinfo/en_US/status.json",
        headers: {
            "Host": "www.nintendo.co.jp"
        }
    }, (err, res, body) => {
        if (err) {
            return cb(true);
        }
        let json;
        try {
            json = JSON.parse(/getJSON\((.+)\);/.exec(body)[1]);
        } catch (e) {
            return cb(true);
        }
        cache = {
            time: Date.now(),
            json
        };
        cb(null);
    });
}

function displayStatus() {
    let json = cache.json;
    let embed = util.richEmbed()
        .setTitle("Nintendo Switch Server Status")
        .setURL("https://www.nintendo.com/consumer/network/en_na/network_status.jsp")
        .setColor(16711680);

    if (!json.temporary_maintenances || json.temporary_maintenances.length === 0) {
        embed.setDescription("There are no maintenances in progress, and there are no planned future maintenances. Check again later for maintenance updates.");
    } else {
        let one = false;
        for (let maint of json.temporary_maintenances) {
            if (maint.event_status != "3" && maint.platform.indexOf("Nintendo Switch") > -1) {
                one = true;
                embed.addField(
                    maint.software_title,
                    util.dedent`${maint.message}
                    Time: From ${maint.begin} to ${maint.end} PST`
                );
            }
        }
        if (!one) {
            embed.setDescription("There are no maintenances in progress, and there are no planned future maintenances. Check again later for maintenance updates.");
        }
    }
    return embed;
}

let commands = {
    nintendostatus: {
        names: ["nintendostatus", "ninstatus", "ninstat", "ninstats"],
        allowPrivate: true,
        perms: [],
        channelCd: 90,
        desc: "Check the status of Nintendo's servers.",
        code(msg) {
            if (!cache || Date.now() - cache.time > 1000 * 60 * 3) {
                fetchStatus((err) => {
                    if (err) {
                        msg.reply(
                            "There was an error with fetching the Nintendo server status. Maybe try again later?"
                        );
                        return;
                    }
                    msg.channel.send(displayStatus());
                });
                return;
            }
            msg.channel.send(displayStatus());
            return "01";
        }
    }
};

function help() {
    return util.dedent`__Nintendo Status Plugin__
        This plugin lets you check the status of Nintendo's servers. Info pulled from https://www.nintendo.co.jp/netinfo/en_US/index.html.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "nintendostatus",
    help,
    load,
    unload,
    commands
};
