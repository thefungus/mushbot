"use strict";
let fs = require("fs-extra");
let path = require("path");
let async = require("async");
let request = require("request");
let util = require("../../../util.js");

const URI = "https://api.frankerfacez.com/v1/set/global";
const EMOTE = "https://cdn.frankerfacez.com/emoticon/{{id}}/{{size}}";
const CHANNEL = "https://api.frankerfacez.com/v1/room/{{channel}}";
const CACHE_CHECK_INTERVAL = util.DAY * 2;

const SIZE = {
    SMALL: "1",
    MED: "2",
    LARGE: "4"
};
const SIZE_NAMES = {
    [SIZE.SMALL]: "small",
    [SIZE.MED]: "medium",
    [SIZE.LARGE]: "large"
};
const PATH = {
    IMG(size) {
        return path.resolve(__dirname, `../img/ffz${size ? `/${size}` : ""}`);
    },
    JSON: path.resolve(__dirname, "../cache/ffz.json"),
    CACHE(channel) {
        return path.resolve(__dirname, `../cache/ffz${channel ? `/${channel}` : ""}`);
    }
};

let cacheInterval;
let dl = {};
let emotes = {
    global: new Map(),
    channel: new Map()
};
let Settings = {
    ffz: false,
    ffzChannels: [],
    disabledFFZ: [],
    ffzSize: SIZE.SMALL
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
            if (em.error) {
                return cb(em.error);
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
        cb(null, em);
    });
}

function loadGlobalEmotes(em) {
    for (let s of em.default_sets) {
        let set = em.sets[s].emoticons;
        for (let emote of set) {
            emotes.global.set(emote.name, {id: emote.id, sizes: Object.keys(emote.urls)});
        }
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
            if (em.error) {
                return cb(em.error);
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
    if (em.error) {
        return;
    }
    if (!emotes.channel.has(channel)) {
        emotes.channel.set(channel, new Map());
    }
    let ch = emotes.channel.get(channel);
    for (let s in em.sets) {
        for (let emote of em.sets[s].emoticons) {
            ch.set(emote.name, {id: emote.id, sizes: Object.keys(emote.urls)});
        }
    }
}

function getEmote(id, size, cb) {
    let filename = `${id}-${size}.png`;
    let uri = EMOTE.replace(/\{\{id\}\}/, id).replace(/\{\{size\}\}/, size);
    async.waterfall([
        (cb) => {
            request({uri, encoding: null}, cb);
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

function getSize(emote, size) {
    if (emote.sizes.indexOf(size) > -1) {
        return size;
    }
    if (size === SIZE.LARGE && emote.sizes.indexOf(SIZE.MED) > -1) {
        return SIZE.MED;
    }
    return SIZE.SMALL;
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
    if (!sett.ffz && msg.channel.type !== "dm") {
        return;
    }
    return globalHandler(msg, str, setts) ||
        channelsHandler(msg, str, setts);
}

function globalHandler(msg, str, sett) {
    for (let i of str) {
        if (!emotes.global.has(i) || sett.disabledFFZ.indexOf(i) > -1) {
            continue;
        }
        let emote = emotes.global.get(i);
        let size = getSize(emote, sett.ffzSize);
        let dir = PATH.IMG(size);
        let filename = `${emote.id}-${size}.png`;
        if (dl[size].has(filename)) {
            msg.channel.send(`${dir}/${filename}`);
        } else {
            getEmote(emote.id, size, (err) => {
                if (!err) {
                    msg.channel.send(`${dir}/${filename}`);
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
    for (let channel of sett.ffzChannels) {
        let ch = emotes.channel.get(channel);
        for (let i of str) {
            if (!ch.has(i) || sett.disabledFFZ.indexOf(i) > -1) {
                continue;
            }
            let emote = ch.get(i);
            let size = getSize(emote, sett.ffzSize);
            let dir = PATH.IMG(size);
            let filename = `${emote.id}-${size}.png`;
            if (dl[size].has(filename)) {
                msg.channel.send(`${dir}/${filename}`);
            } else {
                getEmote(emote.id, size, (err) => {
                    if (!err) {
                        msg.channel.send(`${dir}/${filename}`);
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
        \`ffz\` emotes: \`${sett.ffz ? "on" : "off"}\`
        \`ffz\` emotes size: \`${SIZE_NAMES[sett.ffzSize]}\``;
}

function emotesCommand(msg, args, sett, save, char) {
    switch ((args[0] || "").toLowerCase()) {
        case "on":
        case "enable":
            sett.ffz = true;
            save(
                msg.guild.id,
                sett,
                () => {
                    msg.reply(
                        "FFZ emotes `enabled`!"
                    );
                }
            );
            return;
        case "off":
        case "disable":
            sett.ffz = false;
            save(
                msg.guild.id,
                sett,
                () => {
                    msg.reply(
                        "FFZ emotes `disabled`!"
                    );
                }
            );
            return;
        case "toggle":
            sett.ffz = !sett.ffz;
            save(
                msg.guild.id,
                sett,
                () => {
                    msg.reply(
                        `FFZ emotes \`${sett.ffz ? "enabled" : "disabled"}\`!`
                    );
                }
            );
            return;
        case "size":
            switch ((args[1] || "").toLowerCase()) {
                case "1":
                case "small":
                case "s":
                    sett.ffzSize = SIZE.SMALL;
                    save(
                        msg.guild.id,
                        sett,
                        () => {
                            msg.reply(
                                "FFZ emotes size set to `small`!"
                            );
                        }
                    );
                    return;
                case "2":
                case "medium":
                case "m":
                    sett.ffzSize = SIZE.MED;
                    save(
                        msg.guild.id,
                        sett,
                        () => {
                            msg.reply(
                                "FFZ emotes size set to `medium`!"
                            );
                        }
                    );
                    return;
                case "3":
                case "4":
                case "large":
                case "l":
                    sett.ffzSize = SIZE.LARGE;
                    save(
                        msg.guild.id,
                        sett,
                        () => {
                            msg.reply(
                                "FFZ emotes size set to `large`!"
                            );
                        }
                    );
                    return;
                default:
                    msg.reply(
                        util.dedent`The FFZ emotes size is currently set to \`${SIZE_NAMES[sett.ffzSize]}\`.
                        To change the setting, use \`${char}emotes ffz size [small/medium/large]\`.`
                    );
                    return;
            }
        default:
            msg.reply(
                util.dedent`To change settings for FFZ emotes, use the following commands:
                \`${char}emotes ffz on\`
                \`${char}emotes ffz off\`
                \`${char}emotes ffz size\``
            );
            return;
    }
}

function disableCommand(msg, args, sett, save, char) {
    if (!args.length) {
        msg.reply(
            `To disable a certain FFZ emote in this server, use \`${char}disableemote ffz [name]\`.`
        );
        return;
    }
    if (sett.disabledFFZ.indexOf(args[0]) > -1) {
        msg.reply(
            "That FFZ emote is already disabled."
        );
        return;
    }
    if (hasEmote(args[0])) {
        sett.disabledFFZ.push(args[0]);
        save(msg.guild.id, sett, () => {
            msg.reply(
                util.dedent`Successfully disabled emote: \`${args[0]}\`!
                To re-enable the emote, you can use \`${char}enableemote ffz ${args[0]}\`.`
            );
        });
        return;
    }
    msg.reply(
        "I could not find an FFZ emote with that name."
    );
}

function enableCommand(msg, args, sett, save, char) {
    if (!args.length) {
        msg.reply(
            `To re-enable a certain FFZ emote in this server, use \`${char}enableemote ffz [name]\`.`
        );
        return;
    }
    if (sett.disabledFFZ.indexOf(args[0]) > -1) {
        sett.disabledFFZ.splice(sett.disabledFFZ.indexOf(args[0]), 1);
        save(msg.guild.id, sett, () => {
            msg.reply(
                `Successfully re-enabled the FFZ emote: \`${args[0]}\`!`
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
            `To add a certain channel's FFZ emotes, use \`${char}addchannel ffz [channel]\`.
            The channel name is the part in the address here: twitch.tv/[channel].`
        );
        return;
    }
    let ch = args[0].toLowerCase();
    if (sett.ffzChannels.indexOf(ch) > -1) {
        msg.reply(
            "That channel's FFZ emotes are already added to this server."
        );
        return;
    }
    addChannel(ch, (err) => {
        switch (err) {
            case "errsite":
                msg.reply(
                    "Either the channel you provided doesn't exist, it doesn't have any FFZ emotes, or there was some other error. Make sure you wrote the channel name correctly or try again later."
                );
                return;
            case "success":
                sett.ffzChannels.push(ch);
                save(msg.guild.id, sett, () => {
                    msg.reply(
                        `Successfully added the FFZ emotes for \`${ch}\`!`
                    );
                });
                return;
        }
    });
}

module.exports = {
    name: "ffz",
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
