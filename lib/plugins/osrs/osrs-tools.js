"use strict";
const osrs = require("osrs-api").grandExchange;
const request = require("request");

const OSBUDDY_API = "https://rsbuddy.com/exchange/summary.json";

let lastCheck = 0;

let items = new Map();
let itemIDs = new Map();

async function price(param) {
    if (checkTime()) {
        await refreshItems().catch(e => console.log(e));
    }

    return new Promise((resolve, reject) => {
        let item = typeof param === "number" ? itemIDs.get(param) : items.get(nameFormat(param));
        if (!item) {
            reject("Item not found.");
        } else {
            osrs.getGraph(item.id)
                .then(res => {
                    let prices = Object.keys(res.daily);
                    item.ge = (qty) => {
                        return res.daily[prices[prices.length-1]]*qty;
                    };
                    resolve(item);
                })
                .catch(err => {
                    console.log(err);
                    resolve(item);
                });
        }
    });
}

async function info(param) {
    if (checkTime()) {
        await refreshItems().catch(e => console.log(e));
    }

    return new Promise((resolve, reject) => {
        let item = typeof param === "number" ? itemIDs.get(param) : items.get(nameFormat(param));
        if (!item) {
            reject("Item not found.");
        } else {
            osrs.getItem(item.id)
                .then(res => {
                    resolve(res.item);
                })
                .catch(err => {
                    console.log(err);
                    reject("Error fetching from the OSRS API.");
                });
        }
    });
}

/*function id(name) {
    return new Promise((resolve, reject) => {
        if (checkTime()) {
            await refreshItems().catch(e => console.log);
        }

        let item = items.get(nameFormat(name));
        if (!item) {
            reject("Item not found.");
        } else {
            resolve(item.id);
        }
    });
}*/

function checkTime(mins=15) {
    return Date.now() - lastCheck > 1000*60*mins;
}

function refreshItems() {
    return new Promise((resolve, reject) => {
        fetchItems()
            .then(info => {
                handleItems(info);
                lastCheck = Date.now();
                resolve(items.size);
            })
            .catch(err => reject(err));
    });
}

function fetchItems() {
    return new Promise((resolve, reject) => {
        request({
            uri: OSBUDDY_API,
            json: true
        }, (err, res, info) => {
            if (err) {
                reject(err);
            } else {
                resolve(info);
            }
        });
    });
}

function handleItems(info) {
    items.clear();
    for (let i in info) {
        let item = info[i];
        items.set(
            nameFormat(item.name),
            {
                id: item.id,
                name: item.name,
                buy(qty=1) {
                    return item.buy_average*qty;
                },
                sell(qty=1) {
                    return item.sell_average*qty;
                },
                overall(qty=1) {
                    return item.overall_average*qty;
                }
            }
        );

        itemIDs.set(
            item.id,
            {
                id: item.id,
                name: item.name,
                buy(qty=1) {
                    return item.buy_average*qty;
                },
                sell(qty=1) {
                    return item.sell_average*qty;
                },
                overall(qty=1) {
                    return item.overall_average*qty;
                }
            }
        );
    }
}

function nameFormat(name) {
    return name.toLowerCase().replace(/\W/g, "");
}

module.exports = {
    price,
    info,
    //id,
    refreshItems
};
