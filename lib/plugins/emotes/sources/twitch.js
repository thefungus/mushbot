"use strict";
let fs = require("fs-extra");
let path = require("path");
let async = require("async");
let request = require("request");
let util = require("../../../util.js");
let creds = require(util.CREDS);

const URI = "https://api.twitch.tv/kraken/chat/emoticons";
const TEMPLATE = "https://static-cdn.jtvnw.net/emoticons/v1/{{id}}/{{size}}";
const CACHE_CHECK_INTERVAL = util.DAY * 2;
const CLIENT_ID = creds.twitch.clientid;

const SIZE = {
    SMALL: "1.0",
    MED: "2.0",
    LARGE: "3.0"
};
const SIZE_NAMES = {
    [SIZE.SMALL]: "small",
    [SIZE.MED]: "medium",
    [SIZE.LARGE]: "large"
};
const PATH = {
    IMG(size) {
        return path.resolve(__dirname, `../img/twitch${size ? `/${size}` : ""}`);
    },
    CACHE: path.resolve(__dirname, "../cache/twitch.json")
};

let cacheInterval;
let dl = {};
let emotes = new Map();
let Settings = {
    twitch: false,
    disabledTwitch: [],
    twitchSize: SIZE.SMALL
};

function init(cb) {
    cacheInterval = setInterval(loadEmotesCache, CACHE_CHECK_INTERVAL);
    async.series([
        createDirectories,
        getDownloadedEmotes,
        loadEmotesCache
    ], cb);
}

function unload() {
    clearInterval(cacheInterval);
}

function createDirectories(cb) {
    async.forEachOf(SIZE, (size, key, cb) => {
        fs.ensureDir(PATH.IMG(size), cb);
    }, cb);
}

function getDownloadedEmotes(cb) {
    async.forEachOf(SIZE, (size, key, cb) => {
        fs.readdir(PATH.IMG(size), (err, files) => {
            if (err) {
                return cb(err);
            }
            dl[size] = new Set(files);
            cb();
        });
    }, cb);
}

function loadEmotesCache(cb = () => {}) {
    checkEmotesCache((err, em) => {
        if (err) {
            if (err === "fetch") {
                return getEmotesCache((err, em) => {
                    if (err) {
                        return cb(err);
                    }
                    loadEmotes(em);
                    cb();
                }, true);
            }
            return cb(err);
        }
        loadEmotes(em);
        cb();
    });
}

function checkEmotesCache(cb) {
    fs.stat(PATH.CACHE, (err, stats) => {
        if (err) {
            if (err.code === "ENOENT") {
                return fetchEmotesJSON(cb);
            }
            return cb(err);
        }
        if (Date.now() - stats.mtime.getTime() > util.DAY) {
            return fetchEmotesJSON(cb);
        }
        return getEmotesCache(cb);
    });
}

function fetchEmotesJSON(cb) {
    async.waterfall([
        (cb) => {
            request({
                uri: URI,
                json: true,
                headers: {
                    "Client-ID": CLIENT_ID
                }
            }, cb);
        },
        (res, em, cb) => {
            if (em && em.error) {
                return cb("fetch");
            }
            fs.outputJSON(
                PATH.CACHE,
                em,
                (err) => {
                    cb(err, em);
                }
            );
        }
    ], cb);
}

function getEmotesCache(cb, fetch) {
    fs.readJSON(PATH.CACHE, (err, em) => {
        if (err) {
            if (fetch) {
                return cb(err);
            }
            return fetchEmotesJSON(cb);
        }
        cb(null, em);
    });
}

function loadEmotes(em) {
    emotes.clear();
    for (let emote of em.emoticons) {
        if (emote.code.indexOf("\\") > -1) {
            continue;
        }
        if (emotes.has(emote.code)) {
            continue;
        }
        if (emote.emoticon_set !== null && emote.emoticon_set !== 457) {
            if (emote.code.charAt(0).toUpperCase() === emote.code.charAt(0)) {
                continue;
            }
            if (!/[0-9]/.test(emote.code) && emote.code.toLowerCase() === emote.code) {
                continue;
            }
        }
        emotes.set(emote.code, emote.id);
    }
}

function getEmote(id, size, cb) {
    let filename = `${id}-${size}.png`;
    let uri = TEMPLATE.replace(/\{\{id\}\}/, id).replace(/\{\{size\}\}/, size);
    async.waterfall([
        (cb) => {
            request({
                uri,
                encoding: null,
                headers: {
                    "Client-ID": CLIENT_ID
                }
            }, cb);
        },
        (res, body, cb) => {
            fs.outputFile(
                `${PATH.IMG(size)}/${filename}`,
                body,
                cb
            );
        }
    ], (err) => {
        if (err) {
            return cb(err);
        }
        dl[size].add(filename);
        cb();
    });
}

function hasEmote(emote) {
    return emotes.has(emote);
}

function chatHandler(msg, str, setts) {
    let sett = setts || Settings;
    if (!sett.twitch && msg.channel.type !== "dm") {
        return 0;
    }
    for (let i of str) {
        if (!emotes.has(i) || sett.disabledTwitch.indexOf(i) > -1) {
            continue;
        }
        let dir = PATH.IMG(sett.twitchSize);
        let filename = `${emotes.get(i)}-${sett.twitchSize}.png`;
        if (dl[sett.twitchSize].has(filename)) {
            msg.channel.sendFile(`${dir}/${filename}`);
        } else {
            getEmote(emotes.get(i), sett.twitchSize, (err) => {
                if (!err) {
                    msg.channel.sendFile(`${dir}/${filename}`);
                }
            });
        }
        return 1;
    }
    return 0;
}

function defaultMessage(sett) {
    return util.dedent`
        \`twitch\` emotes: \`${sett.twitch ? "on" : "off"}\`
        \`twitch\` emotes size: \`${SIZE_NAMES[sett.twitchSize]}\``;
}

function emotesCommand(msg, args, sett, save, char) {
    switch ((args[0] || "").toLowerCase()) {
        case "on":
        case "enable":
            sett.twitch = true;
            save(
                msg.guild.id,
                sett,
                () => {
                    msg.reply(
                        "Twitch emotes `enabled`!"
                    );
                }
            );
            return;
        case "off":
        case "disable":
            sett.twitch = false;
            save(
                msg.guild.id,
                sett,
                () => {
                    msg.reply(
                        "Twitch emotes `disabled`!"
                    );
                }
            );
            return;
        case "toggle":
            sett.twitch = !sett.twitch;
            save(
                msg.guild.id,
                sett,
                () => {
                    msg.reply(
                        `Twitch emotes \`${sett.twitch ? "enabled" : "disabled"}\`!`
                    );
                }
            );
            return;
        case "size":
            switch ((args[1] || "").toLowerCase()) {
                case "1":
                case "small":
                case "s":
                case "default":
                    sett.twitchSize = SIZE.SMALL;
                    save(
                        msg.guild.id,
                        sett,
                        () => {
                            msg.reply(
                                "Twitch emotes size set to `small`!"
                            );
                        }
                    );
                    return;
                case "2":
                case "medium":
                case "med":
                case "m":
                    sett.twitchSize = SIZE.MED;
                    save(
                        msg.guild.id,
                        sett,
                        () => {
                            msg.reply(
                                "Twitch emotes size set to `medium`!"
                            );
                        }
                    );
                    return;
                case "3":
                case "large":
                case "l":
                    sett.twitchSize = SIZE.LARGE;
                    save(
                        msg.guild.id,
                        sett,
                        () => {
                            msg.reply(
                                "Twitch emotes size set to `large`!"
                            );
                        }
                    );
                    return;
                default:
                    msg.reply(
                        util.dedent`The Twitch emotes size is currently set to \`${SIZE_NAMES[sett.twitchSize]}\`.
                        To change the setting, use \`${char}emotes twitch size [small/medium/large]\`.`
                    );
                    return;
            }
        default:
            msg.reply(
                util.dedent`To change settings for Twitch emotes, use the following commands:
                \`${char}emotes twitch on\`
                \`${char}emotes twitch off\`
                \`${char}emotes twitch size\`
                For help with the Emotes plugin, follow this link: ${util.HELP_LINK}`
            );
            return;
    }
}

function disableCommand(msg, args, sett, save, char) {
    if (!args.length) {
        msg.reply(
            `To disable a certain Twitch emote in this server, use \`${char}disableemote twitch [name]\`.`
        );
        return;
    }
    if (sett.disabledTwitch.indexOf(args[0]) > -1) {
        msg.reply(
            "That Twitch emote is already disabled."
        );
        return;
    }
    if (hasEmote(args[0])) {
        sett.disabledTwitch.push(args[0]);
        save(msg.guild.id, sett, () => {
            msg.reply(
                util.dedent`Successfully disabled emote: \`${args[0]}\`!
                To re-enable the emote, you can use \`${char}enableemote twitch ${args[0]}\`.`
            );
        });
        return;
    }
    msg.reply(
        "I could not find a Twitch emote with that name."
    );
}

function enableCommand(msg, args, sett, save, char) {
    if (!args.length) {
        msg.reply(
            `To re-enable a certain Twitch emote in this server, use \`${char}enableemote twitch [name]\`.`
        );
        return;
    }
    if (sett.disabledTwitch.indexOf(args[0]) > -1) {
        sett.disabledTwitch.splice(sett.disabledTwitch.indexOf(args[0]), 1);
        save(msg.guild.id, sett, () => {
            msg.reply(
                `Successfully re-enabled the Twitch emote: \`${args[0]}\`!`
            );
        });
        return;
    }
    msg.reply(
        "That emote isn't disabled. Check to make sure you spelled the name properly."
    );
}

module.exports = {
    name: "twitch",
    init,
    unload,
    addedSettings: Settings,
    hasEmote,
    defaultMessage,
    emotesCommand,
    disableCommand,
    enableCommand,
    chatHandler
};
