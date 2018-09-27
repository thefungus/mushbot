"use strict";
let mongojs = require("mongojs");
let util = require("../util.js");

const DB_NAME = "mushbot";

let db;

function init(cb) {
    db = mongojs(DB_NAME);
    db.on("error", (err) => {
        util.error("database", "unknown", err);
        throw err;
    });
    setTimeout(cb, 4);
}

function saveData(collection, _id, data, cb = () => {}) {
    db.collection(collection).save(
        {_id, data},
        cb
    );
}

function updateKey(collection, _id, key, value, cb = () => {}) {
    db.collection(collection).update(
        {_id},
        {"$set": {[`data.${key}`]: value}},
        cb
    );
}

function loadAll(collection, cb = () => {}) {
    db.collection(collection).find({}, cb);
}

function loadData(collection, _id, cb = () => {}) {
    db.collection(collection).findOne({_id}, cb);
}

function deleteData(collection, _id, cb = () => {}) {
    db.collection(collection).remove({_id}, cb);
}
module.exports = {
    init,
    updateKey,
    saveData,
    loadData,
    loadAll,
    deleteData
};
