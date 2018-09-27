"use strict";
let async = require("async");
let util = require("../../util.js");
let database = require(util.DATABASE);
let twitch = require(util.TWITCH);

let settings;
let users;
let friendMe;

let nextCd = false;
let nextCdTo = null;

function load(mb, cb) {
    async.parallel([
        loadSettings,
        loadUsers,
        loadFriendMe
    ], cb);
}

function unload(mb, cb) {
    clearTimeout(nextCdTo);
    cb();
}

function getInfo(username, nnid, mii) {
    if (!users.has(username.toLowerCase())) {
        return username;
    }
    let user = users.get(username.toLowerCase());
    let msg = `${username}`;
    if (nnid && user.nnid && user.nnid !== ".") {
        msg += ` (${user.nnid})`;
    }
    if (mii && user.mii) {
        msg += ` (Mii: ${user.mii})`;
    }
    return msg;
}

function loadSettings(cb) {
    database.loadAll("twitchlist-settings", (err, docs) => {
        if (err) {
            return cb(err);
        }
        settings = new Map();
        for (let doc of docs) {
            settings.set(doc._id, new Settings(doc.data));
        }
        cb();
    });
}

function loadUsers(cb) {
    database.loadAll("twitchlist-users", (err, docs) => {
        if (err) {
            return cb(err);
        }
        users = new Map();
        for (let doc of docs) {
            users.set(doc._id, new User(doc.data));
        }
        cb();
    });
}

function loadFriendMe(cb) {
    database.loadData("twitchlist-friendme", "friendme", (err, doc) => {
        if (err) {
            return cb(err);
        }
        friendMe = new Set(doc ? (doc.data || []) : []);
        cb();
    });
}

function saveSettings(channel, sett, cb) {
    database.saveData("twitchlist-settings", channel, sett, cb);
}

function saveUser(username, data, cb) {
    database.saveData("twitchlist-users", username, data, cb);
}

function saveFriendMe(cb) {
    database.saveData("twitchlist-friendme", "friendme", Array.from(friendMe), cb);
}

function activateNextCd() {
    nextCd = true;
    nextCdTo = setTimeout(() => {
        nextCd = false;
    }, 5000);
}

function okDayLimit(user, sett, chan, isSub) {
    if (!user.lastPlayed[chan] || !sett.dayLimit || (!sett.subLimit && isSub)) {
        return true;
    }
    return Date.now() - user.lastPlayed[chan] > sett.dayLimit * 24 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000;
}

function joinRegular(channel, user, args, char, sett) {
    if (sett.list.length >= sett.limit) {
        return;
    }
    let name = user.username.toLowerCase();
    if (util.containsIgnoreCase(sett.list, name) > -1) {
        return;
    }
    if (args.length < 2) {
        if (util.containsIgnoreCase(users, name) === -1) {
            console.log(args);
            twitch.sendMessage(channel,
                `@${name}, You gotta enter with an NNID! Use ${char}nnid (your nnid here) in the chat.`
            );
            twitch.sendWhisper(user,
                `You gotta enter with an NNID! Use ${char}nnid (your nnid here) in the chat.`
            );
            return;
        } else {
            let nuser = users.get(name);
            if (!nuser.nnid) {
                twitch.sendMessage(channel,
                    `@${name}, You gotta enter with an NNID! Use ${char}nnid (your nnid here) in the chat.`
                );
                twitch.sendWhisper(user,
                    `You gotta enter with an NNID! Use ${char}nnid (your nnid here) in the chat.`
                );
                return;
            }
        }
    }
    if (users.has(name)) {
        let nuser = users.get(name);
        if (!okDayLimit(nuser, sett, channel, true)) {
            twitch.sendMessage(channel,
                `@${name}, You already played the streamer recently! Let's give others a chance to play!`
            );
            return;
        }
    }
    sett.list.push(user.username);
    let nnid = null;
    let mii = null;
    if (args.length) {
        nnid = args[0].substr(0, 16);
        if (args.length > 1) {
            mii = args.slice(1).join(" ").substr(0, 10);
        }
    }
    if (util.containsIgnoreCase(users, name) === -1) {
        users.set(name, new User({nnid, mii}));
    } else {
        let nuser = users.get(name);
        nuser.nnid = nnid || nuser.nnid;
        nuser.mii = mii || nuser.mii;
    }
    saveUser(name, users.get(name), () => {
        saveSettings(channel, sett, () => {
            twitch.sendMessage(channel,
                `@${getInfo(user.username, true)} joined the list! Make sure you add the streamer (${sett.nnid}) and if they need to add you back, type ${char}friendme`
            );
            if (sett.list.length === sett.limit) {
                twitch.sendAction(channel,
                    "THE LIST IS FULL NOW! Let's get this started!"
                );
            }
        });
    });
}

function joinRandom(channel, user, args, char, sett) {
    let name = user.username.toLowerCase();
    if (util.containsIgnoreCase(sett.randomList, name) > -1) {
        return;
    }
    if (args.length < 2) {
        if (util.containsIgnoreCase(users, name) === -1) {
            console.log(args);
            twitch.sendMessage(channel,
                `@${name}, You gotta enter with an NNID! Use ${char}nnid (your nnid here) in the chat.`
            );
            twitch.sendWhisper(user,
                `You gotta enter with an NNID! Use ${char}nnid (your nnid here) in the chat.`
            );
            return;
        } else {
            let nuser = users.get(name);
            if (!nuser.nnid) {
                twitch.sendMessage(channel,
                    `@${name}, You gotta enter with an NNID! Use ${char}nnid (your nnid here) in the chat.`
                );
                twitch.sendWhisper(user,
                    `You gotta enter with an NNID! Use ${char}nnid (your nnid here) in the chat.`
                );
                return;
            }
        }
    }
    if (users.has(name)) {
        let nuser = users.get(name);
        if (!okDayLimit(nuser, sett, channel, true)) {
            twitch.sendMessage(channel,
                `@${name}, You already played the streamer recently! Let's give others a chance to play!`
            );
            return;
        }
    }
    sett.randomList.push(user.username);
    let nnid = null;
    let mii = null;
    if (args.length) {
        nnid = args[0].substr(0, 16);
        if (args.length > 1) {
            mii = args.slice(1).join(" ").substr(0, 10);
        }
    }
    if (util.containsIgnoreCase(users, name) === -1) {
        users.set(name, new User({nnid, mii}));
    } else {
        let nuser = users.get(name);
        nuser.nnid = nnid || nuser.nnid;
        nuser.mii = mii || nuser.mii;
    }
    saveUser(name, users.get(name), () => {
        saveSettings(channel, sett, () => {});
    });
}

function randomSelect(channel, sett, char) {
    sett.randomMode = false;
    if (sett.limit >= sett.randomList.length) {
        util.shuffleInPlace(sett.randomList);
        sett.list = sett.randomList;
    } else {
        sett.list = util.getRandomN(sett.randomList, sett.limit);
    }
    saveSettings(channel, sett, () => {
        twitch.sendAction(channel,
            `Okay! ${sett.list.length} players have been selected for the list! Check ${char}list to see who got selected!`
        );
    });
}

let twitchCommands = {
    on: {
        names: ["on", "enable", "start"],
        perms: ["admin"],
        desc: "(admins) Start the plugin for use. You need to use this before the other commands will work!",
        code(channel, user, args, char) {
            if (!settings.has(channel)) {
                settings.set(channel, new Settings());
            }
            let sett = settings.get(channel);
            sett.enabled = true;
            saveSettings(channel, sett, () => {
                twitch.reply(channel, user,
                    `List commands now enabled! Commands: ${char}off, ${char}list, ${char}win/next, ${char}limit, ${char}open subs/all, ${char}close, ${char}clear, ${char}swap/add/remove, ${char}streamernnid, ${char}randomlist`
                );
            });
        }
    },
    off: {
        names: ["off", "disable", "stop"],
        perms: ["admin"],
        desc: "(admins) Stop the plugin. Useful if you don't want the other commands to work if you aren't currently using the list.",
        code(channel, user) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            sett.enabled = false;
            saveSettings(channel, sett, () => {
                twitch.reply(channel, user,
                    "List commands now disabled!"
                );
            });
        }
    },
    list: {
        names: ["list"],
        perms: [],
        desc: "Display the current list.",
        userCd: 60,
        channelCd: 30,
        code(channel, user) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            if (sett.subs && !(twitch.isSub(user) || twitch.isOp(channel, user))) {
                return;
            }
            if (sett.list.length === 0) {
                twitch.sendMessage(channel, "The list is empty!");
                return "11";
            }
            if (sett.list.length === 1) {
                twitch.sendMessage(channel, `Current list (1): ${getInfo(sett.list[0], true, true)}`);
                return "11";
            }
            let list = [].concat(getInfo(sett.list[0], true, true), sett.list.slice(1).map((user) => getInfo(user, true)).join(", "));
            twitch.sendMessage(channel, `Current list (${sett.list.length}): ${list.join(", ")}`);
            return "11";
        }
    },
    next: {
        names: ["next", "win"],
        perms: ["admin"],
        desc: "(admins) Remove the first person in the list to move on to the next player.",
        code(channel) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            if (nextCd) {
                return;
            }
            if (sett.list.length === 0) {
                twitch.sendMessage(channel,
                    "The list is already empty!"
                );
                return;
            }
            let name = sett.list.shift();
            if (users.has(name)) {
                let user = users.get(name);
                user.lastPlayed[channel] = Date.now();
                saveUser(name, user);
            }
            activateNextCd();
            saveSettings(channel, sett, () => {
                let message;
                if (sett.list.length === 0) {
                    message = "The list is empty now! Woohoo!";
                } else {
                    message = `Up next: ${getInfo(sett.list[0], true, true)}!`;
                    if (util.containsIgnoreCase(friendMe, sett.list[0]) > -1) {
                        message += ` @${channel.replace("#", "")} You may need to add them to your friends list!`;
                        util.deleteSetIgnoreCase(friendMe, sett.list[0]);
                        saveFriendMe(() => {
                            twitch.sendMessage(channel, message);
                        });
                        return;
                    }
                }
                twitch.sendMessage(channel, message);
            });
        }
    },
    limit: {
        names: ["limit"],
        perms: ["admin"],
        desc: "(admins) Set a limit for the list, or display the current limit.",
        code(channel, user, args, char) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            if (!args.length) {
                twitch.reply(channel, user,
                    `The current list limit is set to ${sett.limit}. Change the limit with ${char}limit [number].`
                );
                return;
            }
            let lim = parseInt(args[0]);
            if (isNaN(lim)) {
                twitch.reply(channel, user,
                    "C'mon, be smart about this. Gimme a real number!"
                );
                return;
            }
            if (lim === 0) {
                twitch.reply(channel, user,
                    `You shouldn't set the limit to 0! If you want to close the list, use ${char}close instead.`
                );
                return;
            }
            sett.limit = Math.abs(lim);
            saveSettings(channel, sett, () => {
                twitch.reply(channel, user,
                    `Changed the list limit to ${sett.limit}!`
                );
            });
        }
    },
    daylimit: {
        names: ["daylimit"],
        perms: ["admin"],
        desc: "(admins) Set a limit on how often someone can join the list (in days).",
        code(channel, user, args, char) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            if (!args.length) {
                twitch.reply(channel, user,
                    `The current day join limit is set to ${sett.dayLimit} day${sett.dayLimit === 1 ? "" : "s"}. Change the limit with ${char}daylimit [number].`
                );
                return;
            }
            if (args[0].toLowerCase().indexOf("sub") === 0) {
                sett.subLimit = !sett.subLimit;
                saveSettings(channel, sett, () => {
                    twitch.reply(channel, user,
                        `Subs ${sett.subLimit ? `are now affected by the join limit of ${sett.dayLimit} days` : `can now join the list regardless of the ${sett.dayLimit} day limit`}.`
                    );
                });
                return;
            }
            let lim = parseInt(args[0]);
            if (isNaN(lim)) {
                twitch.reply(channel, user,
                    "C'mon, be smart about this. Gimme a real number!"
                );
                return;
            }
            sett.dayLimit = Math.abs(lim);
            saveSettings(channel, sett, () => {
                twitch.reply(channel, user,
                    `Changed the day join limit to ${sett.dayLimit} day${sett.dayLimit === 1 ? "" : "s"}!`
                );
            });
        }
    },
    open: {
        names: ["open", "openlist"],
        perms: ["admin"],
        desc: "(admins) Open the list for people to join. Use `!open all` to let anyone join, or `!open subs` for subs only.",
        code(channel, user, args, char) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            if (sett.randomMode) {
                twitch.reply(channel, user,
                    "You can't open the list while a random list is being created!"
                );
                return;
            }
            sett.open = true;
            if (args.length) {
                switch (args[0].toLowerCase()) {
                    case "sub":
                    case "subs":
                    case "subscriber":
                    case "subscribers":
                        sett.subs = true;
                        break;
                    case "all":
                    case "anyone":
                    case "viewer":
                    case "viewers":
                        sett.subs = false;
                        break;
                }
            }
            saveSettings(channel, sett, () => {
                twitch.sendMessage(channel,
                    `The list is now OPEN for ${sett.subs ? "subscribers" : "anyone"}! Limit of ${sett.limit} players. Join by typing ${char}enter [nnid]`
                );
            });
        }
    },
    randomlist: {
        names: ["openrandom", "randomlist", "openrandomlist"],
        perms: ["admin"],
        desc: "(admins) Create a random list for people to join. After 30 seconds, the regular list will be filled with random people who entered. Use `!randomlist all` to let anyone join, or `!randomlist subs` for subs only.",
        code(channel, user, args, char) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            if (sett.list.length) {
                twitch.reply(channel, user,
                    "Make sure the list is empty and closed before starting a random list!"
                );
                return;
            }
            if (sett.randomMode) {
                twitch.reply(channel, user,
                    "A random list is already being created. Wait until it's done!"
                );
                return;
            }
            sett.open = false;
            sett.randomList = [];
            sett.randomMode = true;
            if (args.length) {
                switch (args[0].toLowerCase()) {
                    case "sub":
                    case "subs":
                    case "subscriber":
                    case "subscribers":
                        sett.subs = true;
                        break;
                    case "all":
                    case "anyone":
                    case "viewer":
                    case "viewers":
                        sett.subs = false;
                        break;
                }
            }
            setTimeout(() => {
                randomSelect(channel, sett, char);
            }, 30000);
            setTimeout(() => {
                twitch.sendAction(channel,
                    `20 seconds remain to join the random list! Enter to have a chance of joining the sub list! Join by typing ${char}enter [nnid] [mii]`
                );
            }, 10000);
            setTimeout(() => {
                twitch.sendAction(channel,
                    `10 seconds remain to join the random list! Enter to have a chance of joining the sub list! Join by typing ${char}enter [nnid] [mii]`
                );
            }, 20000);
            saveSettings(channel, sett, () => {
                twitch.sendAction(channel,
                    `The RANDOM list is now OPEN for ${sett.subs ? "subscribers" : "anyone"}! ${sett.limit} players will be selected. Join by typing ${char}enter [nnid] [mii]`
                );
            });
        }
    },
    close: {
        names: ["close", "closelist"],
        perms: ["admin"],
        desc: "(admins) Close the list so nobody can join. Mods can still add and swap people onto the list.",
        code(channel) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            sett.open = false;
            saveSettings(channel, sett, () => {
                twitch.sendMessage(channel,
                    "The list is now closed!"
                );
            });
        }
    },
    clear: {
        names: ["clear", "clearlist"],
        perms: ["admin"],
        desc: "(admins) Remove everyone from the list.",
        code(channel, user) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            sett.list = [];
            friendMe.clear();
            saveFriendMe(() => {
                saveSettings(channel, sett, () => {
                    twitch.reply(channel, user,
                        "Cleared the list!"
                    );
                });
            });
        }
    },
    streamernnid: {
        names: ["streamerid", "streamernnid", "streamername"],
        perms: ["admin"],
        desc: "(admins) Display or set the streamer's tag that players should add or use to play with the streamer.",
        code(channel, user, args) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            if (!args.length) {
                twitch.reply(channel, user,
                    `The streamer's NNID is: ${sett.nnid}`
                );
                return;
            }
            sett.nnid = args[0];
            saveSettings(channel, sett, () => {
                twitch.reply(channel, user,
                    `Set the streamer's NNID to ${args[0]}!`
                );
            });
        }
    },
    add: {
        names: ["add", "move"],
        perms: ["admin"],
        desc: "(admins) Add a user to the list. Use `!add [@name] [nnid] [number]` to put them at a specific spot on the list (like `!add @thefungus 3`), or just `!add [@name]`.",
        code(channel, user, args, char) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            if (!args.length) {
                twitch.reply(channel, user,
                    `Add someone to the list with ${char}add [@name] [nnid] [mii]. You can also specify a position to place them at with ${char}add [name] [nnid] [mii] [position].`
                );
                return;
            }
            let name = args[0].replace("@", "");
            if (util.containsIgnoreCase(sett.list, name) > -1) {
                sett.list.splice(util.containsIgnoreCase(sett.list, name), 1);
            }
            let pos = null;
            let nnid = null;
            let mii = null;
            switch (args.length) {
                case 1:
                    break;
                case 2:
                    if (args[1].length >= 6) {
                        nnid = args[1].substr(0, 16);
                    } else {
                        pos = parseInt(args[1]);
                        if (isNaN(pos)) {
                            pos = null;
                            nnid = args[1].substr(0, 16);
                        } else if (pos > sett.list.length) {
                            pos = null;
                        }
                    }
                    break;
                default:
                    nnid = args[1].substr(0, 16);
                    mii = args.slice(2, args.length - 1);
                    pos = parseInt(args[args.length - 1]);
                    if (isNaN(pos)) {
                        pos = null;
                        mii.push(args[args.length - 1]);
                    } else if (pos > sett.list.length) {
                        pos = null;
                    }
            }
            if (mii) {
                mii = mii.join(" ").substr(0, 10);
            }
            let warn = false;
            if (util.containsIgnoreCase(users, name) === -1) {
                if (!nnid) {
                    twitch.reply(channel, user,
                        `You should use ${char}add [@name] [nnid] because they don't have an NNID set yet!`
                    );
                    return;
                }
                users.set(name.toLowerCase(), new User({nnid, mii}));
            } else {
                let nuser = users.get(name.toLowerCase());
                if (!nuser.nnid) {
                    if (!nnid) {
                        twitch.reply(channel, user,
                            `You should use ${char}add [@name] [nnid] because they don't have an NNID set yet!`
                        );
                        return;
                    }
                    nuser.nnid = nnid;
                }
                if (!nuser.mii) {
                    nuser.mii = mii;
                }
                if (!okDayLimit(nuser, sett, channel)) {
                    warn = true;
                }
            }
            if (pos === null) {
                sett.list.push(name);
            } else {
                sett.list = sett.list.slice(0, pos - 1).concat(name, sett.list.slice(pos - 1));
            }
            saveUser(name.toLowerCase(), users.get(name.toLowerCase()), () => {
                saveSettings(channel, sett, () => {
                    twitch.reply(channel, user,
                        `Added ${name} to the list!${warn ? " They did already play recently though!" : ""}`
                    );
                });
            });
        }
    },
    remove: {
        names: ["remove"],
        perms: ["admin"],
        desc: "(admins) Remove a user from the list.",
        code(channel, user, args, char) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            if (!args.length) {
                twitch.reply(channel, user,
                    `You can remove someone from the list with ${char}remove [@name].`
                );
                return;
            }
            let name = args[0].replace("@", "");
            let pos = util.containsIgnoreCase(sett.list, name);
            if (pos === -1) {
                twitch.reply(channel, user,
                    "That person isn't on the list."
                );
                return;
            }
            sett.list.splice(util.containsIgnoreCase(sett.list, name), 1);
            saveSettings(channel, sett, () => {
                let msg = `Removed ${name} from the list!`;
                if (pos === 0) {
                    if (sett.list.length === 0) {
                        msg += " The list is empty now! Woohoo!";
                    } else {
                        msg += ` Next up is ${getInfo(sett.list[0], true, true)}!`;
                        if (util.containsIgnoreCase(friendMe, sett.list[0]) > -1) {
                            msg += ` @${channel.replace("#", "")} You may need to add them to your friends list!`;
                            util.deleteSetIgnoreCase(friendMe, sett.list[0]);
                            saveFriendMe(() => {
                                twitch.sendMessage(channel, msg);
                            });
                            return;
                        }
                    }
                }
                twitch.sendMessage(channel, msg);
            });
        }
    },
    swap: {
        names: ["swap", "switch"],
        perms: ["admin"],
        desc: "(admins) Swap two users on the list. Either one or both players can be on the list.",
        code(channel, user, args, char) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            if (args.length !== 2) {
                twitch.reply(channel, user,
                    `To swap two people on the list, use ${char}swap [user1] [user2].`
                );
                return;
            }
            let user0 = args[0].toLowerCase().replace("@", "");
            let user1 = args[1].toLowerCase().replace("@", "");
            let pos1 = util.containsIgnoreCase(sett.list, user0);
            let pos2 = util.containsIgnoreCase(sett.list, user1);
            if (pos1 === -1 && pos2 === -1) {
                twitch.reply(channel, user,
                    "Come on! At least one of them has to be on the list!"
                );
                return;
            }
            if (!users.has(user0) || !users.has(user1)) {
                twitch.reply(channel, user,
                    "Make sure both people have their NNID set!"
                );
                return;
            }
            if (!users.get(user0).nnid || !users.get(user0).nnid) {
                twitch.reply(channel, user,
                    "Make sure both people have their NNID set!"
                );
                return;
            }
            if (pos1 > -1 && pos2 > -1) {
                let temp = sett.list[pos1];
                sett.list[pos1] = sett.list[pos2];
                sett.list[pos2] = temp;
                saveSettings(channel, sett, () => {
                    twitch.reply(channel, user,
                        `I swapped ${sett.list[pos1]} and ${sett.list[pos2]} on the list!`
                    );
                });
                return;
            }
            if (pos1 > -1) {
                sett.list[pos1] = user1;
            } else {
                sett.list[pos2] = user0;
            }
            saveSettings(channel, sett, () => {
                twitch.reply(channel, user,
                    `I swapped ${args[0].replace("@", "")} and ${args[1].replace("@", "")} on the list!`
                );
            });
        }
    },
    enter: {
        names: ["enter", "enterlist", "join", "joinlist"],
        perms: [],
        desc: "Enter the list when the list is open. You should use `!enter [nnid]` if you haven't set your NNID yet.",
        code(channel, user, args, char) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            /*if (twitch.isStreamer(channel, user)) {
                twitch.reply(channel, user,
                    "B-but... Why would you join your own list? Are you looking to play with yourself? ;););)"
                );
                return;
            }*/
            if (sett.subs && !twitch.isSub(user)) {
                return;
            }
            if (sett.randomMode) {
                return joinRandom(channel, user, args, char, sett);
            }
            if (sett.open) {
                return joinRegular(channel, user, args, char, sett);
            }
        }
    },
    leave: {
        names: ["leave", "leavelist"],
        perms: [],
        desc: "Leave the list.",
        code(channel, user) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            let pos = util.containsIgnoreCase(sett.list, user.username);
            if (pos === -1) {
                return;
            }
            sett.list.splice(pos, 1);
            util.deleteSetIgnoreCase(friendMe, user.username);
            saveSettings(channel, sett, () => {
                let msg = `@${user.username} left the list!`;
                if (pos === 0) {
                    if (sett.list.length === 0) {
                        msg += " The list is empty now! Woohoo!";
                    } else {
                        msg += ` Next up is ${getInfo(sett.list[0], true, true)}!`;
                        if (util.containsIgnoreCase(friendMe, sett.list[0]) > -1) {
                            msg += ` @${channel.replace("#", "")} You may need to add them to your friends list!`;
                            util.deleteSetIgnoreCase(friendMe, sett.list[0]);
                            saveFriendMe(() => {
                                twitch.sendMessage(channel, msg);
                            });
                            return;
                        }
                    }
                }
                twitch.sendMessage(channel, msg);
            });
        }
    },
    friendme: {
        names: ["friendme", "addme"],
        perms: [],
        desc: "Let the streamer know that they need to add you when it's your turn to play.",
        code(channel, user) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            if (util.containsIgnoreCase(friendMe, user.username) > -1) {
                return;
            }
            if (util.containsIgnoreCase(sett.list, user.username) === -1) {
                return;
            }
            friendMe.add(user.username);
            saveFriendMe(() => {
                twitch.reply(channel, user,
                    "Okay, I'll let the streamer know that they need to add you when it's your turn!"
                );
            });
        }
    },
    nnid: {
        names: ["nnid", "setnnid"],
        perms: [],
        desc: "Set your NNID to make it easier for the streamer to find you.",
        code(channel, user, args, char) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            let name = user.username.toLowerCase();
            if (!args.length) {
                if (!users.has(name) || !users.get(name).nnid) {
                    twitch.sendWhisper(user,
                        `You don't have an NNID set yet. Set one with ${char}nnid (your nnid here) in the chat.`
                    );
                    return;
                }
                twitch.sendWhisper(user,
                    `Your NNID is: ${users.get(name).nnid}`
                );
                return;
            }
            let nnid = args.join(" ").substr(0, 16);
            if (users.has(name)) {
                users.get(name).nnid = nnid;
            } else {
                users.set(name, new User({nnid}));
            }
            saveUser(name, users.get(name), () => {
                twitch.sendWhisper(user,
                    `Okay! I set your NNID  to ${nnid}!`
                );
            });
        }
    },
    mii: {
        names: ["mii", "miiname", "setmii", "setmiiname"],
        perms: [],
        desc: "Set your Mii name to make it easier for the streamer to find you.",
        code(channel, user, args, char) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            let name = user.username.toLowerCase();
            if (!args.length) {
                if (!users.has(name) || !users.get(name).mii) {
                    twitch.sendWhisper(user,
                        `You don't have a Mii name set yet. Set one with ${char}mii (your mii name here) in the chat.`
                    );
                    return;
                }
                twitch.sendWhisper(user,
                    `Your Mii name is: ${users.get(name).mii}`
                );
                return;
            }
            let mii = args.join(" ").substr(0, 10);
            if (users.has(name)) {
                users.get(name).mii = mii;
            } else {
                users.set(name, new User({mii}));
            }
            saveUser(name, users.get(name), () => {
                twitch.sendWhisper(user,
                    `Okay! I set your Mii name to ${mii}!`
                );
            });
        }
    },
    me: {
        names: ["me"],
        perms: [],
        desc: "Check your NNID, Mii name and position on the list.",
        code(channel, user, args, char) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            let name = args.length ? args[0].replace("@", "").toLowerCase() : user.username.toLowerCase();
            let msgErr = name === user.username.toLowerCase() ?
                `You don't have any information set yet! Use ${char}nnid and ${char}mii in the chat to set up your info.` :
                `${args[0].replace("@", "")} doesn't have any information set yet!`;
            if (!users.has(name)) {
                twitch.reply(channel, user, msgErr);
                return;
            }
            let u = users.get(name);
            let msg = "";
            if (u.nnid) {
                msg += `NNID: ${u.nnid}`;
            }
            if (u.mii) {
                msg += `, MII: ${u.mii}`;
            }
            if (!okDayLimit(u, sett, channel)) {
                msg += ". You cannot join the list yet because you already played too recently.";
            }
            let pos = sett.list.indexOf(name);
            if (pos > -1) {
                msg += `, List position: ${pos + 1}`;
            }
            if (!msg) {
                twitch.reply(channel, user, msgErr);
                return;
            }
            twitch.reply(channel, user, msg);
        }
    }
};

function Settings(prev = {}) {
    this.limit = prev.limit || 10;
    this.open = prev.open || false;
    this.list = prev.list || [];
    this.enabled = prev.enabled || false;
    this.subs = prev.subs || true;
    this.nnid = prev.nnid || "(set an nnid with !streamernnid [nnid])";
    this.dayLimit = prev.dayLimit || 0;
    this.subLimit = prev.subLimit || true;
    this.randomMode = false;
    this.randomList = prev.randomList || [];
}

function User(prev = {}) {
    this.nnid = prev.nnid || null;
    this.mii = prev.mii || null;
    this.lastPlayed = prev.lastPlayed || {};
}

function help() {
    return util.dedent`__Twitchlist Plugin__
        This plugin is helpful for managing a list for Twitch channels, such as streamer vs. viewers battles.
        Note that this plugin requires you to have Mushybot in your Twitch channel.

        Twitch Commands:
        ${util.generateCommandsInfo(twitchCommands)}`;
}

module.exports = {
    name: "twitchlist",
    help,
    load,
    unload,
    twitchCommands
};
