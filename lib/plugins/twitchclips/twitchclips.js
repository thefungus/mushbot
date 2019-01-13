"use strict";
let async = require("async");
let GoogleSheet = require("google-spreadsheet");
let util = require("../../util.js");
let twitch = require(util.TWITCH);
let creds = require(util.CREDS);

let doc = new GoogleSheet(creds.gsheets.twitchclips);
let sheet;

let clipRegex = /(https?:\/\/)?clips\.twitch\.tv\/\S+/;

function load(mb, cb) {
    twitch.addEvent("chat", chatHandler);
    async.series([
        auth,
        getWorksheet
    ], cb);
}

function unload(mb, cb) {
    twitch.removeEvent("chat", chatHandler);
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

function addClip(Poster, Link, cb) {
    sheet.addRow({
        Poster,
        Link,
        Date: `${new Date().toDateString().slice(4)} ${new Date().toTimeString().slice(0, 8)}`
    }, cb);
}

function chatHandler(channel, user, message, self) {
    if (self) {
        return;
    }
    if (channel !== "#nairomk" && channel !== "#thefungus") {
        return;
    }
    let res = clipRegex.exec(message);
    if (res) {
        addClip(user.username, res[0], (err) => {
            if (err) {
                return console.log(err);
            }
        });
    }
}

let twitchCommands = {};

function help() {

}

module.exports = {
    name: "twitchfilter",
    help,
    load,
    unload,
    twitchCommands
};
