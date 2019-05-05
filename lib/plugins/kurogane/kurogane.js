"use strict";
let util = require("../../util.js");

let keywords = new Map();
let link = "https://ultimateframedata.com/";

function load(mb, cb) {
    let characters = {
        "bayonetta": [
            "bayo", "bayonetta", "bayonigga", "bayoniggas", "bayonig", "bayonigs"
        ],
        "bowser": [
            "bowser", "boozer", "bowzer", "booser", "king koopa", "koopa king"
        ],
        "bowser_jr": [
            "bowserjr", "bowser jr", "bowser jr.", "bowserjr.", "lemmy",
            "ludwig", "wendy", "iggy", "morton", "larry", "bjr", "bj",
            "baby bowser"
        ],
        "captain_falcon": [
            "captain falcon", "falcon", "capt falcon", "captfalcon",
            "captainfalcon", "cf"
        ],
        "pt_charizard": [
            "charizard", "lizardon", "zard", "char"
        ],
        "chrom": [
            "chrom", "chrome"
        ],
        "cloud": [
            "cloud", "kuraudo"
        ],
        "corrin": [
            "corrin", "kamui", "corn"
        ],
        "daisy": [
            "daisy"
        ],
        "dark_pit": [
            "dark pit", "dank pit", "darkpit", "dankpit", "dp", "pittoo"
        ],
        "dark_samus": [
            "dark samus", "darksamus", "dsamus", "darkspamus", "dark spamus", "dspamus"
        ],
        "diddy_kong": [
            "diddy", "diddy kong", "diddykong"
        ],
        "donkey_kong": [
            "donkey kong", "donkeykong", "dk", "d.k.", "d.k", "dong"
        ],
        "dr_mario": [
            "dr. mario", "doc", "dr mario", "dr.mario", "drmario", "doctor mario",
            "doctormario", "doc mario", "docmario"
        ],
        "duck_hunt": [
            "dhd", "duck hunt", "duckhunt", "dh"
        ],
        "falco": [
            "falco"
        ],
        "fox": [
            "fox", "fox mccloud", "foxxy"
        ],
        "ganondorf": [
            "ganon", "ganondorf", "gannon", "gannondorf"
        ],
        "greninja": [
            "greninja", "gekkouga", "frog", "dat boi"
        ],
        "ice_climbers": [
            "ice climber", "ice climbers", "ic", "ics", "icies", "ic's"
        ],
        "ike": [
            "ike"
        ],
        "incineroar": [
            "incineroar", "incin", "cineroar", "incinerawr", "incinaroar", "incinarawr"
        ],
        "inkling": [
            "inkling", "inklings"
        ],
        "isabelle": [
            "isabelle", "isa"
        ],
        "pt_ivysaur": [
            "ivysaur", "ivy"
        ],
        "jigglypuff": [
            "jiggs", "jigg", "jigglypuff", "puff", "purin"
        ],
        "joker": [
            "joker"
        ],
        "ken": [
            "ken"
        ],
        "king_dedede": [
            "king dedede", "kingdedede", "dedede", "ddd", "d3", "dx3"
        ],
        "king_k_rool": [
            "king k rool", "king k. rool", "kingkrool", "krool", "kingk", "kink", "kingk.rool", "k.rool", "k. rool"
        ],
        "kirby": [
            "kirby"
        ],
        "link": [
            "link"
        ],
        "little_mac": [
            "little mac", "lil mac", "littlemac", "lilmac", "mac"
        ],
        "lucario": [
            "lucario", "lucc"
        ],
        "lucas": [
            "lucas"
        ],
        "lucina": [
            "lucina", "female marth"
        ],
        "luigi": [
            "luigi"
        ],
        "mario": [
            "mario"
        ],
        "marth": [
            "marth", "male lucina"
        ],
        "mega_man": [
            "megaman", "mega man", "mm"
        ],
        "meta_knight": [
            "meta knight", "metaknight", "mk"
        ],
        "mewtwo": [
            "mewtwo", "m2", "mew2", "mew two", "mew 2"
        ],
        "mii_swordfighter": [
            "mii swordfighter", "swordfighter", "swordsman", "swordman",
            "mii swordsman", "mii swordman", "mii swords", "mii sword"
        ],
        "mii_brawler": [
            "mii brawler", "brawler", "miibrawler"
        ],
        "mii_gunner": [
            "mii gunner", "miigunner", "gunner"
        ],
        "mr_game_and_watch": [
            "game and watch", "game & watch", "g&w", "gnw", "game&watch",
            "gameandwatch", "gw", "gaw"
        ],
        "ness": [
            "ness", "onettboy", "onettboys", "onettboyz", "onett boy", "onett boys"
        ],
        "olimar": [
            "olimar", "alph", "pikmin", "oli"
        ],
        "pac_man": [
            "pacman", "pac man", "pac-man", "pac", "pm"
        ],
        "palutena": [
            "palutena", "palu"
        ],
        "peach": [
            "peach", ":peach:", "🍑"
        ],
        "pichu": [
            "pichu"
        ],
        "pikachu": [
            "pikachu", "pika", "chu", "esam"
        ],
        "piranha_plant": [
            "pp", "plant", "piranha plant", "pirana plant", "piranhaplant", "piranha", "pirana", "pirahna", "pirahna plant", "pirahnaplant"
        ],
        "pit": [
            "pit"
        ],
        "richter": [
            "richter", "ritcher", "richer", "rither", "ricter"
        ],
        "ridley": [
            "ridley", "rid"
        ],
        "rob": [
            "rob", "r.o.b.", "r.o.b", "robot"
        ],
        "robin": [
            "robin", "reflet"
        ],
        "rosalina_and_luma": [
            "rosetta", "rosa", "rosalina", "rosa & luma", "rosalina & luma",
            "rosa and luma", "rosalina and luma", "rosetta & chiko",
            "rosetta and chiko", "rosaluma"
        ],
        "roy": [
            "roy", "our boy"
        ],
        "ryu": [
            "ryu"
        ],
        "samus": [
            "samus", "samus aran", "spamus"
        ],
        "sheik": [
            "sheik"
        ],
        "shulk": [
            "shulk"
        ],
        "simon": [
            "simon", "sim"
        ],
        "snake": [
            "snake"
        ],
        "sonic": [
            "sonic", "sanic", "Volcania"
        ],
        "squirtle": [
            "squirtle", "squirt"
        ],
        "toon_link": [
            "toon link", "tink", "tlink", "toonlink"
        ],
        "villager": [
            "villager", "chillager", "grillager", "villy", "murabito"
        ],
        "wario": [
            "wario", "wah"
        ],
        "wii_fit_trainer": [
            "wft", "wii fit trainer", "wii fit", "wiifit", "wiifittrainer"
        ],
        "wolf": [
            "wolf"
        ],
        "yoshi": [
            "yoshi"
        ],
        "young_link": [
            "young link", "yink", "younglink", "ylink"
        ],
        "zelda": [
            "zelda", "zaldo"
        ],
        "zero_suit_samus": [
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
                msg.reply(link + keywords.get(argsStr.toLowerCase()) + ".php");
                return "10";
            }
        }
    }
};

function help() {
    return util.dedent`__Kurogane Hammer (Ultimate Frame Data) Plugin__
        This plugin lets you check different Smash Ultimate characters' information. Links pulled from https://ultimateframedata.com/.

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
