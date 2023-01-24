"use strict";
let request = require("request");
let util = require("../../util.js");

const THUMBNAIL = "https://is1-ssl.mzstatic.com/image/thumb/Purple128/v4/3f/29/60/3f2960b8-284f-acc8-47f6-50cb33a87e18/AppIcon-1x_U007emarketing-85-220-0-6.png/246x0w.jpg";

function load(mb, cb) {
    cb();
}

function unload(mb, cb) {
    cb();
}

function getDefinition(term, index, cb) {
    request({
        uri: `http://api.urbandictionary.com/v0/define?term=${term}`,
        json: true
    }, (err, res, body) => {
        if (err || !body || !body.list || !body.list.length) {
            console.log(err);
            return cb("errsite");
        }
        let i = Math.max(index > body.list.length ? body.list.length : index, 1);

        return cb(null, body.list[i-1]);
    });
}

let commands = {
    define: {
        names: ["define", "def", "urbandictionary", "urbandict", "urbandic"],
        allowPrivate: false,
        perms: [],
        channelCd: 20,
        desc: "Get the definition of a word or phrase!",
        code(msg, args) {
            if (!args.length) {
                return;
            }
            if (msg.channel.id == "82343511336157184") {
                return;
            }
            let i = 0;
            let query;
            if (args.length > 1) {
                let num = parseInt(args[args.length-1]);
                if (!isNaN(num) && num > 0) {
                    i = num;
                    query = args.slice(0, -1).join(" ");
                } else {
                    query = args.join(" ");
                }
            } else {
                query = args[0];
            }

            getDefinition(query, i, (err, res) => {
                if (err) {
                    switch (err) {
                        case "errsite":
                            msg.reply("There was an error with accessing urbandictionary. Try again later maybe.");
                            return;
                        default:
                            console.log(err);
                            msg.reply("There was an unknown error or result.");
                    }
                    return;
                }
                let embed = util.richEmbed()
                    .setAuthor(res.word, THUMBNAIL, res.permalink)
                    .setDescription(res.definition.replace(/\[|\]/g, "").substr(0, 2048))
                    .setFooter(`👍 ${res.thumbs_up} | 👎 ${res.thumbs_down}`);
                if (res.example) {
                    embed.addField("Example", `_${res.example.replace(/\[|\]|_/g, "")}_`);
                }

                msg.channel.send(embed);
            });
            return "01";
        }
    }
};

function help() {
    return util.dedent`__Urban Dictionary Plugin__
        This plugin lets you search for words on Urban Dictionary.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "urbandictionary",
    help,
    load,
    unload,
    commands
};
