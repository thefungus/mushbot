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
    let payload = "**__Nintendo Server Status__**";

    /*payload += "\n\n__Current Maintenance__\n";
    if (!json.operational_statuses || json.operational_statuses.length === 0) {
        payload += "\nThere are no maintenances in progress at the moment.";
    } else {
        let one = false;
        for (let maint of json.operational_statuses) {
            if (maint.utc_del_time && new Date(maint.utc_del_time + " UTC") - Date.now() < 0) {
                continue;
            }
            one = true;
            payload += util.dedent`\n**${maint.platform.join(", ")} - ${maint.software_title}** - ${maint.message}
                **Time**: From ${maint.begin} - ${maint.end} Pacific Time
                **Services Affected**: ${maint.services.join(", ")}\n`;
        }
        if (!one) {
            payload += "\nThere are no maintenances in progress at the moment.";
        }
    }

    payload += "\n\n__Future Maintenance__\n";*/
    if (!json.temporary_maintenances || json.temporary_maintenances.length === 0) {
        payload += "\nThere are no maintenances in progress, and there are no planned future maintenances. Check again later for maintenance updates.";
    } else {
        let maints = [[], []];
        let one = false;
        for (let maint of json.temporary_maintenances) {
            if (!maints[maint.event_status]) {
                continue;
            }
            one = true;
            maints[maint.event_status].push(util.dedent`**${maint.platform.join(", ")} - ${maint.software_title}** - ${maint.message}
                **Time**: From ${maint.begin} - ${maint.end} Pacific Time
                **Services Affected**: ${maint.services.join(", ")}\n`);
        }
        if (!one) {
            payload += "\nThere are no maintenances in progress, and there are no planned future maintenances. Check again later for maintenance updates.";
        } else {
            if (maints[1].length) {
                payload += `\n\n__Current Maintenance__\n\n${maints[1].join("\n")}`;
            }
            if (maints[0].length) {
                payload += `\n\n__Upcoming Maintenance__\n\n${maints[0].join("\n")}`;
            }
        }
    }
    return payload;
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
                    msg.channel.sendMessage(displayStatus());
                });
                return;
            }
            msg.channel.sendMessage(displayStatus());
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
