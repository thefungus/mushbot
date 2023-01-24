"use strict";
let async = require("async");
let util = require("../../util.js");
let database = require(util.DATABASE);

let reminders;
let reminderInterval;
let mush;

function load(mb, cb) {
    async.parallel([
        loadReminders,
        startReminders,
        (cb) => {
            mush = mb;
            setTimeout(cb, 4);
        }
    ], cb);
}

function unload(mb, cb) {
    stopReminders();
    cb();
}

function loadReminders(cb) {
    database.loadAll("reminders", (err, docs) => {
        if (err) {
            return cb(err);
        }
        reminders = new Set();
        for (let doc of docs) {
            reminders.add(doc.data);
        }
        cb();
    });
}

function saveReminder(id, data, cb) {
    database.saveData("reminders", id, data, cb);
}

function deleteReminder(id, cb) {
    database.deleteData("reminders", id, cb);
}

function startReminders(cb) {
    reminderInterval = setInterval(remindUser, 1000 * 60);
    cb();
}

function stopReminders() {
    clearInterval(reminderInterval);
}

// Looks through the list of existing reminders and resolves them if they are
// due to be resolved.
function remindUser() {
    for (let reminder of reminders) {
        if (reminder.time <= Date.now()) {
            let user = mush.users.find("id", reminder.id);
            if (user) {
                user.send(`Reminder: ${reminder.message}`);
            }
            reminders.delete(reminder);
            deleteReminder(reminder.id, () => {});
        }
    }
}

// Words to ignore in the reminder command format.
// Example: "!remind me to do laundry in 10 minutes" should ignore "me" and "to".
let wordsIgnore = new Set(["me", "to", "about", "of"]);

let commands = {
    remind: {
        names: ["remind"],
        allowPrivate: true,
        perms: [],
        desc: "Set a message to be sent to you by mushbot after a specified amount time.",
        code(msg, args, argsStr, cmdName, char) {
            let message = args;
            while (message.length > 1) {
                if (wordsIgnore.has(message[0].toLowerCase())) {
                    message.shift();
                } else {
                    break;
                }
            }

            if (message.length == 0) {
                msg.reply(
                    `Error in formatting reminder.
                    Example reminder: \`${char}${cmdName} me to do laundry in 5 hours 15 minutes\``
                );
                return;
            }

            let i = message.length;
            let timeString;
            while (i--) {
                if (message[i].toLowerCase() == "in" ||
                  message[i].toLowerCase() == "after") {
                    timeString = message.splice(i);
                    break;
                }
            }
            let newMsg = message.join(" ");

            if (timeString.length < 2) {
                msg.reply(
                    `Error in formatting reminder.
                    Example reminder: \`${char}${cmdName} me to do laundry in 5 hours 15 minutes\``
                );
                return;
            }

            let time = 0;
            let j = 0;
            while (j < timeString.length - 1) {
                let s = timeString[j];

                let num = parseFloat(s);
                if (!isNaN(num)) {
                    switch (timeString[j+1].toLowerCase()) {
                        case "min":
                        case "mins":
                        case "minute":
                        case "minutes":
                        case "minutes.":
                            time += 1000 * 60 * num;
                            break;
                        case "hour":
                        case "hours":
                        case "hours.":
                            time += 1000 * 60 * 60 * num;
                            break;
                        case "day":
                        case "days":
                        case "days.":
                            time += 1000 * 60 * 60 * 24 * num;
                            break;
                    }
                    j++;
                }

                j++;
            }

            if (time == 0) {
                msg.reply(
                    `Error in formatting reminder.
                    Example reminder: ${char}${cmdName} me to do laundry in 5 hours 15 minutes`
                );
                return;
            }

            let reminder = {
                time: Date.now() + time,
                message: newMsg,
                id: msg.author.id
            };

            saveReminder(msg.author.id, reminder, () => {
                reminders.add(reminder);
                msg.reply("Reminder set! If you had a previous reminder, it was overwritten.");
            });
        }
    }
};

function help() {
    return util.dedent`__Reminder Plugin__
        This plugin lets you set reminders for yourself in the future.
        Format for the command: \`!remind me to do laundry in 5 hours 15 minutes\`

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "reminder",
    help,
    load,
    unload,
    commands
};
