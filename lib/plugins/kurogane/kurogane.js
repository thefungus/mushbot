"use strict";
let util = require("../../util.js");

let keywords = new Map();
let link = "http://kuroganehammer.com/Smash4/";

function load(mb, cb) {
    let characters = {
        "Bayonetta": [
            "bayo", "bayonetta", "bayonigga", "bayoniggas", "bayonig", "bayonigs"
        ],
        "Bowser": [
            "bowser", "boozer", "bowzer", "booser", "king koopa", "koopa king"
        ],
        "Bowser%20Jr": [
            "bowserjr", "bowser jr", "bowser jr.", "bowserjr.", "lemmy",
            "ludwig", "wendy", "iggy", "morton", "larry", "bjr", "bj",
            "baby bowser"
        ],
        "Captain%20Falcon": [
            "captain falcon", "falcon", "capt falcon", "captfalcon",
            "captainfalcon", "cf"
        ],
        "Charizard": [
            "charizard", "lizardon", "zard", "char"
        ],
        "Cloud": [
            "cloud", "kuraudo"
        ],
        "Corrin": [
            "corrin", "kamui", "corn"
        ],
        "Dark%20Pit": [
            "dark pit", "dank pit", "darkpit", "dankpit", "dp"
        ],
        "Diddy%20Kong": [
            "diddy", "diddy kong", "diddykong"
        ],
        "Donkey%20Kong": [
            "donkey kong", "donkeykong", "dk", "d.k.", "d.k", "dong"
        ],
        "Dr.%20Mario": [
            "dr. mario", "doc", "dr mario", "dr.mario", "drmario", "doctor mario",
            "doctormario", "doc mario", "docmario"
        ],
        "Duck%20Hunt": [
            "dhd", "duck hunt", "duckhunt", "dh"
        ],
        "Falco": [
            "falco"
        ],
        "Fox": [
            "fox", "fox mccloud", "foxxy"
        ],
        "Ganondorf": [
            "ganon", "ganondorf", "gannon", "gannondorf"
        ],
        "Greninja": [
            "greninja", "gekkouga", "frog", "dat boi"
        ],
        "Ike": [
            "ike"
        ],
        "Jigglypuff": [
            "jiggs", "jigg", "jigglypuff", "puff", "purin"
        ],
        "King%20Dedede": [
            "king dedede", "kingdedede", "dedede", "ddd", "d3", "dx3"
        ],
        "Kirby": [
            "kirby"
        ],
        "Link": [
            "link"
        ],
        "Little%20Mac": [
            "little mac", "lil mac", "littlemac", "lilmac", "mac"
        ],
        "Lucario": [
            "lucario"
        ],
        "Lucas": [
            "lucas"
        ],
        "Lucina": [
            "lucina", "female marth"
        ],
        "Luigi": [
            "luigi"
        ],
        "Mario": [
            "mario"
        ],
        "Marth": [
            "marth", "male lucina"
        ],
        "Mega%20Man": [
            "megaman", "mega man", "mm"
        ],
        "Meta%20Knight": [
            "meta knight", "metaknight", "mk"
        ],
        "Mewtwo": [
            "mewtwo", "m2", "mew2", "mew two", "mew 2"
        ],
        "Mii": [
            "mii", "mii fighter", "miifighter"
        ],
        "Mii%20Swordfighter": [
            "mii swordfighter", "swordfighter", "swordsman", "swordman",
            "mii swordsman", "mii swordman", "mii swords", "mii sword"
        ],
        "Mii%20Brawler": [
            "mii brawler", "brawler", "miibrawler"
        ],
        "Mii%20Gunner": [
            "mii gunner", "miigunner", "gunner"
        ],
        "Game%20and%20Watch": [
            "game and watch", "game & watch", "g&w", "gnw", "game&watch",
            "gameandwatch", "gw", "gaw"
        ],
        "Ness": [
            "ness", "onettboy", "onettboys", "onettboyz", "onett boy", "onett boys"
        ],
        "Olimar": [
            "olimar", "alph", "pikmin"
        ],
        "PAC-MAN": [
            "pacman", "pac man", "pac-man", "pac", "pm"
        ],
        "Palutena": [
            "palutena", "palu"
        ],
        "Peach": [
            "peach", ":peach:", "🍑"
        ],
        "Pikachu": [
            "pikachu", "pika", "chu", "esam"
        ],
        "Pit": [
            "pit"
        ],
        "R.O.B": [
            "rob", "r.o.b.", "r.o.b", "robot"
        ],
        "Robin": [
            "robin", "reflet"
        ],
        "Rosalina%20and%20Luma": [
            "rosetta", "rosa", "rosalina", "rosa & luma", "rosalina & luma",
            "rosa and luma", "rosalina and luma", "rosetta & chiko",
            "rosetta and chiko", "rosaluma"
        ],
        "Roy": [
            "roy", "our boy"
        ],
        "Ryu": [
            "ryu"
        ],
        "Samus": [
            "samus", "samus aran"
        ],
        "Sheik": [
            "sheik"
        ],
        "Shulk": [
            "shulk"
        ],
        "Sonic": [
            "sonic", "sanic", "Volcania"
        ],
        "Toon%20Link": [
            "toon link", "tink", "tlink", "toonlink"
        ],
        "Villager": [
            "villager", "chillager", "grillager", "villy"
        ],
        "Wario": [
            "wario", "wah"
        ],
        "Wii%20Fit%20Trainer": [
            "wft", "wii fit trainer", "wii fit", "wiifit", "wiifittrainer"
        ],
        "Yoshi": [
            "yoshi"
        ],
        "Zelda": [
            "zelda", "zaldo"
        ],
        "Zero%20Suit%20Samus": [
            "zss", "zero suit", "zero suit samus", "zerosuit", "zerosuitsamus"
        ]
    };
    for (let i in characters) {
        for (let j of characters[i]) {
            keywords.set(j, i);
        }
    }
    cb();
}

function unload(mb, cb) {
    cb();
}

let commands = {
    kuroganehammer: {
        names: ["kuroganehammer", "kurogane", "kh"],
        allowPrivate: true,
        perms: [],
        userCd: 10,
        desc: "Display information about the mentioned character.",
        code(msg, args, argsStr) {
            if (keywords.has(argsStr.toLowerCase())) {
                msg.reply(link + keywords.get(argsStr.toLowerCase()));
                return "10";
            }
        }
    }
};

function help() {
    return util.dedent`__Kurogane Hammer Plugin__
        This plugin lets you check different Sm4sh characters' information on Kurogane Hammer. Links pulled from http://kuroganehammer.com/Smash4.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "kurogane",
    help,
    load,
    unload,
    commands
};
