"use strict";
let fs = require("fs-extra");
let async = require("async");
let request = require("request");
let imageType = require("image-type");
let mime = require("mime-types");
//let sharp = require("sharp");
let util = require("../../util.js");
let database = require(util.DATABASE);
let cmds = require(util.COMMANDS);
//let gifresize = require("./gifresize.js");

const PATH = {
    SERVER(id) {
        return `${__dirname}/img/server/${id}`;
    },
    USER(id) {
        return `${__dirname}/img/user/${id}`;
    }
};

let sources;
let emotes = {
    server: null,
    user: null
};
let settings = {
    server: null,
    user: null
};

function load(mb, cb) {
    async.series([
        createDirectories,
        loadSources,
        loadSettings
    ], (err) => {
        if (err) {
            return cb(err);
        }
        mb.on("message", chatHandler);
        cb();
    });
}

function unload(mb, cb) {
    mb.removeListener("message", chatHandler);
    unloadSources(cb);
}

function createDirectories(cb) {
    async.each(["img", "cache", "sources"], (name, cb) => {
        fs.ensureDir(`${__dirname}/${name}`, cb);
    }, cb);
}

function loadSources(cb) {
    sources = new Map();
    fs.readdir(`${__dirname}/sources`, (err, files) => {
        if (err) {
            return cb(err);
        }
        async.each(files, loadSource, cb);
    });
}

function loadSource(name, cb) {
    let source = require(`./sources/${name}`);
    source.init((err) => {
        if (err) {
            util.error("emotes", `init source: ${name}`, err);
            return cb();
        }
        sources.set(source.name, source);
        cb();
    });
}

function unloadSources(cb) {
    for (let i of sources.values()) {
        i.unload();
    }
    sources.clear();
    fs.readdir(`${__dirname}/sources`, (err, files) => {
        if (err) {
            return cb(err);
        }
        for (let file of files) {
            delete require.cache[require.resolve(`./sources/${file}`)];
        }
        cb();
    });
}

function loadSettings(cb) {
    async.parallel([
        loadServers,
        loadUsers
    ], cb);
}

function loadServers(cb) {
    settings.server = new Map();
    emotes.server = new Map();
    database.loadAll("emotes-servers", (err, docs) => {
        if (err) {
            return cb(err);
        }
        for (let doc of docs) {
            settings.server.set(
                doc._id,
                new Server(doc.data)
            );
            let em = new Map();
            for (let emote of doc.data.emotes) {
                em.set(doc.data.prefix + emote.name, `${emote.id}.${emote.ext}`);
            }
            emotes.server.set(doc._id, em);
        }
        cb();
    });
}

function loadUsers(cb) {
    settings.user = new Map();
    emotes.user = new Map();
    database.loadAll("emotes-users", (err, docs) => {
        if (err) {
            return cb(err);
        }
        for (let doc of docs) {
            settings.user.set(
                doc._id,
                new Server(doc.data)
            );
            let em = new Map();
            for (let emote of doc.data.emotes) {
                em.set(doc.data.prefix + emote.name, `${emote.id}.${emote.ext}`);
            }
            emotes.user.set(doc._id, em);
        }
        cb();
    });
}

function chatHandler(msg) {
    if (msg.author.equals(msg.client.user)) {
        return;
    }
    let str = msg.content.split(/\s+/);
    if (!str || !str.length) {
        return;
    }
    if (msg.content.charAt(0) === cmds.getCommandChar(msg.guild ? msg.guild.id : null)) {
        return;
    }
    let sett;
    if (msg.channel.type === "dm") {
        sett = new Server();
    } else {
        if (!settings.server.has(msg.guild.id)) {
            return;
        }
        sett = settings.server.get(msg.guild.id);
    }
    if (!(serverHandler(msg, str, sett) || userHandler(msg, str, sett))) {
        for (let source of sources.values()) {
            if (source.chatHandler(msg, str, sett)) {
                return;
            }
        }
    }
}

function serverHandler(msg, str, sett) {
    if (msg.channel.type === "dm" || !sett.server) {
        return;
    }
    let em = emotes.server.get(msg.guild.id);
    if (!em) {
        return;
    }
    for (let i of str) {
        if (!em.has(i)) {
            continue;
        }
        let emote = em.get(i);
        msg.channel.send({
            files: [{
                attachment: `${PATH.SERVER(msg.guild.id)}/${emote}`,
                name: `${i}.${emote.split(".").pop()}`
            }]
        });
        return 1;
    }
}

function userHandler(msg, str, sett) {
    if (msg.channel.type !== "text" && !sett.user) {
        return;
    }
    if (!sett.user) {
        return;
    }

    for (let i of str) {
        for (let [id, user] of emotes.user) {
            if (sett.disabledUser.indexOf(id) > -1 || !user.has(i)) {
                continue;
            }
            let emote = user.get(i);
            msg.channel.send({
                files: [{
                    attachment: `${PATH.USER(id)}/${emote}`,
                    name: `${i}.${emote.split(".").pop()}`
                }]
            });
            return 1;
        }
    }
}

function addEmote(type, id, name, url, callback, secondTry) {
    let sett = settings[type].get(id);
    let code = name;
    if (code.indexOf(sett.prefix) === 0) {
        code = code.slice(sett.prefix.length);
    }
    let emote = sett.prefix + code;
    let formats = ["gif", "png", "jpeg", "jpg", "webp", "mp4", "webm", "mov"];
    let link = url;
    if (link.slice(-5) === ".gifv") {
        link = link.slice(0, -1);
    }
    let info = {name: code};
    async.waterfall([
        (cb) => {
            fs.ensureDir(`${__dirname}/img/${type}/${id}`, (err) => {
                cb(err);
            });
        },
        (cb) => {
            request.head(link, (err, res) => {
                if (err) {
                    return cb("errlink");
                }
                if (res.headers) {
                    if (res.headers["content-length"] > 50000000) {
                        return cb("errsize");
                    }
                    if (!res.headers["content-type"]) {
                        return cb();
                    }
                    if (formats.indexOf(mime.extension(res.headers["content-type"])) === -1 && res.headers["content-type"] != "video/quicktime") {
                        return cb("errtype");
                    }
                }
                return cb(null, res.headers["content-type"] == "video/quicktime");
            });
        },
        (isQuicktime, cb) => {
            request({uri: link, encoding: null}, (err, res) => {
                if (err) {
                    return cb("errlink");
                }
                if (res.bytes > 50000000) {
                    return cb("errsize");
                }
                let imgType = imageType(res.body);
                if (!imgType && !isQuicktime) {
                    return cb("errtype");
                }
                if (imgType && formats.indexOf(imgType.ext) === -1) {
                    return cb("errtype");
                }
                info.id = sett.emoteID;
                info.ext = imgType ? imgType.ext : "mov";
                let path = `${__dirname}/img/${type}/${id}/${info.id}.${info.ext}`;
                return cb(null, res.body, path);
            });
        },
        (buffer, path, cb) => {
            if (secondTry) {
                fs.outputFile(path, buffer, (err) => {
                    if (err) {
                        return cb("errwrite");
                    }
                    return cb();
                });
                return;
            }
            fs.outputFile(path, buffer, (err) => {
                if (err) {
                    return cb("errwrite");
                }
                cb();
            });
            /*let img = sharp(buffer);
            img.metadata((err, data) => {
                if (err) {
                    if (secondTry) {
                        return cb("errdim");
                    }
                    return resizeGif(type, id, name, link, callback);
                }
                if (data.height > 155) {
                    if (data.format === "magick") {
                        if (secondTry) {
                            return cb("errgif");
                        }
                        return resizeGif(type, id, name, link, callback);
                    }
                    img.resize(null, 155).toFile(path, (err) => {
                        if (err) {
                            console.log(err);
                            return cb("errresize");
                        }
                        return cb();
                    });
                    return;
                }
                fs.outputFile(path, buffer, (err) => {
                    if (err) {
                        return cb("errwrite");
                    }
                    cb();
                });
            });*/
        },
        (cb) => {
            sett.emotes.push(info);
            sett.emoteID++;
            emotes[type].get(id).set(emote, `${info.id}.${info.ext}`);
            let save = type === "server" ? saveServer : saveUser;
            save(id, sett, () => {
                cb("success");
            });
        }
    ], callback);
}

function checkName(type, id, name, link, cb) {
    let sett = settings[type].get(id);
    if (!sett) {
        return cb("errnoprefix");
    }
    if (!link) {
        return cb("errargs");
    }
    let code = name;
    if (code.indexOf(sett.prefix) === 0) {
        code = code.slice(sett.prefix.length);
    }
    if (!/[A-Z0-9]/.test(code)) {
        return cb("errcase");
    }
    for (let i of sett.emotes) {
        if (i.name === code) {
            return cb("errexist");
        }
    }
    let emote = sett.prefix + code;
    for (let i of sources.values()) {
        if (i.hasEmote(emote)) {
            return cb("errexist");
        }
    }
    for (let i of emotes.server.values()) {
        if (i.has(emote)) {
            return cb("errexist");
        }
    }
    for (let i of emotes.user.values()) {
        if (i.has(emote)) {
            return cb("errexist");
        }
    }
    return cb("success");
}

/*function resizeGif(type, id, name, link, cb) {
    gifresize(link, (err, newLink) => {
        if (err) {
            return cb(err);
        }
        return addEmote(type, id, name, newLink, cb, true);
    });
}*/

function delEmote(type, id, name, cb) {
    let sett = settings[type].get(id);
    if (!sett.prefix || !sett.emotes.length) {
        return cb("errnone");
    }
    let code = name;
    if (code.indexOf(sett.prefix) === 0) {
        code = code.slice(sett.prefix.length);
    }
    for (let i = 0; i < sett.emotes.length; i++) {
        let emote = sett.emotes[i];
        if (emote.name === code) {
            fs.unlink(`${__dirname}/img/${type}/${id}/${emote.id}.${emote.ext}`, (err) => {
                if (err) {
                    return cb("errdel");
                }
                sett.emotes.splice(i, 1);
                emotes[type].get(id).delete(sett.prefix + code);
                let save = type === "server" ? saveServer : saveUser;
                save(id, sett, () => {
                    return cb("success");
                });
            });
            return;
        }
    }
    return cb("errname");
}

function saveServer(id, data, cb = () => {}) {
    database.saveData("emotes-servers", id, data, cb);
}

function saveUser(id, data, cb = () => {}) {
    database.saveData("emotes-users", id, data, cb);
}

let commands = {
    emotes: {
        names: ["emotes", "emote"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "(mods) Display settings such as enabled emotes sources.",
        code(msg, args, argsStr, cmdName, char) {
            if (!settings.server.has(msg.guild.id)) {
                settings.server.set(msg.guild.id, new Server());
            }
            let sett = settings.server.get(msg.guild.id);
            let arg = (args[0] || "").toLowerCase();
            for (let i of sources.values()) {
                if (arg === i.name) {
                    return i.emotesCommand(msg, args.slice(1), sett, saveServer, char);
                }
            }
            switch (arg) {
                case "server":
                case "servers":
                case "guild":
                case "group":
                    return this.server(msg, args.slice(1), sett, char);
                case "user":
                case "users":
                case "custom":
                    return this.user(msg, args.slice(1), sett, char);
                default: {
                    let reply = util.dedent`__Current Emotes settings__
                        \`user\` emotes: \`${sett.user ? "on" : "off"}\`
                        \`server\` emotes: \`${sett.server ? "on" : "off"}\``;
                    for (let i of sources.values()) {
                        reply += i.defaultMessage(sett);
                    }
                    reply += util.dedent`
                        For help with the Emotes plugin, follow this link: ${util.HELP_LINK}`;
                    msg.reply(reply);
                }
            }
        },
        server(msg, args, serverS, char) {
            switch ((args[0] || "").toLowerCase()) {
                case "on":
                case "enable":
                    serverS.server = true;
                    saveServer(
                        msg.guild.id,
                        serverS,
                        () => {
                            msg.reply(
                                "Server emotes `enabled`!"
                            );
                        }
                    );
                    return;
                case "off":
                case "disable":
                    serverS.server = false;
                    saveServer(
                        msg.guild.id,
                        serverS,
                        () => {
                            msg.reply(
                                "Server emotes `disabled`!"
                            );
                        }
                    );
                    return;
                case "toggle":
                    serverS.server = !serverS.server;
                    saveServer(
                        msg.guild.id,
                        serverS,
                        () => {
                            msg.reply(
                                `Server emotes \`${serverS.server ? "enabled" : "disabled"}\`!`
                            );
                        }
                    );
                    return;
                default:
                    msg.reply(
                        util.dedent`To enable or disable server emotes, use the following commands:
                        \`${char}emotes server on\`
                        \`${char}emotes server off\`
                        For help with the Emotes plugin, follow this link: ${util.HELP_LINK}`
                    );
            }
        },
        user(msg, args, serverS, char) {
            switch ((args[0] || "").toLowerCase()) {
                case "on":
                case "enable":
                    serverS.user = true;
                    saveServer(
                        msg.guild.id,
                        serverS,
                        () => {
                            msg.reply(
                                "Custom user emotes `enabled`!"
                            );
                        }
                    );
                    return;
                case "off":
                case "disable":
                    serverS.user = false;
                    saveServer(
                        msg.guild.id,
                        serverS,
                        () => {
                            msg.reply(
                                "Custom user emotes `disabled`!"
                            );
                        }
                    );
                    return;
                case "toggle":
                    serverS.user = !serverS.user;
                    saveServer(
                        msg.guild.id,
                        serverS,
                        () => {
                            msg.reply(
                                `Custom user emotes \`${serverS.user ? "enabled" : "disabled"}\`!`
                            );
                        }
                    );
                    return;
                default:
                    msg.reply(
                        util.dedent`To enable or disable custom user emotes, use the following commands:
                        \`${char}emotes user on\`
                        \`${char}emotes user off\`
                        For help with the Emotes plugin, follow this link: ${util.HELP_LINK}`
                    );
            }
        }
    },
    prefix: {
        names: ["prefix", "setprefix", "addprefix", "emoteprefix", "emotesprefix"],
        allowPrivate: true,
        perms: [],
        desc: "Set your own emotes prefix, which is needed for adding custom emotes.",
        code(msg, args, argsStr, cmdName, char) {
            if (!args.length) {
                msg.reply(
                    util.dedent`To set or change your emotes prefix, use \`${char}prefix [word]\`.
                    Your prefix is the first few letters of each emote you create.
                    If you need more help, follow this link: ${util.HELP_LINK}`
                );
                return;
            }
            if (/[^a-z0-9]/.test(args[0])) {
                msg.reply(
                    "Please only use lowercase letters and numbers for your prefix."
                );
                return;
            }
            if (args[0].length < 2) {
                msg.reply(
                    "Please use at least 2 characters for your prefix."
                );
                return;
            }
            for (let user of settings.user.values()) {
                if (user.prefix === args[0]) {
                    msg.reply(
                        "That prefix is already in use. Please choose a different one."
                    );
                    return;
                }
            }
            for (let server of settings.server.values()) {
                if (server.prefix === args[0]) {
                    msg.reply(
                        "That prefix is already in use. Please choose a different one."
                    );
                    return;
                }
            }
            let sett;
            if (settings.user.has(msg.author.id)) {
                sett = settings.user.get(msg.author.id);
            } else {
                sett = new User();
                settings.user.set(msg.author.id, sett);
                emotes.user.set(msg.author.id, new Map());
            }
            let em = emotes.user.get(msg.author.id);
            let status = sett.prefix ? "Changed" : "Set";
            if (em) {
                em.clear();
                sett.prefix = args[0];
                for (let i of sett.emotes) {
                    em.set(`${args[0]}${i.name}`, `${i.id}.${i.ext}`);
                }
                emotes.user.set(msg.author.id, em);
            }
            saveUser(msg.author.id, sett, () => {
                msg.reply(
                    `${status} your prefix to \`${args[0]}\`!`
                );
            });
        }
    },
    serverprefix: {
        names: ["serverprefix", "setserverprefix"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "(mods) Set the server's emotes prefix, which is needed for adding custom server emotes.",
        code(msg, args, argsStr, cmdName, char) {
            if (!args.length) {
                msg.reply(
                    `To set or change the server emotes prefix, use \`${char}serverprefix [word]\`.
                    Your prefix is the first few letters of each emote you create.
                    If you need more help, follow this link: ${util.HELP_LINK}`
                );
                return;
            }
            if (/[^a-z0-9]/.test(args[0])) {
                msg.reply(
                    "Please only use lowercase letters and numbers for the prefix."
                );
                return;
            }
            if (args[0].length < 2) {
                msg.reply(
                    "Please use at least 2 characters for the prefix."
                );
                return;
            }
            for (let user of settings.user.values()) {
                if (user.prefix === args[0]) {
                    msg.reply(
                        "That prefix is already in use. Please choose a different one."
                    );
                    return;
                }
            }
            for (let server of settings.server.values()) {
                if (server.prefix === args[0]) {
                    msg.reply(
                        "That prefix is already in use. Please choose a different one."
                    );
                    return;
                }
            }
            let sett;
            if (settings.server.has(msg.guild.id)) {
                sett = settings.server.get(msg.guild.id);
            } else {
                sett = new Server();
                settings.server.set(msg.guild.id, sett);
                emotes.server.set(msg.guild.id, new Map());
            }
            let em = emotes.server.get(msg.guild.id);
            let status = sett.prefix ? "Changed" : "Set";
            if (em) {
                em.clear();
                sett.prefix = args[0];
                for (let i of sett.emotes) {
                    em.set(args[0] + i.name, i.id + i.ext);
                }
            }
            saveServer(msg.guild.id, sett, () => {
                msg.reply(
                    `${status} the server emotes prefix to \`${args[0]}\`!`
                );
            });
        }
    },
    addemote: {
        names: ["addemote", "newemote", "createemote", "createmote"],
        allowPrivate: true,
        perms: [],
        desc: "Add a custom emote after you've created a prefix.",
        code(msg, args, argsStr, cmdName, char) {
            async.series([
                (cb) => {
                    checkName("user", msg.author.id, args[0], args[1], (err) => {
                        switch (err) {
                            case "success":
                                return cb();
                            case "errnoprefix":
                                msg.reply(
                                    `You need to create an emotes prefix before creating an emote. Use the \`${char}prefix\` command.`
                                );
                                return;
                            case "errargs":
                                msg.reply(
                                    util.dedent`To create an emote, use \`${char}addemote [name] [link to image]\`.
                                    Make sure that the link is a direct link.
                                    If you need more help, follow this link: ${util.HELP_LINK}`
                                );
                                return;
                            case "errcase":
                                msg.reply(
                                    "Your emote name has to contain at least one uppercase letter or a number."
                                );
                                return;
                            case "errexistuser":
                                msg.reply(
                                    `You already have an emote with that name. If you want to overwrite it, delete it first with \`${char}delemote [name]\`.`
                                );
                                return;
                            case "errexist":
                                msg.reply(
                                    "An emote already exists with that name. Please pick a different one."
                                );
                                return;
                            default:
                                msg.reply(
                                    "An unknown error occurred. (Please contact fungus#9999!)"
                                );
                        }
                    });
                },
                () => {
                    addEmote("user", msg.author.id, args[0], args[1], (err) => {
                        switch (err) {
                            case "success":
                                msg.reply(
                                    `Emote successfully added: \`${args[0]}\`!`
                                );
                                return;
                            case "errdir":
                                msg.reply(
                                    "There was an error with creating a directory. (Please contact fungus#9999!)"
                                );
                                return;
                            case "errlink":
                                msg.reply(
                                    "The link you gave me didn't work. Maybe try a different one?"
                                );
                                return;
                            case "errsize":
                                msg.reply(
                                    "Please keep the image sizes under 8MB, otherwise Discord won't be able to display them."
                                );
                                return;
                            case "errtype":
                                msg.reply(
                                    "That image format is unsupported. Please try again with a png, jpg, gif or webp image."
                                );
                                return;
                            case "errwrite":
                                msg.reply(
                                    "There was an error with saving the image file. (Please contact fungus#9999!)"
                                );
                                return;
                            case "errdim":
                                msg.reply(
                                    "There was an error with getting the dimensions of the image file. (Please contact fungus#9999!)"
                                );
                                return;
                            case "errresize":
                                msg.reply(
                                    "There was an error with resizing the image. Try resizing it yourself at http://ezgif.com"
                                );
                                return;
                            case "errgif":
                                msg.reply(
                                    "I'm having trouble resizing that gif. Maybe you could try yourself with http://ezgif.com ?"
                                );
                                return;
                            case "errsite":
                                msg.reply(
                                    "There was an error with the gif resizing website. Please try again later or resize it yourself at http://ezgif.com"
                                );
                                return;
                            default:
                                msg.reply(
                                    "An unknown error occurred. (Please contact fungus#9999!)"
                                );
                        }
                    });
                }
            ]);
        }
    },
    addserveremote: {
        names: ["addserveremote", "addgroupemote", "addguildemote"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "(mods) Add a custom server emote after a prefix is created.",
        code(msg, args, argsStr, cmdName, char) {
            async.series([
                (cb) => {
                    checkName("server", msg.guild.id, args[0], args[1], (err) => {
                        switch (err) {
                            case "success":
                                return cb();
                            case "errnoprefix":
                                msg.reply(
                                    `You need to create an emotes prefix for the server before creating an emote. Use the \`${char}serverprefix\` command.`
                                );
                                return;
                            case "errargs":
                                msg.reply(
                                    util.dedent`To create a server emote, use \`${char}addserveremote [name] [link to image]\`.
                                    Make sure that the link is a direct link.
                                    If you need more help, follow this link: ${util.HELP_LINK}`
                                );
                                return;
                            case "errcase":
                                msg.reply(
                                    "Your emote name has to contain at least one uppercase letter or a number."
                                );
                                return;
                            case "errexist":
                                msg.reply(
                                    "An emote already exists with that name. Please pick a different name."
                                );
                                return;
                            default:
                                msg.reply(
                                    "An unknown error occurred. (Please contact fungus#9999!)"
                                );
                        }
                    });
                },
                () => {
                    addEmote("server", msg.guild.id, args[0], args[1], (err) => {
                        switch (err) {
                            case "success":
                                msg.reply(
                                    `Server emote successfully added: \`${args[0]}\`!`
                                );
                                return;
                            case "errdir":
                                msg.reply(
                                    "There was an error with creating a directory. (Please contact fungus#9999!)"
                                );
                                return;
                            case "errlink":
                                msg.reply(
                                    "The link you gave me didn't work. Maybe try a different one?"
                                );
                                return;
                            case "errsize":
                                msg.reply(
                                    "Please keep the image sizes under 8MB, otherwise Discord won't be able to display them."
                                );
                                return;
                            case "errtype":
                                msg.reply(
                                    "That image format is unsupported. Please try again with a png, jpg, gif or webp image."
                                );
                                return;
                            case "errwrite":
                                msg.reply(
                                    "There was an error with saving the image file. (Please contact fungus#9999!)"
                                );
                                return;
                            case "errdim":
                                msg.reply(
                                    "There was an error with getting the dimensions of the image file. (Please contact fungus#9999!)"
                                );
                                return;
                            case "errresize":
                                msg.reply(
                                    "There was an error with resizing the image. Try resizing it yourself at http://ezgif.com"
                                );
                                return;
                            case "errgif":
                                msg.reply(
                                    "I'm having trouble resizing that gif. Maybe you could try yourself with http://ezgif.com ?"
                                );
                                return;
                            case "errsite":
                                msg.reply(
                                    "There was an error with the gif resizing website. Please try again later or resize it yourself at http://ezgif.com"
                                );
                                return;
                            default:
                                msg.reply(
                                    "An unknown error occurred. (Please contact fungus#9999!)"
                                );
                        }
                    });
                }
            ]);
        }
    },
    delemote: {
        names: ["delemote", "deleteemote", "deletemote"],
        allowPrivate: true,
        perms: [],
        desc: "Delete a custom emote you've added.",
        code(msg, args, argsStr, cmdName, char) {
            if (!args.length) {
                msg.reply(
                    `To delete one of your emotes, use \`${char}delemote [name]\`.`
                );
                return;
            }
            delEmote("user", msg.author.id, args[0], (err) => {
                switch (err) {
                    case "success":
                        msg.reply(
                            "Emote successfully deleted!"
                        );
                        return;
                    case "errnone":
                        msg.reply(
                            `You don't have any emotes! Use the \`${char}prefix\` and \`${char}addemote\` commands to create an emote.`
                        );
                        return;
                    case "errdel":
                        msg.reply(
                            "There was an error with deleting the emote image. (Please contact fungus#9999!)"
                        );
                        return;
                    case "errname":
                        msg.reply(
                            "You don't seem to have an emote with that name. Maybe you misspelled it?"
                        );
                        return;
                    default:
                        msg.reply(
                            "An unknown error occurred. (Please contact fungus#9999!)"
                        );
                        return;
                }
            });
        }
    },
    delserveremote: {
        names: ["delserveremote", "deleteserveremote"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "(mods) Delete a custom server emote that was added to the server.",
        code(msg, args, argsStr, cmdName, char) {
            if (!args.length) {
                msg.reply(
                    `To delete one of the server emotes, use \`${char}delserveremote [name]\`.`
                );
                return;
            }
            delEmote("server", msg.guild.id, args[0], (err) => {
                switch (err) {
                    case "success":
                        msg.reply(
                            "Server emote successfully deleted!"
                        );
                        return;
                    case "errnone":
                        msg.reply(
                            `The server doesn't have any emotes! Use the \`${char}serverprefix\` and \`${char}addserveremote\` commands to create an emote.`
                        );
                        return;
                    case "errdel":
                        msg.reply(
                            "There was an error with deleting the emote image. (Please contact fungus#9999!)"
                        );
                        return;
                    case "errname":
                        msg.reply(
                            "The server doesn't seem to have an emote with that name. Maybe you misspelled it?"
                        );
                        return;
                    default:
                        msg.reply(
                            "An unknown error occurred. (Please contact fungus#9999!)"
                        );
                        return;
                }
            });
        }
    },
    disableemote: {
        names: ["disableemote", "disablemote", "emotedisable", "disableemotes", "disablemotes"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "(mods) Disable a specific emote from a source, or disable all of a user's emotes.",
        code(msg, args, argsStr, cmdName, char) {
            if (!args.length) {
                msg.reply(
                    util.dedent`To disable a certain emote in this server, use \`${char}disableemote [type] [name]\`.
                    You can also disable all of a certain user's emotes with their username, their prefix, or one of their emotes' name.`
                );
                return;
            }
            let sett;
            if (settings.server.has(msg.guild.id)) {
                sett = settings.server.get(msg.guild.id);
            } else {
                sett = new Server();
                settings.server.set(msg.guild.id, sett);
            }
            let arg = (args[0] || "").toLowerCase();
            for (let i of sources.values()) {
                if (arg === i.name) {
                    return i.disableCommand(msg, args.slice(1), sett, saveServer, char);
                }
            }
            switch (arg) {
                case "user":
                case "users":
                case "custom":
                    return this.user(msg, args.slice(1), sett, char);
                default: {
                    let types = [];
                    for (let i of sources.values()) {
                        types.push(`\`${i.name}\``);
                    }
                    msg.reply(
                        util.dedent`Available types of emotes: ${types.join(", ")}, \`user\`
                        Use \`${char}disableemote [type] [name] to disable a certain emote or user's emotes in this server.`
                    );
                }
            }
        },
        user(msg, args, sett, char) {
            let user = util.getUser(args[0]);
            if (user) {
                sett.disabledUser.push(user);
                let name = msg.client.users.find("id", user).username;
                saveServer(msg.guild.id, sett, () => {
                    msg.reply(
                        util.dedent`Successfully disabled all of that user's emotes!
                        To re-enable their emotes, you can use \`${char}enableemotes ${name}\`.`
                    );
                });
                return;
            }
            for (let i of emotes.user) {
                let settU = settings.user.get(i[0]);
                if (settU.prefix === args[0] || i[1].has(args[0])) {
                    sett.disabledUser.push(i[0]);
                    let name = msg.client.users.find("id", i[0]).username;
                    saveServer(msg.guild.id, sett, () => {
                        msg.reply(
                            util.dedent`Successfully disabled all of that user's emotes!
                            To re-enable their emotes, you can use \`${char}enableemotes ${name}\`.`
                        );
                    });
                    return;
                }
            }
            msg.reply(
                util.dedent`I could not find an emote with that name nor a user with that prefix or name.
                If you need help with the command, use \`${char}disableemote user\`.`
            );
        }
    },
    enableemote: {
        names: ["enableemote", "enablemote", "emoteenable", "enableemotes", "enablemotes"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "(mods) Re-enable a disabled emote or user.",
        code(msg, args, argsStr, cmdName, char) {
            if (!args.length) {
                msg.reply(
                    util.dedent`To re-enable a certain emote in this server, use \`${char}enableemote [type] [name]\`.
                    You can also re-enable a certain user's emotes with their username, their prefix, or one of their emotes' name.`
                );
                return;
            }
            if (!settings.server.has(msg.guild.id)) {
                msg.reply(
                    "This server does not have any disabled emotes."
                );
                return;
            }
            let sett = settings.server.get(msg.guild.id);
            let arg = (args[0] || "").toLowerCase();
            for (let i of sources.values()) {
                if (arg === i.name) {
                    return i.enableCommand(msg, args.slice(1), sett, saveServer, char);
                }
            }
            switch (arg) {
                case "user":
                case "users":
                case "custom":
                    return this.user(msg, args.slice(1), sett, char);
                default: {
                    let types = [];
                    for (let i of sources.values()) {
                        types.push(`\`${i.name}\``);
                    }
                    msg.reply(
                        util.dedent`Available types of emotes: ${types.join(", ")}, \`user\`
                        Use \`${char}enableemote [type] [name] to re-enable a certain emote or user's emotes in this server.`
                    );
                }
            }
        },
        user(msg, args, sett, char) {
            let user = util.getUser(args[0]);
            if (sett.disabledUser.indexOf(user) > -1) {
                sett.disabledUser.splice(sett.disabledUser.indexOf(user), 1);
                let name = msg.client.users.find("id", user).username;
                saveServer(msg.guild.id, sett, () => {
                    msg.reply(
                        `Successfully re-enabled ${name}'s emotes!`
                    );
                });
                return;
            }
            for (let i of sett.disabledUser) {
                if (!settings.user.has(i)) {
                    continue;
                }
                if (emotes.user.get(i).has(args[0]) || settings.user.get(i).prefix === args[0]) {
                    sett.disabledUser.splice(sett.disabledUser.indexOf(i), 1);
                    let name = msg.client.users.find("id", i);
                    saveServer(msg.guild.id, sett, () => {
                        msg.reply(
                            `Successfully re-enabled ${name}'s emotes!`
                        );
                    });
                    return;
                }
            }
            msg.reply(
                util.dedent`I could not find an emote with that name nor a user with that prefix or name.
                If you need help with the command, use \`${char}enableemote\`.`
            );
        }
    },
    listemotes: {
        names: ["listemotes", "listemote", "emotelist", "emoteslist"],
        allowPrivate: true,
        perms: [],
        desc: "List your emotes or someone else's emotes.",
        code(msg, args, argsStr) {
            let user;
            if (args.length) {
                user = util.getUser(args[0]);
                if (!user) {
                    let name = argsStr;
                    if (name.indexOf("@") === 0) {
                        name = name.slice(1);
                    }
                    user = util.getUserByName(msg.client, msg.author.id, name);
                    if (!user) {
                        let prefix = args[0];
                        for (let em of settings.user) {
                            if (em[1].prefix === prefix) {
                                user = em[0];
                                break;
                            }
                        }
                        if (!user) {
                            msg.reply(
                                "I couldn't find that user or that prefix. Make sure you @mentioned them or typed it correctly."
                            );
                            return;
                        }
                    }
                }
            } else {
                user = msg.author.id;
            }
            let isSelf = user === msg.author.id;
            if (!emotes.user.has(user)) {
                msg.reply(
                    `${isSelf ? "You do" : "That user does"}n't have any emotes yet.`
                );
                return;
            }
            let em = emotes.user.get(user);
            if (!em.size) {
                msg.reply(
                    `${isSelf ? "You do" : "That user does"}n't have any emotes yet.`
                );
                return;
            }
            let replies = [];
            replies.push(`${isSelf ? "Your" : `<@${user}>'s`} emotes (${em.size}):\n`);
            for (let i of em.keys()) {
                replies.push(`\n${i}`);
            }
            replies = util.convertLongMessage(replies);
            for (let i of replies) {
                msg.author.send(i);
            }
        }
    },
    listserveremotes: {
        names: ["listserveremotes", "serveremotes", "serveremote", "listemotesserver", "listemoteserver"],
        allowPrivate: false,
        perms: [],
        desc: "List the current server's emotes.",
        code(msg) {
            if (!emotes.server.has(msg.guild.id)) {
                msg.reply(
                    "This server doesn't have any emotes yet."
                );
                return;
            }
            let em = emotes.server.get(msg.guild.id);
            if (!em.size) {
                msg.reply(
                    "This server doesn't have any emotes yet."
                );
                return;
            }
            let replies = [];
            replies.push(`${msg.guild.name} emotes:\n`);
            for (let i of em.keys()) {
                replies.push(`\n${i}`);
            }
            replies = util.convertLongMessage(replies);
            for (let i of replies) {
                msg.author.send(i);
            }
        }
    },
    addchannel: {
        names: ["addchannel", "addchan", "addch"],
        allowPrivate: false,
        perms: util.MOD,
        desc: "Add a certain channel's emotes (BTTV and FFZ).",
        code(msg, args, argsStr, cmdName, char) {
            if (!args.length) {
                msg.reply(
                    util.dedent`To add BTTV or FFZ emotes from a specific channel, use \`${char}addchannel [bttv/ffz] [channel]\`.
                    The channel name is the part in the address here: twitch.tv/[channel].`
                );
                return;
            }
            let sett;
            if (settings.server.has(msg.guild.id)) {
                sett = settings.server.get(msg.guild.id);
            } else {
                sett = new Server();
                settings.server.set(msg.guild.id, sett);
            }
            let arg = (args[0] || "").toLowerCase();
            let types = [];
            for (let i of sources.values()) {
                if (typeof i.addChannelCommand !== "undefined") {
                    types.push(i.name);
                    if (arg === i.name) {
                        return i.addChannelCommand(msg, args.slice(1), sett, saveServer, char);
                    }
                }
            }
            msg.reply(
                util.dedent`The available types of channel emotes are as follows: \`${types.join("`, `")}\`
                Use \`${char}addchannel [type] [channel]\` to add a certain channel's emotes.`
            );
        }
    }
};

function Server(prev = {}) {
    for (let i of sources.values()) {
        for (let j in i.addedSettings) {
            this[j] = prev[j] || i.addedSettings[j];
        }
    }
    this.user = prev.user || false;
    this.server = prev.server || false;
    this.prefix = prev.prefix || null;
    this.emotes = prev.emotes || [];
    this.emoteID = prev.emoteID || 0;
    this.disabledUser = prev.disabledUser || [];
}

function User(prev = {}) {
    this.prefix = prev.prefix || null;
    this.emotes = prev.emotes || [];
    this.emoteID = prev.emoteID || 0;
}

function help() {
    return util.dedent`__Emotes plugin__
        This plugin allows mushbot to post images and emotes from various sources in the chat. Notably, it allows users and server mods to create their own emotes out of linked images and gifs.
        Currently, the available emote sources are Twitch.tv, FrankerFaceZ and BetterTTV.

        Commands:
        ${util.generateCommandsInfo(commands)}`;
}

module.exports = {
    name: "emotes",
    help,
    load,
    unload,
    commands
};
