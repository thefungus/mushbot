"use strict";
let CC = require("currency-converter-lt");
let util = require("../../util.js");

function load(mb, cb) {
    cb();
}

function unload(mb, cb) {
    cb();
}

let commands = {
    convertcurrency: {
        names: ["convertcurrency", "currencyconvert"],
        allowPrivate: true,
        perms: [],
        desc: "Convert from one currency to another.",
        code(msg, args, argsStr, cmdName, char) {
            let message = args;
            if (message.length == 0) {
                msg.reply(
                    `Error in formatting currency conversion.\nExample: \`${char}${cmdName} 100 usd to cad\``
                );
                return;
            }

            let currencyFrom, currencyTo, amount;

            for (let i = 0; i < message.length; i++) {
                if (message[i].toLowerCase() == "to" && message.length > i+1) {
                    currencyTo = message[i+1];
                    break;
                }

                let num = parseFloat(message[i]);
                if (!isNaN(num)) {
                    amount = num;
                } else {
                    if (currencyFrom == null) {
                        currencyFrom = message[i];
                    } else if (currencyTo == null) {
                        currencyTo = message[i];
                    }
                }
            }

            if (!currencyFrom || !currencyTo || !amount) {
                msg.reply(
                    `Error in formatting currency conversion.\nExample: \`${char}${cmdName} 100 usd to cad\``
                );
                return;
            }

            let converter = new CC();
            try {
                converter.from(currencyFrom).to(currencyTo).amount(amount).convert().then((response) => {
                    msg.reply(`${response} ${currencyTo}`);
                }).catch(err => {
                    msg.reply(
                        `Error with the formatting or something went wrong with the conversion (${err})`
                    );
                });
            } catch (err) {
                msg.reply(
                    `Error with the formatting or something went wrong with the conversion (${err})`
                );
            }
        }
    }
};


function help() {
    return util.dedent`__Currency Conversion Plugin__
        Plugin for converting from one currency to another.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "currency",
    help,
    load,
    unload,
    commands
};
