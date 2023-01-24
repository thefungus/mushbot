"use strict";
let async = require("async");
let util = require("../../util.js");
let database = require(util.DATABASE);
let twitch = require(util.TWITCH);

const ARENA_MESSAGE = "The arena information is: {{arena}}. To join, go to Online > Smash > Battle Arenas > Join Arena > Enter Arena ID, and enter the info.";

let settings;
let users;

let nextCd = false;
let nextCdTo = null;

function load(mb, cb) {
    twitch.addEvent("whisper", whisperHandler);
    async.parallel([
        loadSettings,
        loadUsers
    ], cb);
}

function unload(mb, cb) {
    twitch.removeEvent("whisper", whisperHandler);
    clearTimeout(nextCdTo);
    cb();
}

function whisperHandler(from, user, message, self) {
    if (self) {
        return;
    }
    if (!settings.has(from)) {
        return;
    }
    let sett = settings.get(from);
    if (message.indexOf("!arena") === 0) {
        let info = message.substr(7);
        if (!info.length) {
            twitch.sendWhisper(user, "Include the arena information to send to the subs. Example: !arena QGW6T, password: 1234");
            return;
        }
        sett.arena = info;
        saveSettings(from, sett, () => {
            twitch.sendWhisper(user,
                "I set your arena info! The next person on the list will get this info whispered to them!"
            );
            if (sett.list.length > 0 && sett.arena) {
                twitch.sendWhisper(users.get(sett.list[0]), ARENA_MESSAGE.replace("{{arena}}", sett.arena));
            }
        });
    }
}

function getInfo(id) {
    let user = users.get(id);
    let msg = user.username;
    if (user.tag && user.tag !== "") {
        msg += ` (${user.tag})`;
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

function saveSettings(channel, sett, cb) {
    database.saveData("twitchlist-settings", channel, sett, cb);
}

function saveUser(id, data, cb) {
    database.saveData("twitchlist-users", id, data, cb);
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

function joinRegular(channel, user, arg, char, sett) {
    if (sett.list.length >= sett.limit) {
        return;
    }
    if (sett.list.indexOf(user["user-id"]) > -1) {
        return;
    }
    if (!arg.length) {
        if (!users.has(user["user-id"])) {
            twitch.sendMessage(channel,
                `@${user.username}, You gotta enter with a tag! Say ${char}tag [your tag here] in the chat.`
            );
            twitch.sendWhisper(user,
                `You gotta enter with a tag! Say ${char}tag [your tag here] in the chat.`
            );
            return;
        } else {
            let nuser = users.get(user["user-id"]);
            if (!nuser.tag) {
                twitch.sendMessage(channel,
                    `@${user.username}, You gotta enter with a tag! Use ${char}tag [your tag here] in the chat.`
                );
                twitch.sendWhisper(user,
                    `You gotta enter with a tag! Use ${char}tag [your tag here] in the chat.`
                );
                return;
            }
        }
    }
    if (users.has(user["user-id"])) {
        let nuser = users.get(user["user-id"]);
        if (!okDayLimit(nuser, sett, channel, true)) {
            twitch.sendMessage(channel,
                `@${user.username}, You already played the streamer recently! Let's give others a chance to play!`
            );
            return;
        }
    }
    sett.list.push(user["user-id"]);
    let tag = null;
    if (arg.length) {
        tag = arg.substr(0, 10);
    }
    if (!users.has(user["user-id"])) {
        users.set(user["user-id"], new User({
            tag,
            id: user["user-id"],
            username: user.username
        }));
    } else {
        let nuser = users.get(user["user-id"]);
        nuser.tag = tag || nuser.tag;
        nuser.username = user.username;
    }
    saveUser(user["user-id"], users.get(user["user-id"]), () => {
        saveSettings(channel, sett, () => {
            twitch.sendMessage(channel,
                `@${getInfo(user["user-id"])} joined the list!`
            );
            if (sett.list.length === sett.limit) {
                twitch.sendAction(channel,
                    "THE LIST IS FULL NOW! Let's get this started!"
                );
            }
            if (sett.list.length === 1 && sett.arena) {
                twitch.sendWhisper(user, ARENA_MESSAGE.replace("{{arena}}", sett.arena));
            }
        });
    });
}

function joinRandom(channel, user, arg, char, sett) {
    if (sett.randomList.indexOf(user["user-id"]) > -1) {
        return;
    }
    if (!arg.length) {
        if (!users.has(user["user-id"])) {
            twitch.sendMessage(channel,
                `@${user.username}, You gotta enter with a tag! Use ${char}tag [your tag here] in the chat.`
            );
            twitch.sendWhisper(user,
                `You gotta enter with a tag! Use ${char}tag [your tag here] in the chat.`
            );
            return;
        } else {
            let nuser = users.get(user["user-id"] );
            if (!nuser.tag) {
                twitch.sendMessage(channel,
                    `@${user.username}, You gotta enter with a tag! Use ${char}tag [your tag here] in the chat.`
                );
                twitch.sendWhisper(user,
                    `You gotta enter with a tag! Use ${char}tag [your tag here] in the chat.`
                );
                return;
            }
        }
    }
    if (users.has(user["user-id"])) {
        let nuser = users.get(user["user-id"]);
        if (!okDayLimit(nuser, sett, channel, true)) {
            twitch.sendMessage(channel,
                `@${user.username}, You already played the streamer recently! Let's give others a chance to play!`
            );
            return;
        }
    }
    sett.randomList.push(user["user-id"]);
    let tag = null;
    if (arg.length) {
        tag = arg.substr(0, 10);
    }
    if (!users.has(user["user-id"])) {
        users.set(user["user-id"], new User({
            tag,
            id: user["user-id"],
            username: user.username
        }));
    } else {
        let nuser = users.get(user["user-id"]);
        nuser.tag = tag || nuser.tag;
        nuser.username = user.username;
    }
    saveUser(user["user-id"], users.get(user["user-id"]), () => {
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
        if (sett.list.length > 0 && sett.arena) {
            twitch.sendWhisper(users.get(sett.list[0]), ARENA_MESSAGE.replace("{{arena}}", sett.arena));
        }
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
                    `List commands now enabled! Commands: ${char}off, ${char}list, ${char}win/next, ${char}limit, ${char}open subs/all, ${char}close, ${char}clear, ${char}swap/add/remove, ${char}randomlist`
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
                twitch.sendMessage(channel, `Current list (1): ${getInfo(sett.list[0])}`);
                return "11";
            }
            let list = [].concat(getInfo(sett.list[0], true), sett.list.slice(1).map((id) => getInfo(id)).join(", "));
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
            let id = sett.list.shift();
            if (users.has(id)) {
                let user = users.get(id);
                user.lastPlayed[channel] = Date.now();
                saveUser(id, user);
            }
            activateNextCd();
            saveSettings(channel, sett, () => {
                let message;
                if (sett.list.length === 0) {
                    message = "The list is empty now! Woohoo!";
                } else {
                    message = `Up next: ${getInfo(sett.list[0])}!`;
                    if (sett.arena) {
                        twitch.sendWhisper(users.get(sett.list[0]), ARENA_MESSAGE.replace("{{arena}}", sett.arena));
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
                    `The list is now OPEN for ${sett.subs ? "subscribers" : "anyone"}! Limit of ${sett.limit} players. Join by typing ${char}enter [tag]`
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
                    `20 seconds remain to join the random list! Enter to have a chance of joining the sub list! Join by typing ${char}enter [tag]`
                );
            }, 10000);
            setTimeout(() => {
                twitch.sendAction(channel,
                    `10 seconds remain to join the random list! Enter to have a chance of joining the sub list! Join by typing ${char}enter [tag]`
                );
            }, 20000);
            saveSettings(channel, sett, () => {
                twitch.sendAction(channel,
                    `The RANDOM list is now OPEN for ${sett.subs ? "subscribers" : "anyone"}! ${sett.limit} players will be selected. Join by typing ${char}enter [tag]`
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
            saveSettings(channel, sett, () => {
                twitch.reply(channel, user,
                    "Cleared the list!"
                );
            });
        }
    },
    add: {
        names: ["add", "move"],
        perms: ["admin"],
        desc: "(admins) Add a user to the list. Use `!add [@name] [number]` to put them at a specific spot on the list (like `!add @thefungus 3`), or just `!add [@name]`.",
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
                    `Add someone to the list with ${char}add [@name]. You can also specify a position to place them at with ${char}add [@name] [position].`
                );
                return;
            }
            let name = args[0].replace("@", "").toLowerCase();
            let id = null;
            for (let u of users) {
                if (u[1].username.toLowerCase() === name) {
                    id = u[0];
                }
            }
            if (!id) {
                twitch.reply(channel, user,
                    `Please tell the user to use the ${char}tag [their tag] command before adding them to the list!`
                );
                return;
            }
            let prevpos = sett.list.indexOf(id);
            if (prevpos > -1) {
                sett.list.splice(prevpos, 1);
            }
            let pos = null;
            if (args.length > 1) {
                pos = parseInt(args[1]);
                if (isNaN(pos)) {
                    pos = null;
                } else if (pos > sett.list.length) {
                    pos = null;
                }
            }
            let nuser = users.get(id);
            let warn = false;
            if (!okDayLimit(nuser, sett, channel)) {
                warn = true;
            }
            if (pos === null) {
                sett.list.push(id);
            } else {
                sett.list = sett.list.slice(0, pos - 1).concat(id, sett.list.slice(pos - 1));
            }
            saveUser(id, users.get(id), () => {
                saveSettings(channel, sett, () => {
                    twitch.reply(channel, user,
                        `Added ${nuser.username} to the list!${warn ? " They already played recently though!" : ""}`
                    );
                    if (sett.list.indexOf(id) === 0 && sett.arena) {
                        twitch.sendWhisper(nuser, ARENA_MESSAGE.replace("{{arena}}", sett.arena));
                    } else if (prevpos === 0 && sett.list.indexOf(id) !== 0) {
                        twitch.sendWhisper(users.get(sett.list[0]), ARENA_MESSAGE.replace("{{arena}}", sett.arena));
                    }
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
            let name = args[0].replace("@", "").toLowerCase();
            let id = null;
            for (let u of users) {
                if (u[1].username.toLowerCase() === name) {
                    id = u[0];
                }
            }
            if (!id) {
                twitch.reply(channel, user,
                    `Please tell the user to use the ${char}tag [their tag] command before removing them from the list! Though this is weird and shouldn't happen...`
                );
                return;
            }
            let pos = sett.list.indexOf(id);
            if (pos === -1) {
                twitch.reply(channel, user,
                    "That person isn't on the list."
                );
                return;
            }
            sett.list.splice(pos, 1);
            saveSettings(channel, sett, () => {
                let msg = `Removed ${args[0].replace("@", "")} from the list!`;
                if (pos === 0) {
                    if (sett.list.length === 0) {
                        msg += " The list is empty now! Woohoo!";
                    } else {
                        msg += ` Next up is ${getInfo(sett.list[0])}!`;
                        if (sett.arena) {
                            twitch.sendWhisper(users.get(sett.list[0]), ARENA_MESSAGE.replace("{{arena}}", sett.arena));
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
            let id0 = null;
            let id1 = null;
            for (let u of users) {
                if (u[1].username.toLowerCase() === user0) {
                    id0 = u[0];
                }
                if (u[1].username.toLowerCase() === user1) {
                    id1 = u[0];
                }
            }
            if (!id0 || !id1) {
                twitch.reply(channel, user,
                    `Please tell the users to use the ${char}tag [their tag] command before swapping them to the list!`
                );
                return;
            }

            let pos1 = sett.list.indexOf(id0);
            let pos2 = sett.list.indexOf(id1);
            if (pos1 === -1 && pos2 === -1) {
                twitch.reply(channel, user,
                    "Come on! At least one of them has to be on the list!"
                );
                return;
            }
            if (pos1 > -1 && pos2 > -1) {
                let temp = sett.list[pos1];
                sett.list[pos1] = sett.list[pos2];
                sett.list[pos2] = temp;
                saveSettings(channel, sett, () => {
                    twitch.reply(channel, user,
                        `I swapped ${user0} and ${user1} on the list!`
                    );
                });
                return;
            }
            if (pos1 > -1) {
                sett.list[pos1] = id1;
            } else {
                sett.list[pos2] = id0;
            }
            saveSettings(channel, sett, () => {
                twitch.reply(channel, user,
                    `I swapped ${user0} and ${user1} on the list!`
                );
                if (sett.arena) {
                    if (pos1 === 0) {
                        twitch.sendWhisper(user1, ARENA_MESSAGE.replace("{{arena}}", sett.arena));
                    } else if (pos2 === 0) {
                        twitch.sendWhisper(user0, ARENA_MESSAGE.replace("{{arena}}", sett.arena));
                    }
                }
            });
        }
    },
    enter: {
        names: ["enter", "enterlist", "join", "joinlist"],
        perms: [],
        desc: "Enter the list when the list is open. You should use `!enter [tag]` if you haven't set your tag yet.",
        code(channel, user, args, char) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            if (sett.subs && !twitch.isSub(user)) {
                return;
            }
            if (sett.randomMode) {
                return joinRandom(channel, user, args.join(" "), char, sett);
            }
            if (sett.open) {
                return joinRegular(channel, user, args.join(" "), char, sett);
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
            let pos = sett.list.indexOf(user["user-id"]);
            if (pos === -1) {
                return;
            }
            sett.list.splice(pos, 1);
            saveSettings(channel, sett, () => {
                let msg = `@${user.username} left the list!`;
                if (pos === 0) {
                    if (sett.list.length === 0) {
                        msg += " The list is empty now! Woohoo!";
                    } else {
                        msg += ` Next up is ${getInfo(sett.list[0])}!`;
                        if (sett.arena) {
                            twitch.sendWhisper(users.get(sett.list[0]), ARENA_MESSAGE.replace("{{arena}}", sett.arena));
                        }
                    }
                }
                twitch.sendMessage(channel, msg);
            });
        }
    },
    tag: {
        names: ["tag", "settag"],
        perms: [],
        desc: "Set your tag to make it easier for the streamer to find you.",
        code(channel, user, args, char) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            if (!args.length) {
                if (!users.has(user["user-id"])) {
                    console.log("sending tag to " + user.username);
                    twitch.sendWhisper(user,
                        `You don't have a tag set yet. Set one with ${char}tag [your tag here] in the chat.`
                    );
                    return;
                }
                console.log("sending tag to " + user.username);
                twitch.sendWhisper(user,
                    `Your tag is: ${users.get(user["user-id"]).tag}`
                );
                return;
            }
            let tag = args.join(" ").substr(0, 10);
            if (users.has(user["user-id"])) {
                users.get(user["user-id"]).tag = tag;
                users.get(user["user-id"]).username = user.username;
            } else {
                users.set(user["user-id"], new User({
                    tag,
                    username: user.username,
                    id: user["user-id"]
                }));
            }
            saveUser(user["user-id"], users.get(user["user-id"]), () => {
                console.log("setting tag for " + user.username);
                twitch.sendWhisper(user,
                    `Okay! I set your tag  to ${tag}!`
                );
            });
        }
    },
    me: {
        names: ["me"],
        perms: [],
        desc: "Check your tag and position on the list.",
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
                `You don't have any information set yet! Use ${char}tag [your tag] in the chat to set your info.` :
                `${args[0].replace("@", "")} doesn't have any info set yet!`;
            let id = null;
            if (!args.length) {
                id = user["user-id"];
            } else {
                for (let u of users) {
                    if (u[1].username.toLowerCase() === name) {
                        id = u[0];
                    }
                }
                if (!id) {
                    twitch.sendWhisper(user, msgErr);
                    return;
                }
            }

            if (!users.has(id)) {
                twitch.sendWhisper(user, msgErr);
                return;
            }
            let u = users.get(id);
            let msg = "";
            if (u.tag) {
                msg += `Tag: ${u.tag}.`;
            }
            if (!okDayLimit(u, sett, channel)) {
                msg += " You cannot join the list yet because you already played too recently.";
            }
            let pos = sett.list.indexOf(id);
            if (pos > -1) {
                msg += ` List position: ${pos + 1}.`;
            }
            if (!msg) {
                twitch.sendWhisper(user, msgErr);
                return;
            }
            twitch.sendWhisper(user, msg);
        }
    },
    arena: {
        names: ["arena"],
        perms: [],
        desc: "Get the bot to whisper you the arena info if you're a mod or next in line.",
        code(channel, user) {
            if (!settings.has(channel)) {
                return;
            }
            let sett = settings.get(channel);
            if (!sett.enabled) {
                return;
            }
            if (sett.list.indexOf(user["user-id"]) !== 0 && !twitch.isOp(channel, user)) {
                return;
            }
            if (!sett.arena) {
                twitch.sendWhisper(user, "The arena info hasn't been set yet. Wait for the streamer to set it up.");
                return;
            }
            twitch.sendWhisper(user, ARENA_MESSAGE.replace("{{arena}}", sett.arena));
        }
    }
};

function Settings(prev = {}) {
    this.limit = prev.limit || 10;
    this.open = prev.open || false;
    this.list = prev.list || [];
    this.enabled = prev.enabled || false;
    this.subs = prev.subs || true;
    this.dayLimit = prev.dayLimit || 0;
    this.subLimit = prev.subLimit || true;
    this.randomMode = false;
    this.randomList = prev.randomList || [];
    this.arena = prev.arena || null;
}

function User(prev = {}) {
    this.id = prev.id || null;
    this.tag = prev.tag || null;
    this.username = prev.username || null;
    this.lastPlayed = prev.lastPlayed || {};
}

function help() {
    return util.dedent`__Twitchlist Plugin__
        This plugin is helpful for managing a sub games list for Smash Ultimate lobbies.
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
