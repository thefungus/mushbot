"use strict";
let async = require("async");
let fs = require("fs-extra");
let util = require("../../util.js");
let cmds = require(util.COMMANDS);

let games = new Map();
let tempStart = new Map();
let tempChannels = new Set();
let tempAdv = new Map();
let tos = new Map();
let figures = [];

function load(mb, cb) {
    loadFigures((err) => {
        if (err) {
            return cb(err);
        }
        mb.on("message", chatHandler);
        cb();
    });
}

function unload(mb, cb) {
    for (let i of tos.values()) {
        clearTimeout(i);
    }
    mb.removeListener("message", chatHandler);
    setTimeout(cb, 4);
}

function chatHandler(msg) {
    if (msg.channel.type === "dm") {
        return;
    }
    if (msg.content.charAt(0) === cmds.getCommandChar(msg.guild.id)) {
        return;
    }
    if (!games.has(msg.channel.id)) {
        return;
    }
    let game = games.get(msg.channel.id);
    if (msg.content.length === 1) {
        msg.delete();
        game.checkLetter(msg, msg.content.toLowerCase());
    } else {
        game.checkWord(msg);
    }
}

function loadFigures(cb) {
    figures = [];
    fs.readdir(`${__dirname}/figures`, (err, files) => {
        if (err) {
            return cb(err);
        }
        async.each(files, loadFigure, cb);
    });
}

function loadFigure(file, cb) {
    fs.readFile(`${__dirname}/figures/${file}`, "utf-8", (err, data) => {
        if (err) {
            return cb(err);
        }
        let parts = data.split("\n=====");
        figures.push(parts.slice(0, -1));
        cb();
    });
}

let commands = {
    hangman: {
        names: ["hangman"],
        allowPrivate: true,
        perms: [],
        desc: "Start or stop a game of hangman.",
        code(msg, args, argsStr, cmdName, char) {
            switch ((args[0] || "").toLowerCase()) {
                case "start":
                case "begin":
                    return this.start(msg, args.slice(1), char);
                case "stop":
                case "end":
                    return this.stop(msg);
                case "skip":
                case "vote":
                case "voteskip":
                case "veto":
                    return this.skip(msg);
                default:
                    msg.reply(
                        util.dedent`To start a game of hangman, use \`${char}hangman start\` in a channel.
                        To end a game of hangman, use \`${char}hangman stop\`.`
                    );
            }
        },
        start(msg, args, char) {
            if (msg.channel.type === "dm") {
                if (!tempStart.has(msg.author.id)) {
                    msg.author.send(
                        "Before using the hangman command here, use `!hangman start` in the channel you want to start the game in!"
                    );
                    return;
                }
                if (!args.length) {
                    msg.author.send(
                        util.dedent`You gotta give me a word to start the hangman game with! Use \`!hangman start [word(s)]\` to start the game.
                        You can also use \`!hangman start [word(s)] [guesses limit]\` to also set the number of incorrect guesses allowed.
                        Example: \`!hangman start mushroom kingdom 9\``
                    );
                    return;
                }
                let lim;
                let word;
                if (args.length > 1) {
                    lim = parseInt(args[args.length - 1]);
                    if (isNaN(lim)) {
                        lim = 0;
                        word = args.join(" ");
                    } else {
                        if (lim < 0) {
                            lim = 0;
                        }
                        word = args.slice(0, -1).join(" ");
                    }
                } else {
                    lim = 0;
                    word = args[0];
                }
                word = word.toLowerCase().trim();

                let game = new Game(msg.author.id, word, lim);
                games.set(tempStart.get(msg.author.id), game);
                tempChannels.delete(tempStart.get(msg.author.id));
                game.start(msg, tempStart.get(msg.author.id));

                clearTimeout(tos.get(tempStart.get(msg.author.id)));
                msg.author.send(
                    `Okay! Go back to <#${tempStart.get(msg.author.id)}> now!`
                );
                tempStart.delete(msg.author.id);
            } else {
                if (games.has(msg.channel.id)) {
                    msg.reply(
                        `A game of hangman is already in progress in this channel. If you think the game should end, vote against it with \`${char}hangman voteskip\`.`
                    );
                    return;
                }
                if (tempChannels.has(msg.channel.id)) {
                    msg.reply(
                        "A game of hangman is already being started here! Please wait until the game starts, or try again in a minute."
                    );
                    return;
                }
                if (tempAdv.has(msg.channel.id) && tempAdv.get(msg.channel.id) !== msg.author.id) {
                    msg.reply(
                        "The previous winner has a small advantage to start the next round. Try again in a few seconds."
                    );
                    return;
                }
                tempAdv.delete(msg.channel.id);
                clearTimeout(tos.get(msg.author.id));
                tempStart.set(msg.author.id, msg.channel.id);
                tempChannels.add(msg.channel.id);

                msg.author.send(
                    "Great! Please use `!hangman start [word(s)] [guesses limit]` to start the hangman game. (Don't include the [ ]!)"
                );
                msg.reply(
                    `Okay! Check your private messages here please: ${msg.client.user}`
                );
                tos.set(msg.channel.id, setTimeout(() => {
                    tempStart.delete(msg.author.id);
                    tempChannels.delete(msg.channel.id);
                }, 1000 * 60));
            }
        },
        stop(msg) {
            if (msg.channel.type === "dm") {
                msg.author.send(
                    "Please send the command in the channel where the game is in progress."
                );
                return;
            }
            if (games.has(msg.channel.id)) {
                games.get(msg.channel.id).stop(msg);
            }
        },
        skip(msg) {
            if (!games.has(msg.channel.id)) {
                return;
            }
            games.get(msg.channel.id).voteskip(msg);
        }
    },
    guess: {
        names: ["guess"],
        allowPrivate: false,
        perms: [],
        desc: "Guess a letter for the hangman game in progress, or guess the word.",
        code(msg, args) {
            if (!games.has(msg.channel.id)) {
                return;
            }
            if (!args.length) {
                return;
            }
            msg.delete();
            let game = games.get(msg.channel.id);
            if (args[0].length === 1 && args.length === 1) {
                game.checkLetter(msg, args[0].toLowerCase());
            } else {
                game.checkWord(msg);
            }
        }
    }
};

function Game(s, w, l) {
    let starter = s;
    let word = w;
    let incorrect = "";
    let guesses = "";
    let whitelist = [" ", "-", "_", "'", ",", ".", "/", "!", "?"];
    let figure = util.chooseRandom(figures);
    let limit = l || 8;
    let votes = new Set();

    this.start = (msg, ch) => {
        msg.client.channels.find("id", ch).send(
            `${getFigure(msg.client)}A game of hangman just started! Guess a letter with the \`guess [letter]\` command! There are ${limit} incorrect guesses allowed.`
        );
    };

    this.stop = (msg) => {
        if (msg.author.id !== starter) {
            return;
        }
        msg.reply(
            `Alright, the hangman game ended! The word was: \`${word}\``
        );
        games.delete(msg.channel.id);
    };

    this.checkWord = (msg) => {
        if (msg.author.id === starter) {
            return;
        }
        if (msg.content.toLowerCase().indexOf(word) > -1) {
            msg.channel.send(
                `${msg.author} guessed the Hangman word! The word was \`${word}\` and it was guessed with ${limit - incorrect.length} tr${(limit - incorrect.length) === 1 ? "y" : "ies"} left.`
            );
            endGame(msg);
        }
    };

    this.checkLetter = (msg, letter) => {
        if (msg.author.id === starter) {
            return;
        }
        if (letter.length !== 1) {
            return;
        }
        if (whitelist.indexOf(letter) > -1) {
            return;
        }
        if (guesses.indexOf(letter) > -1) {
            return;
        }
        guesses += letter;
        let slug = getSlug();
        if (word === slug) {
            msg.channel.send(
                `${msg.author} finished the Hangman word! The word was \`${word}\` and it was guessed with ${limit - incorrect.length} tr${(limit - incorrect.length) === 1 ? "y" : "ies"} left.`
            );
            endGame(msg);
            return;
        }
        if (word.indexOf(letter) === -1) {
            incorrect += letter;
        }
        if (incorrect.length === limit) {
            msg.channel.send(
                `${getFigure(msg.client)}${msg.author} guessed **${letter}**. Whoops! No more guesses are left! The word was: \`${word}\``
            );
            games.delete(msg.channel.id);
            return;
        }
        msg.channel.send(
            `${getFigure(msg.client)}${msg.author} guessed **${letter}**. Guesses so far: \`${guesses}\` ~ Guesses left: ${limit - incorrect.length}`
        );
    };

    this.voteskip = (msg) => {
        votes.add(msg.author.id);
        if (votes.size === 3) {
            msg.channel.send(
                `Okay, I guess the word was voted to get skipped! Sorry! The word was: \`${word}\``
            );
            games.delete(msg.channel.id);
        } else {
            msg.channel.send(
                `${msg.author} voted to skip this word! Votes: ${votes.size} / 3`
            );
        }
    };

    function endGame(msg) {
        games.delete(msg.channel.id);
        tempAdv.set(msg.channel.id, msg.author.id);
        tos.set(msg.author.id, setTimeout(() => {
            tempAdv.delete(msg.channel.id);
        }, 10 * 1000));
    }

    function getSlug() {
        let slug = "";
        for (let i = 0; i < word.length; i++) {
            let char = word.charAt(i);
            if (whitelist.indexOf(char) > -1) {
                slug += char;
                continue;
            }
            let g = guesses.indexOf(char);
            if (g > -1) {
                slug += char;
            } else {
                slug += "_";
            }
        }
        return slug;
    }

    function getFigure(mb) {
        let num = Math.floor(incorrect.length / limit * (figure.length - 1));
        return `\`\`\`\nHangman word by ${mb.users.find("id", starter).username}\n${figure[num]}\n\n${writeWord()}\`\`\`\n`;
    }

    function writeWord() {
        let slug = getSlug();
        return slug.split("").join(" ");
    }
}

function help() {
    return util.dedent`__Hangman Plugin__
        Play a game of hangman!

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "hangman",
    help,
    load,
    unload,
    commands
};
