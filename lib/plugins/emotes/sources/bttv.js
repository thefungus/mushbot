"use strict";
let fs = require("fs-extra");
let path = require("path");
let async = require("async");
let request = require("request");
let util = require("../../../util.js");

const URI = "https://api.betterttv.net/2/emotes";
const EMOTE = "https://cdn.betterttv.net/emote/{{id}}/{{size}}";
const CHANNEL = "https://api.betterttv.net/2/channels/{{channel}}";
const CACHE_CHECK_INTERVAL = util.DAY * 2;

const SIZE = {
    SMALL: "1x",
    MED: "2x",
    LARGE: "3x"
};
const SIZE_NAMES = {
    [SIZE.SMALL]: "small",
    [SIZE.MED]: "medium",
    [SIZE.LARGE]: "large"
};
const PATH = {
    IMG(size) {
        return path.resolve(__dirname, `../img/bttv${size ? `/${size}` : ""}`);
    },
    JSON: path.resolve(__dirname, "../cache/bttv.json"),
    CACHE(channel) {
        return path.resolve(__dirname, `../cache/bttv${channel ? `/${channel}` : ""}`);
    }
};

let cacheInterval;
let dl = {};
let emotes = {
    global: new Map(),
    channel: new Map()
};
let Settings = {
    bttv: false,
    disabledBTTV: [],
    bttvChannels: [],
    bttvSize: SIZE.SMALL
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
    async.series([
        (cb) => {
            fs.ensureDir(PATH.IMG(), cb);
        },
        (cb) => {
            async.parallel([
                (cb) => {
                    async.forEachOf(SIZE, (size, key, cb) => {
                        fs.ensureDir(PATH.IMG(size), cb);
                    }, cb);
                },
                (cb) => {
                    fs.ensureDir(PATH.CACHE(), cb);
                }
            ], cb);
        }
    ], cb);
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
    emotes.global.clear();
    emotes.channel.clear();
    async.parallel([
        (cb) => {
            checkGlobalEmotesCache((err, em) => {
                if (err) {
                    return cb(err);
                }
                loadGlobalEmotes(em);
                emotes.global.delete(":'(");
                cb();
            });
        },
        checkChannelEmotesCache
    ], (err) => {
        if (err) {
            return cb(err);
        }
        cb();
    });
}

function checkGlobalEmotesCache(cb) {
    fs.stat(PATH.JSON, (err, stats) => {
        if (err) {
            if (err.code === "ENOENT") {
                return fetchGlobalEmotesJSON(cb);
            }
            return cb(err);
        }
        if (Date.now() - stats.mtime.getTime() > util.DAY) {
            return fetchGlobalEmotesJSON(cb);
        }
        getGlobalEmotesCache(cb);
    });
}

function fetchGlobalEmotesJSON(cb) {
    async.waterfall([
        (cb) => {
            request({
                uri: URI,
                json: true
            }, cb);
        },
        (res, em, cb) => {
            if (em.status !== 200) {
                return cb(em.message);
            }
            fs.outputJSON(
                PATH.JSON,
                em,
                (err) => {
                    cb(err, em);
                }
            );
        }
    ], cb);
}

function getGlobalEmotesCache(cb) {
    fs.readJSON(PATH.JSON, (err, em) => {
        if (err) {
            return fetchGlobalEmotesJSON(cb);
        }
        return cb(null, em);
    });
}

function loadGlobalEmotes(em) {
    for (let emote of em.emotes) {
        emotes.global.set(emote.code, {id: emote.id, ext: emote.imageType});
    }
}

function checkChannelEmotesCache(cb) {
    fs.readdir(PATH.CACHE(), (err, files) => {
        if (err) {
            return cb(err);
        }
        async.each(files, (channel, cb) => {
            fs.stat(PATH.CACHE(channel), (err, stats) => {
                if (err) {
                    return cb(err);
                }
                if (Date.now() - stats.mtime.getTime() > util.DAY) {
                    return fetchChannelEmotesJSON(channel, (err, em) => {
                        if (err) {
                            return cb(err);
                        }
                        loadChannelEmotes(channel, em);
                        cb();
                    });
                }
                getChannelEmotesCache(channel, (err, em) => {
                    if (err) {
                        return cb(err);
                    }
                    loadChannelEmotes(channel, em);
                    cb();
                });
            });
        }, cb);
    });
}

function fetchChannelEmotesJSON(channel, cb) {
    async.waterfall([
        (cb) => {
            request({
                uri: CHANNEL.replace(/\{\{channel\}\}/, channel),
                json: true
            }, cb);
        },
        (res, em, cb) => {
            if (em.status !== 200) {
                return cb(em.message);
            }
            fs.outputJSON(
                PATH.CACHE(channel),
                em,
                (err) => {
                    cb(err, em);
                }
            );
        }
    ], cb);
}

function getChannelEmotesCache(channel, cb) {
    fs.readJSON(PATH.CACHE(channel), (err, em) => {
        if (err) {
            return fetchChannelEmotesJSON(channel, cb);
        }
        cb(null, em);
    });
}

function loadChannelEmotes(channel, em) {
    if (!emotes.channel.has(channel)) {
        emotes.channel.set(channel, new Map());
    }
    let ch = emotes.channel.get(channel);
    if (!em || !em.emotes) {
        return;
    }
    for (let emote of em.emotes) {
        ch.set(emote.code, {id: emote.id, ext: emote.imageType});
    }
}

function getEmote(id, size, ext, cb) {
    let filename = `${id}-${size}.${ext}`;
    let uri = EMOTE.replace(/\{\{id\}\}/, id).replace(/\{\{size\}\}/, size);
    async.waterfall([
        (cb) => {
            request({uri, encoding: null}, cb);
        },
        (res, body, cb) => {
            fs.writeFile(
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
    if (emotes.global.has(emote)) {
        return true;
    }
    for (let i of emotes.channel.values()) {
        if (i.has(emote)) {
            return true;
        }
    }
    return false;
}

function addChannel(channel, cb) {
    getChannelEmotesCache(channel, (err, em) => {
        if (err) {
            return cb("errsite");
        }
        loadChannelEmotes(channel, em);
        return cb("success");
    });
}

function chatHandler(msg, str, setts) {
    let sett = setts || Settings;
    if (!sett.bttv && msg.channel.type !== "dm") {
        return;
    }
    return globalHandler(msg, str, sett) ||
        channelsHandler(msg, str, sett);
}

function globalHandler(msg, str, sett) {
    for (let i of str) {
        if (!emotes.global.has(i) || sett.disabledBTTV.indexOf(i) > -1) {
            continue;
        }
        let emote = emotes.global.get(i);
        let dir = PATH.IMG(sett.bttvSize);
        let filename = `${emote.id}-${sett.bttvSize}.${emote.ext}`;
        if (dl[sett.bttvSize].has(filename)) {
            msg.channel.send({
                files: [{
                    attachment: `${dir}/${filename}`,
                    name: `${i}.${emote.ext}`
                }]
            });
        } else {
            getEmote(emote.id, sett.bttvSize, emote.ext, (err) => {
                if (!err) {
                    msg.channel.send({
                        files: [{
                            attachment: `${dir}/${filename}`,
                            name: `${i}.${emote.ext}`
                        }]
                    });
                }
            });
        }
        return 1;
    }
    return 0;
}

function channelsHandler(msg, str, sett) {
    if (msg.channel.type === "dm") {
        return 0;
    }
    for (let channel of sett.bttvChannels) {
        let ch = emotes.channel.get(channel);
        if (!ch) {
            continue;
        }
        for (let i of str) {
            if (!ch.has(i) || sett.disabledBTTV.indexOf(i) > -1) {
                continue;
            }
            let emote = ch.get(i);
            let dir = PATH.IMG(sett.bttvSize);
            let filename = `${emote.id}-${sett.bttvSize}.${emote.ext}`;
            if (dl[sett.bttvSize].has(filename)) {
                msg.channel.send({
                    files: [{
                        attachment: `${dir}/${filename}`,
                        name: `${i}.${emote.ext}`
                    }]
                });
            } else {
                getEmote(emote.id, sett.bttvSize, emote.ext, (err) => {
                    if (!err) {
                        msg.channel.send({
                            files: [{
                                attachment: `${dir}/${filename}`,
                                name: `${i}.${emote.ext}`
                            }]
                        });
                    }
                });
            }
            return 1;
        }
    }
    return 0;
}

function defaultMessage(sett) {
    return util.dedent`
        \`bttv\` emotes: \`${sett.bttv ? "on" : "off"}\`
        \`bttv\` emotes size: \`${SIZE_NAMES[sett.bttvSize]}\``;
}

function emotesCommand(msg, args, sett, save, char) {
    switch ((args[0] || "").toLowerCase()) {
        case "on":
        case "enable":
            sett.bttv = true;
            save(
                msg.guild.id,
                sett,
                () => {
                    msg.reply(
                        "BTTV emotes `enabled`!"
                    );
                }
            );
            return;
        case "off":
        case "disable":
            sett.bttv = false;
            save(
                msg.guild.id,
                sett,
                () => {
                    msg.reply(
                        "BTTV emotes `disabled`!"
                    );
                }
            );
            return;
        case "toggle":
            sett.bttv = !sett.bttv;
            save(
                msg.guild.id,
                sett,
                () => {
                    msg.reply(
                        `BTTV emotes \`${sett.bttv ? "enabled" : "disabled"}\`!`
                    );
                }
            );
            return;
        case "size":
            switch ((args[1] || "").toLowerCase()) {
                case "1":
                case "small":
                case "s":
                    sett.bttvSize = SIZE.SMALL;
                    save(
                        msg.guild.id,
                        sett,
                        () => {
                            msg.reply(
                                "BTTV emotes size set to `small`!"
                            );
                        }
                    );
                    return;
                case "2":
                case "medium":
                case "m":
                    sett.bttvSize = SIZE.MED;
                    save(
                        msg.guild.id,
                        sett,
                        () => {
                            msg.reply(
                                "BTTV emotes size set to `medium`!"
                            );
                        }
                    );
                    return;
                case "3":
                case "large":
                case "l":
                    sett.bttvSize = SIZE.LARGE;
                    save(
                        msg.guild.id,
                        sett,
                        () => {
                            msg.reply(
                                "BTTV emotes size set to `large`!"
                            );
                        }
                    );
                    return;
                default:
                    msg.reply(
                        util.dedent`The BTTV emotes size is currently set to \`${SIZE_NAMES[sett.bttvSize]}\`.
                        To change the setting, use \`${char}emotes bttv size [small/medium/large]\`.`
                    );
                    return;
            }
        default:
            msg.reply(
                util.dedent`To change settings for BTTV emotes, use the following commands:
                \`${char}emotes bttv on\`
                \`${char}emotes bttv off\`
                \`${char}emotes bttv size\``
            );
            return;
    }
}

function disableCommand(msg, args, sett, save, char) {
    if (!args.length) {
        msg.reply(
            `To disable a certain BTTV emote in this server, use \`${char}disableemote bttv [name]\`.`
        );
        return;
    }
    if (sett.disabledBTTV.indexOf(args[0]) > -1) {
        msg.reply(
            "That BTTV emote is already disabled."
        );
        return;
    }
    if (hasEmote(args[0])) {
        sett.disabledBTTV.push(args[0]);
        save(msg.guild.id, sett, () => {
            msg.reply(
                util.dedent`Successfully disabled emote: \`${args[0]}\`!
                To re-enable the emote, you can use \`${char}enableemote bttv ${args[0]}\`.`
            );
        });
        return;
    }
    msg.reply(
        "I could not find a BTTV emote with that name."
    );
}

function enableCommand(msg, args, sett, save, char) {
    if (!args.length) {
        msg.reply(
            `To re-enable a certain BTTV emote in this server, use \`${char}enableemote bttv [name]\`.`
        );
        return;
    }
    if (sett.disabledBTTV.indexOf(args[0]) > -1) {
        sett.disabledBTTV.splice(sett.disabledBTTV.indexOf(args[0]), 1);
        save(msg.guild.id, sett, () => {
            msg.reply(
                `Successfully re-enabled the BTTV emote: \`${args[0]}\`!`
            );
        });
        return;
    }
    msg.reply(
        "That emote isn't disabled. Check to make sure you spelled the name properly."
    );
}

function addChannelCommand(msg, args, sett, save, char) {
    if (!args.length) {
        msg.reply(
            util.dedent`To add a certain channel's BTTV emotes, use \`${char}addchannel bttv [channel]\`.
            The channel name is the part in the address here: twitch.tv/[channel].`
        );
        return;
    }
    let ch = args[0].toLowerCase();
    if (sett.bttvChannels.indexOf(ch) > -1) {
        msg.reply(
            "That channel's BTTV emotes are already added to this server."
        );
        return;
    }
    addChannel(ch, (err) => {
        switch (err) {
            case "errsite":
                msg.reply(
                    "Either the channel you provided doesn't exist, it doesn't have any BTTV emotes, or there was some other error. Make sure you wrote the channel name correctly or try again later."
                );
                return;
            case "success":
                sett.bttvChannels.push(ch);
                save(msg.guild.id, sett, () => {
                    msg.reply(
                        `Successfully added the BTTV emotes for \`${ch}\`!`
                    );
                });
                return;
        }
    });
}

module.exports = {
    name: "bttv",
    init,
    unload,
    addedSettings: Settings,
    hasEmote,
    defaultMessage,
    emotesCommand,
    disableCommand,
    enableCommand,
    addChannelCommand,
    chatHandler
};
