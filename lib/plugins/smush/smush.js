"use strict";
let util = require("../../util.js");
let request = require("request");
let { parse } = require("node-html-parser");

let cache = null;

function load(mb, cb) {
    cb();
}

function unload(mb, cb) {
    cb();
}

function getPatchNotes(v, cb) {
    if (!cache || Date.now() - cache.time > 1000 * 60 * 3) {
        request.get(
            "https://en-americas-support.nintendo.com/app/answers/detail/a_id/42809/p/897",
            (err, res) => {
                if (err) {
                    console.log(err);
                    return cb("Couldn't get patch notes information at this time.");
                }
                cache = {
                    html: parse(res.body),
                    time: Date.now()
                };
                displayPatchNotes(v, cb);
            }
        );
    } else {
        displayPatchNotes(v, cb);
    }
}

function displayPatchNotes(v, cb) {
    let version;
    if (v) {
        let sub = cache.html.querySelector("article .tree").childNodes[1].querySelectorAll("a");
        for (let i of sub) {
            if (i.attributes.name === v) {
                version = i.firstChild.text;
                break;
            }
        }
        if (!version) {
            v = cache.html.querySelector("article .tree").childNodes[1].querySelectorAll("a")[0].attributes.name;
            version = cache.html.querySelector("article .tree").childNodes[1].childNodes[1].firstChild.firstChild.text;
        }
    } else {
        v = cache.html.querySelector("article .tree").childNodes[1].querySelectorAll("a")[0].attributes.name;
        version = cache.html.querySelector("article .tree").childNodes[1].childNodes[1].firstChild.firstChild.text;
    }

    let embed = util.richEmbed()
        .setTitle(version)
        .setColor(0xFF0000)
        .setURL("https://en-americas-support.nintendo.com/app/answers/detail/a_id/42809/p/897");

    let patch = cache.html.querySelector(`#${v}`).querySelector("ul").querySelectorAll("");
    if (patch.length === 1) {
        embed.setDescription(patch[0].firstChild.text);
    } else {
        for (let i of patch) {
            embed.addField(
                i.querySelector("strong").firstChild.text,
                "- " + i.querySelector("ul").structuredText.replace(/\n+/g, "\n- ")
            );
        }
    }
    return cb(embed);
}

let commands = {
    smush: {
        names: ["smush", "countdown"],
        allowPrivate: true,
        perms: [],
        channelCd: 30,
        desc: "Check how long we have to wait for Super Smash Bros. Ultimate to be released.",
        code(msg) {
            msg.channel.send("Smush is out!");
            return "11";
        }
    },
    smashpatch: {
        names: ["smashpatch", "latestpatch"],
        allowPrivate: true,
        perms: [],
        channelCd: 30,
        desc: "Check the latest patch for Smash Ultimate.",
        code(msg, args) {
            let v = null;
            if (args.length) {
                v = "v" + args.join(" ").replace(/[v|0|.| ]/g, "");
            }
            getPatchNotes(v, (reply) => {
                msg.channel.send(reply);
            });
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
