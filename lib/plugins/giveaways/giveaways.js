"use strict";
let async = require("async");
let GoogleSheet = require("google-spreadsheet");
let util = require("../../util.js");
let twitch = require(util.TWITCH);
let creds = require(util.CREDS);

let doc = new GoogleSheet(creds.gsheets.giveaways);
let sheet;
let cd;
let cdTo;

function load(mb, cb) {
    async.series([
        auth,
        getWorksheet
    ], cb);
}

function unload(mb, cb) {
    clearTimeout(cdTo);
    cb();
}

function auth(cb) {
    let creds = require("./creds.json");
    doc.useServiceAccountAuth(creds, cb);
}

function getWorksheet(cb) {
    doc.getInfo((err, info) => {
        if (err) {
            return cb(err);
        }
        sheet = info.worksheets[0];
        cb();
    });
}

function addWinner(name, prize, code, cb) {
    sheet.addRow({
        "twitch name": name,
        prize,
        date: new Date().toDateString().slice(4),
        code
    }, cb);
}

function sendInstructions(user, prize, code, cb) {
    let message = `Congratulations on winning the giveaway! Please email asknairo@gmail.com the following: 1. [Your Twitch username] 2. [Your prize, ${prize}] 3. [Your full name] 4. [Your full address] 5. [This code: ${code}] Thanks!`;
    twitch.sendWhisper(user, message, cb);
}

function deleteLastWinner(cb) {
    sheet.getRows((err, rows) => {
        if (err) {
            return cb(err);
        }
        if (rows.length === 0) {
            return cb();
        }
        rows[rows.length - 1].del(cb);
    });
}

let twitchCommands = {
    winner: {
        names: ["winner", "giveawaywinner"],
        perms: ["admin"],
        desc: "(admin) Add a new giveaway winner to the winners spreadsheet.",
        code(channel, user, args, char) {
            if (channel !== "#nairomk" && channel !== "#thefungus") {
                return;
            }
            if (cd) {
                return;
            }
            if (args.length < 2) {
                twitch.sendWhisper(user,
                    `You gotta tell me their Twitch username, plus what they won! (example: ${char}winner @Mushybot zss amiibo)`
                );
                return;
            }
            let name = args[0].replace("@", "");
            let prize = args.slice(1).join(" ");
            let code = Math.random().toString(36).substr(2, 4);
            cd = true;
            cdTo = setTimeout(() => {
                cd = false;
            }, 10000);
            addWinner(name, prize, code, (err) => {
                if (err) {
                    twitch.sendWhisper(user,
                        "There was an error with saving the winner to the spreadsheet! Ask fungus about this or try again!"
                    );
                    return;
                }
                sendInstructions(name, prize, code, () => {
                    twitch.reply(channel, user,
                        "Okay! I sent them instructions for the giveaway!"
                    );
                });
            });
        }
    },
    undowinner: {
        names: ["undowinner", "undogiveaway", "undogiveawaywinner"],
        perms: ["admin"],
        desc: "(admin) Undo the last time the !winner command was used.",
        code(channel, user) {
            if (channel !== "#nairomk" && channel !== "#thefungus") {
                return;
            }
            deleteLastWinner((err) => {
                if (err) {
                    twitch.sendWhisper(user,
                        "There was an error with deleting the last winner on the spreadsheet! Ask fungus about this or try again!"
                    );
                    return;
                }
                cd = false;
                clearTimeout(cdTo);
                twitch.reply(channel, user,
                    "Done!"
                );
            });
        }
    }
};

module.exports = {
    name: "giveaways",
    load,
    unload,
    twitchCommands
};
