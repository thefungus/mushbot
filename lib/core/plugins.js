"use strict";
let fs = require("fs");
let path = require("path");
let async = require("async");

let loadedPlugins = new Map();

function load(mb, pluginName, cb) {
    async.waterfall([
        (cb) => {
            unload(mb, pluginName, cb);
        },
        (cb) => {
            let plugin = require(`../plugins/${pluginName}`);
            plugin.load(mb, (err) => {
                if (err) {
                    return cb(err);
                }
                loadedPlugins.set(pluginName, plugin);
                cb(null, plugin);
            });
        }
    ], cb);
}

function loadAll(mb, cb) {
    let plugins = fs.readdirSync(path.resolve(__dirname, "../plugins"));
    async.each(plugins, (pluginName, cb) => {
        load(mb, pluginName, cb);
    }, (err) => {
        return cb(err, loadedPlugins);
    });
}

function unload(mb, name, cb) {
    if (!loadedPlugins.has(name)) {
        return setTimeout(cb, 4);
    }
    loadedPlugins.get(name).unload(mb, (err) => {
        if (err) {
            throw err;
        }
        delete require.cache[require.resolve(`../plugins/${name}`)];
        loadedPlugins.delete(name);
        setTimeout(cb, 4);
    });
}

function unloadAll(mb, cb) {
    async.forEachOf(loadedPlugins, (value, pluginName, cb) => {
        unload(mb, pluginName, cb);
    }, cb);
}

function getLoadedPlugins() {
    return loadedPlugins;
}

module.exports = {
    load,
    loadAll,
    unload,
    unloadAll,
    getLoadedPlugins
};
