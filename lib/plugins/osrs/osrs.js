"use strict";
let util = require("../../util.js");
let database = require(util.DATABASE);

const Async = require("async");
const math = require("mathjs");
const Table = require("ascii-table");
const osrs = require("./osrs-tools.js");

var aliases = new Map();

function load(mb, cb) {
    loadAliases(cb);
}

function unload(mb, cb) {
    cb();
}

function loadAliases(cb) {
    aliases.clear();
    database.loadAll("osrs-aliases", (err, docs) => {
        if (err) {
            return cb(err);
        }
        for (let doc of docs) {
            aliases.set(doc._id, doc.data);
        }
        cb();
    });
}

function saveAlias(alias, item, cb) {
    database.saveData("osrs-aliases", alias, item, cb);
}

// Blast furnace constants and helper functions
const BF = {
    // Item IDs
    ITEMS: {
        COAL: 453,
        IRON_ORE: 440,
        MITHRIL_ORE: 447,
        ADAMANTITE_ORE: 449,
        RUNITE_ORE: 451,
        STEEL_BAR: 2353,
        MITHRIL_BAR: 2359,
        ADAMANTITE_BAR: 2361,
        RUNITE_BAR: 2363,
        STAMINA_POTION: 12625
    },
    ITEMS_STEEL: {
        COAL: 453,
        ORE: 440,
        BAR: 2353,
        STAMINA_POTION: 12625
    },
    ITEMS_MITHRIL: {
        COAL: 453,
        ORE: 447,
        BAR: 2359,
        STAMINA_POTION: 12625
    },
    ITEMS_ADAMANTITE: {
        COAL: 453,
        ORE: 449,
        BAR: 2361,
        STAMINA_POTION: 12625
    },
    ITEMS_RUNE: {
        COAL: 453,
        ORE: 451,
        BAR: 2363,
        STAMINA_POTION: 12625
    },
    MISC: {
        INV_SPACE: 52,
        COFFER: 72000,
        BARS_HR: 4600,
        ORES_TRIP: 26
    },
    // End Item IDs

    // Coal and XP per bar
    Steel: {
        COAL: 1,
        EXP: 17.5
    },
    Mithril: {
        COAL: 2,
        EXP: 30
    },
    Adamantite: {
        COAL: 3,
        EXP: 37.5
    },
    Runite: {
        COAL: 4,
        EXP: 50
    },
    // End coal and XP per bar

    // Helper functions
    ORES_TRIP(type) {
        return Math.floor(BF.MISC.INV_SPACE / (BF[type].COAL + 1));
    },
    BARS_HOUR(type) {
        return Math.floor(
            BF.MISC.BARS_HR * BF.ORES_TRIP(type) / BF.MISC.ORES_TRIP
        );
    },
    GP_HOUR(type, ore, bar, coal, stam) {
        return Math.floor(
            (bar - ore - (coal * BF[type].COAL)) *
            BF.BARS_HOUR(type) - BF.MISC.COFFER - 7 * stam
        );
    },
    XP_HOUR(type) {
        return Math.floor(BF.BARS_HOUR(type) * BF[type].EXP);
    },
    TABLE_ROW(type, ore, bar, coal, stam) {
        return [
            type,
            ore.toLocaleString(),
            bar.toLocaleString(),
            BF.ORES_TRIP(type),
            BF.BARS_HOUR(type).toLocaleString(),
            BF.GP_HOUR(type, ore, bar, coal, stam).toLocaleString(),
            BF.XP_HOUR(type).toLocaleString()
        ];
    }
    // End helper functions
};

// Herb run constants and helper functions
const HERBS = {
    // Item IDs
    ITEMS: {
        HERB_RANARR: 207,
        SEED_RANARR: 5295,
        HERB_TOADFLAX: 3049,
        SEED_TOADFLAX: 5296,
        HERB_AVANTOE: 211,
        SEED_AVANTOE: 5298,
        HERB_KWUARM: 213,
        SEED_KWUARM: 5299,
        HERB_SNAPDRAGON: 3051,
        SEED_SNAPDRAGON: 5300,
        HERB_TORSTOL: 219,
        SEED_TORSTOL: 5304,
        ULTRACOMPOST: 21483
    },
    // Other constants
    MISC: {
        AVG_YIELD: 8.71472445,
        NUM_PATCHES: 6
    },
    // Helper functions
    AVG_PROFIT_SEED(seed, herb, ultra) {
        return Math.floor(herb * HERBS.MISC.AVG_YIELD - seed - ultra);
    },
    AVG_PROFIT_RUN(seed, herb, ultra) {
        return Math.floor(HERBS.AVG_PROFIT_SEED(seed, herb, ultra) * 6);
    },
    TABLE_ROW(type, seed, herb, ultra) {
        return [
            type,
            seed.toLocaleString(),
            herb.toLocaleString(),
            HERBS.AVG_PROFIT_SEED(seed, herb, ultra).toLocaleString(),
            HERBS.AVG_PROFIT_RUN(seed, herb, ultra).toLocaleString()
        ];
    }
    // End helper functions
};

// Get blast furnace info for all ore types and returns a callback with
// a table as a string.
// Fetches info from the osrs API.
function getBFInfo(callback) {
    Async.map(
        util.objectValues(BF.ITEMS),
        function(id, cb) {
            osrs.price(id)
                .then(item => {
                    cb(null, item);
                })
                .catch(err => {
                    cb(err);
                });
        },
        function(err, res) {
            if (err) {
                return callback(`Error getting the info. Try again later. Error: ${err}`);
            }
            let ores = {
                Steel: {
                    ore: res[1].buy(),
                    bar: res[5].sell()
                },
                Mithril: {
                    ore: res[2].buy(),
                    bar: res[6].sell()
                },
                Adamantite: {
                    ore: res[3].buy(),
                    bar: res[7].sell()
                },
                Runite: {
                    ore: res[4].buy(),
                    bar: res[8].sell()
                }
            };
            let stamina = res[9].buy();
            let coal = res[0].buy();

            let table = new Table()
                .setHeading("Type", "Ore Price", "Bar Price", "Ores/trip", "Bars/hour", "GP/hour", "XP/hour");

            for (let i in ores) {
                table.addRow(BF.TABLE_ROW(i, ores[i].ore, ores[i].bar, coal, stamina));
            }

            table.addRow("Coal", coal)
                .setAlignRight(1)
                .setAlignRight(2)
                .setAlignRight(3)
                .setAlignRight(4)
                .setAlignRight(5)
                .setAlignRight(6);

            let result = util.dedent`**__Blast Furnace GP & XP Info__**\`\`\`
            ${table.toString()}\`\`\``;

            callback(result);
        }
    );
}

// Get blast furnace info for a specific ore kind and returns a callback
// with a discord embed.
// Fetches info from the osrs API.
function getBFInfoType(kind, callback) {
    let type, name;
    switch (kind) {
        case "steel":
        case "iron":
            type = BF.ITEMS_STEEL;
            name = "STEEL";
            break;
        case "mith":
        case "mithril":
            type = BF.ITEMS_MITHRIL;
            name = "MITHRIL";
            break;
        case "addy":
        case "adamant":
        case "adamantite":
            type = BF.ITEMS_ADAMANTITE;
            name = "ADAMANTITE";
            break;
        case "rune":
        case "runite":
            type = BF.ITEMS_RUNITE;
            name = "RUNITE";
            break;
        default:
            return callback("Error: invalid material type");
    }

    Async.map(
        util.objectValues(type),
        function(id, cb) {
            osrs.price(id)
                .then(item => {
                    cb(null, item);
                })
                .catch(err => {
                    cb(err);
                });
        },
        function(err, res) {
            if (err) {
                return callback(`Error getting the info. Try again later. Error: ${err}`);
            }

            osrs.info(type.BAR)
                .then(barInfo => {
                    let coal = res[0].buy();
                    let ore = res[1].buy();
                    let bar = res[2].sell();
                    let stamina = res[3].buy();

                    let embed = util.richEmbed()
                        .setThumbnail(barInfo.icon_large)
                        .setTitle(`Blast Furnace: ${barInfo.name}`)
                        .setURL(wikiFormat(barInfo.name))
                        .addField("Coal", coal.toLocaleString(), true)
                        .addField("Ore Price", ore.toLocaleString(), true)
                        .addField("Bar Price", bar.toLocaleString(), true)
                        .addField("Ores/trip", BF.ORES_TRIP(name), true)
                        .addField("Bars/hour", BF.BARS_HOUR(name).toLocaleString(), true)
                        .addField("GP/hour", BF.GP_HOUR(name, ore, bar, coal, stamina).toLocaleString(), true)
                        .addField("XP/hour", BF.XP_HOUR(name).toLocaleString(), true);

                    callback({embed});
                })
                .catch(err => {
                    callback(`Error getting the info. Try again later. Error: ${err}`);
                });
        }
    );
}

// Get herb run info and returns a callback with a table as a string.
// Gets info from the osrs API.
function getHerbInfo(callback) {
    Async.map(
        util.objectValues(HERBS.ITEMS),
        function(id, cb) {
            osrs.price(id)
                .then(item => {
                    cb(null, item);
                })
                .catch(err => {
                    cb(err);
                });
        },
        function(err, res) {
            if (err) {
                return callback(`Error getting the info. Try again later. Error: ${err}`);
            }
            let herbs = {
                Ranarr: {
                    herb: res[0].sell(),
                    seed: res[1].buy()
                },
                Toadflax: {
                    herb: res[2].sell(),
                    seed: res[3].buy()
                },
                Avantoe: {
                    herb: res[4].sell(),
                    seed: res[5].buy()
                },
                Kwuarm: {
                    herb: res[6].sell(),
                    seed: res[7].buy()
                },
                Snapdragon: {
                    herb: res[8].sell(),
                    seed: res[9].buy()
                },
                Torstol: {
                    herb: res[10].sell(),
                    seed: res[11].buy()
                }
            };
            let ultra = res[12].buy();
            let table = new Table()
                .setHeading("Type", "Seed Price", "Herb Price", "Profit/seed", "Profit/run");

            for (let i in herbs) {
                table.addRow(HERBS.TABLE_ROW(i, herbs[i].seed, herbs[i].herb, ultra));
            }

            table.addRow("Ultracompost", ultra.toLocaleString())
                .setAlignRight(1)
                .setAlignRight(2)
                .setAlignRight(3)
                .setAlignRight(4);

            let result = util.dedent`**__Herbs GP & XP Info__**\`\`\`
            ${table.toString()}\`\`\``;

            callback(result);
        }
    );
}

// Returns the osrs wiki link for the given item name. Assumes the item exists.
function wikiFormat(name) {
    return `https://oldschool.runescape.wiki/w/${name
        .replace(/\s/g, "_")
        .replace(/'/g, "%27")}`;
}

// Gets an item's price from the osrs API by name and returns a promise.
function itemPrice(name) {
    return new Promise(resolve => {
        if (typeof name === "string") {
            let item = nameFormat(name);

            if (aliases.has(item)) {
                resolve(osrs.price(aliases.get(item)));
            } else {
                resolve(osrs.price(item));
            }
        } else {
            resolve(osrs.price(name));
        }
    });
}

// Gets an item's info from the osrs API by name and returns a promise.
function itemInfo(name) {
    return new Promise(resolve => {
        if (typeof name === "string") {
            let item = nameFormat(name);

            if (aliases.has(item)) {
                resolve(osrs.info(aliases.get(item)));
            } else {
                resolve(osrs.info(item));
            }
        } else {
            resolve(osrs.info(name));
        }
    });
}

// Helper function to format item names for querying the osrs API.
function nameFormat(name) {
    return name.toLowerCase().replace(/\W/g, "");
}

let commands = {
    blastfurnace: {
        names: ["blastfurnace", "bf"],
        allowPrivate: true,
        perms: [],
        channelCd: 120,
        desc: "Displays current XP and profit numbers for the Blast Furnace.",
        code(msg, args, argsStr) {
            if (!args.length) {
                getBFInfo(res => {
                    msg.channel.send(res);
                });
                return true;
            }

            getBFInfoType(argsStr.toLowerCase(), res => {
                msg.channel.send(res);
            });
            return true;
        }
    },
    herbs: {
        names: ["herbs", "herb", "herbrun"],
        allowPrivate: true,
        perms: [],
        channelCd: 120,
        desc: "Displays current XP and profit numbers for planting herbs.",
        code(msg) {
            getHerbInfo(res => {
                msg.channel.send(res);
            });
            return true;
        }
    },
    examine: {
        names: ["examine"],
        allowPrivate: true,
        perms: [],
        desc: "Displays the examine info for an item.",
        code(msg, args, argsStr) {
            itemInfo(argsStr)
                .then(item => {
                    let embed = util.richEmbed()
                        .setThumbnail(item.icon_large)
                        .setTitle(item.name)
                        .setDescription(item.description)
                        .setFooter(`ID: ${item.id}`)
                        .setURL(wikiFormat(item.name));

                    msg.channel.send({embed});
                })
                .catch(err => {
                    msg.reply(err);
                });
        }
    },
    price: {
        names: ["price"],
        allowPrivate: true,
        perms: [],
        desc: "Displays the GE and OSBuddy prices of an item.",
        code(msg, args, argsStr) {
            let qty;
            let query;
            try {
                qty = math.eval(args[0]);
                query = args.slice(1).join("");
            } catch (e) {
                qty = 1;
                query = argsStr;
            }

            itemPrice(query)
                .then(item => {
                    itemInfo(item.id)
                        .then(ge => {
                            let embed = util.richEmbed()
                                .setThumbnail(ge.icon_large)
                                .setTitle(`${ge.name}${qty != 1 ? `(${qty})` : ""}`)
                                .setURL(wikiFormat(ge.name))

                                .addField("GE Price", item.ge(qty).toLocaleString(), true)
                                .addField("Overall", item.overall(qty).toLocaleString(), true)
                                .addField("Buying", item.buy(qty).toLocaleString(), true)
                                .addField("Selling", item.sell(qty).toLocaleString(), true);

                            if (qty > 1) {
                                embed.setFooter(`~${item.overall().toLocaleString()} each`);
                            }

                            msg.channel.send({embed});
                        });
                })
                .catch(err => {
                    msg.reply(err);
                });
        }
    },
    updateosrsids: {
        names: ["updateosrsids"],
        allowPrivate: true,
        perms: [util.ADMIN],
        code(msg) {
            osrs.refreshItems()
                .then(size => {
                    msg.reply(`Successfully updated the item ID list (size: ${size})`);
                })
                .catch(err => {
                    msg.reply(`There was an error in updating the items: ${err}`);
                });
        }
    },
    osrsalias: {
        names: ["osrsalias", "setosrsalias", "osrsitemalias", "setosrsitemalias"],
        allowPrivate: true,
        perms: [util.ADMIN],
        code(msg, args) {
            if (args.length < 2) {
                return;
            }
            let alias = nameFormat(args[0]);
            let item = args.slice(1).join(" ");

            if (aliases.has(alias)) {
                msg.reply("That alias already exists.");
                return;
            }

            itemInfo(item)
                .then(i => {
                    let id = i.id;
                    saveAlias(alias, id, (err) => {
                        if (err) {
                            msg.reply(`There was an error in saving the alias. Error: ${err}`);
                            return;
                        }

                        aliases.set(alias, id);
                        msg.reply(`Successfully saved a new alias: ${alias}`);
                    });
                })
                .catch(err => {
                    msg.reply(err);
                });
        }
    }
};

function help() {
    return util.dedent`__OSRS Plugin__
        This plugin has commands related to OSRS.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "osrs",
    help,
    load,
    unload,
    commands
};
