"use strict";
let async = require("async");
let util = require("../util.js");
let database = require(util.DATABASE);
let plugins = require(util.PLUGINS);

let commands = {
    plugin: new Map(),
    server: new Map(),
    channel: new Map(),
    info: new Set()
};
let settings = {
    server: new Map(),
    channel: new Map()
};

class Command {
    constructor(info) {
        for (let i in info) {
            if (info.hasOwnProperty(i)) {
                this[i] = info[i];
            }
        }
        this.usersOnCd = new Set();
        this.channelsOnCd = new Set();
    }
    execute(msg, args, argsStr, cmdName, char) {
        let activateCooldown = this.code(msg, args, argsStr, cmdName, char);
        if (activateCooldown) {
            this.activateCd(msg);
        }
    }
    activateCd(msg) {
        if (this.userCd) {
            this.usersOnCd.add(msg.author.id);
            setTimeout(() => {
                this.usersOnCd.delete(msg.author.id);
            }, this.userCd * 1000);
        }
        if (this.channelCd) {
            this.channelsOnCd.add(msg.channel.id);
            setTimeout(() => {
                this.channelsOnCd.delete(msg.channel.id);
            }, this.channelCd * 1000);
        }
    }
    canExecute(msg) {
        return !this.onCooldown(msg.author, msg.channel) &&
            this.hasPermission(msg.author, msg.channel, msg.member);
    }
    onCooldown(author, channel) {
        return this.usersOnCd.has(author.id) ||
            this.channelsOnCd.has(channel.id);
    }
    hasPermission(author, channel, member) {
        if (channel.type === "dm") {
            return this.allowPrivate;
        }
        if (!this.perms || !this.perms.length) {
            return true;
        }
        if (this.perms.indexOf(util.ADMIN) > -1) {
            return false;
        }
        if (author.id === channel.guild.ownerID) {
            return true;
        }
        for (let perm of this.perms) {
            for (let role of member.roles.values()) {
                if (role.hasPermission(perm)) {
                    return true;
                }
            }
        }
        return false;
    }
}

let CommandsPlugin = {
    name: "addcmd",
    commands: {
        addcmd: {
            names: ["addcmd", "newcmd", "addcommand", "newcommand", "createcmd", "createcommand"],
            allowPrivate: false,
            perms: util.MOD,
            code(msg, args, argsStr, cmdName, char) {
                if (args.length < 2) {
                    msg.reply(
                        util.dedent`To create a command, use \`${char}addcmd [name] [message]\`.
                        Make sure the command doesn't exist already! You can delete created commands
                        with \`${char}delcmd [name]\` or update an existing one with \`${char}editcmd [name] [message]\`.`
                    );
                    return;
                }
                let name = args[0].toLowerCase();
                if (name.charAt(0) === char) {
                    name = name.slice(1);
                }
                newCommand(msg.guild.id, name, args.slice(1).join(" "), (err) => {
                    switch (err) {
                        case "errexist":
                            msg.reply(
                                "A command already exists with that name. Please pick a different name."
                            );
                            return;
                        default:
                            msg.reply(
                                `Successfully added a new command: \`${char}${name}\`!`
                            );
                    }
                });
            }
        },
        delcmd: {
            names: ["delcmd", "deletecmd", "delcommand", "deletecommand", "removecommand", "removecmd"],
            allowPrivate: false,
            perms: util.MOD,
            code(msg, args, argsStr, cmdName, char) {
                if (args.length !== 1) {
                    msg.reply(
                        `To delete a command you've created, use \`${char}delcmd [name]\`. Alternatively, to edit a command's response, use \`${char}editcmd [name] [new response]\`.`
                    );
                    return;
                }
                let name = args[0].toLowerCase();
                if (name.charAt(0) === char) {
                    name = name.slice(1);
                }
                deleteCommand(msg.guild.id, name, (err) => {
                    switch (err) {
                        case "errnone":
                            msg.reply(
                                `It doesn't look like this server added a command with that name. Make sure it's spelled correctly. For a list of added commands, use \`${char}commands\`.`
                            );
                            return;
                        default:
                            msg.reply(
                                `Successfully deleted the \`${char}${name}\` command!`
                            );
                    }
                });
            }
        },
        editcmd: {
            names: ["editcmd", "editcommand", "updatecmd", "updatecommand", "modifycmd", "modifycommand"],
            allowPrivate: false,
            perms: util.MOD,
            code(msg, args, argsStr, cmdName, char) {
                if (args.length < 2) {
                    msg.reply(
                        `To edit an existing command's response, use \`${char}editcmd [name] [modified response]\`.`
                    );
                    return;
                }
                let name = args[0].toLowerCase();
                if (name.charAt(0) === char) {
                    name = name.slice(1);
                }
                editCommand(msg.guild.id, name, args.slice(1).join(" "), (err) => {
                    switch (err) {
                        case "errnone":
                            msg.reply(
                                `It doesn't look like this server added a command with that name. Make sure it's spelled correctly. For a list of added commands, use \`${char}commands\`.`
                            );
                            return;
                        default:
                            msg.reply(
                                `Successfully modified the \`${char}${name}\` command!`
                            );
                    }
                });
            }
        },
        setcmdchar: {
            names: ["setcmdchar", "setcommandchar", "setcmdcharacter", "setcommandcharacter"],
            allowPrivate: false,
            perms: util.MOD,
            code(msg, args, argsStr, cmdName, char) {
                if (args.length !== 1 || args[0].length !== 1) {
                    msg.reply(
                        `To set the command character, use \`${char}setcmdchar [character]\`. The default character is \`!\`.`
                    );
                    return;
                }
                if (!settings.server.has(msg.guild.id)) {
                    settings.server.set(msg.guild.id, new Settings());
                }
                let sett = settings.server.get(msg.guild.id);
                sett.char = args[0].charAt(0);
                saveServer(msg.guild.id, sett, () => {
                    msg.reply(
                        `Command character set to \`${sett.char}\`!`
                    );
                });
            }
        },
        help: {
            names: ["help", "commands"],
            allowPrivate: true,
            perms: [],
            code(msg, args) {
                if (!args.length) {
                    msg.author.send(
                        util.dedent`Hey! I'm mushbot, a highly customizable chat bot for Discord.

                        If you're a mod in a server, you can create your own commands with the \`!addcmd\` command. These commands are simple command-reply commands.
                        You can edit commands you've created with \`!editcmd\` and delete commands with \`!delcmd\`.
                        You can also change the character used for commands with \`!setcmdchar\` (by default, this is "!", and is always "!" in private messages).

                        I also have many different commands available that are ready to use.
                        For help with a specific plugin, type \`!help [plugin name]\`
                        __Available plugins__: ${displayPlugins()}`
                    );
                    return;
                }
                let plugin = args[0].toLowerCase();
                let p = plugins.getLoadedPlugins();
                for (let i of p.values()) {
                    if (plugin === i.name && i.help) {
                        msg.author.send(i.help());
                        return;
                    }
                }
                msg.author.send(
                    `That's not a valid plugin name. Here's the list of plugins: ${displayPlugins()}`
                );
            }
        },
        reload: {
            names: ["reload"],
            allowPrivate: true,
            perms: ["fungus"],
            code(msg, args) {
                let p = plugins.getLoadedPlugins();
                if (args.length) {
                    let name = args[0].toLowerCase();
                    if (p.has(name)) {
                        unloadPluginCommands(p.get(name));
                    }
                    plugins.load(msg.client, name, (err, newPlugin) => {
                        if (err) {
                            msg.reply(
                                "There was an error loading that plugin!"
                            );
                            console.log(`error reloading ${name}`);
                            console.log(err);
                            return;
                        }
                        loadPluginCommands(newPlugin);
                        msg.reply(
                            `Successfully reloaded the ${name} plugin!`
                        );
                    });
                    return;
                }
                unloadAllPlugins(p);
                plugins.loadAll(msg.client, (err, newPlugins) => {
                    if (err) {
                        console.log("error reloading all");
                        console.log(err);
                        return;
                    }
                    loadPluginCommands(newPlugins);
                    msg.reply(
                        "Sucessfully reloaded all plugins!"
                    );
                });
            }
        },
        commandlist: {
            names: ["commandlist", "cmdlist", "listcmd", "listcmds", "listcommand", "listcommands"],
            allowPrivate: false,
            perms: util.ADMIN,
            code(msg, args, argsStr, cmdName, char) {
                if (!msg.guild || !msg.guild.id) {
                    return;
                }
                let cmds = commands.server.get(msg.guild.id);
                if (!cmds) {
                    msg.reply("No commands found.");
                    return;
                }
                msg.reply(
                    `**Added commands:** ${char}${Array.from(cmds.keys()).join(`, ${char}`)}`
                );
            }
        }
    }
};

// Chat event handler that handles chat commands.
function chatHandler(msg) {
    if (msg.channel.type !== "text" && msg.channel.type !== "dm") {
        return;
    }
    let char = msg.channel.type === "dm" ? "!" : getCommandChar(msg.guild.id);
    if (msg.content.charAt(0) !== char) {
        return;
    }
    if (msg.author.equals(msg.client.user)) {
        return;
    }
    let args = msg.content.substr(1).replace(/  +/g, " ").trim().split(" ");
    let cmdName = args.shift().toLowerCase();
    let cmd = getCommand(msg, cmdName);
    if (!cmd) {
        return;
    }
    if (!cmd.canExecute(msg)) {
        return;
    }
    cmd.execute(msg, args, args.join(" "), cmdName, char);
}

// Checks if a command exists by name, and returns the command object if so.
function getCommand(msg, name) {
    if (commands.plugin.has(name)) {
        return commands.plugin.get(name);
    }
    if (msg.channel.type === "dm") {
        return null;
    }
    if (commands.server.has(msg.guild.id)) {
        let cmds = commands.server.get(msg.guild.id);
        if (cmds.has(name)) {
            return cmds.get(name);
        }
    }
    return null;
}

// Checks if a new command can be added to the bot.
function newCommand(server, name, reply, cb) {
    if (commands.plugin.has(name)) {
        return cb("errexist");
    }
    if (commands.info.has(name)) {
        return cb("errexist");
    }
    if (name.indexOf("set") === 0 && commands.info.has(name.slice(3))) {
        return cb("errexist");
    }
    if (!commands.server.has(server)) {
        commands.server.set(server, new Map());
        settings.server.set(server, new Settings());
    }
    if (commands.server.get(server).has(name)) {
        return cb("errexist");
    }
    settings.server.get(server).commands.push({name, reply});
    setCommand(server, name, reply, cb);
}

// Edits an existing command's reply.
function editCommand(server, name, reply, cb) {
    if (!(commands.server.has(server) && commands.server.get(server).has(name))) {
        return cb("errnone");
    }
    let sett = settings.server.get(server).commands;
    for (let i of sett) {
        if (i.name === name) {
            i.reply = reply;
            break;
        }
    }
    setCommand(server, name, reply, cb);
}

// Sets a newly created command in the server's command list and then saves in the database.
function setCommand(server, name, reply, cb) {
    commands.server.get(server).set(name, createCommand(name, reply));
    saveServer(server, settings.server.get(server), cb);
}

// Deletes an existing command.
function deleteCommand(server, name, cb) {
    if (!(commands.server.has(server) && commands.server.get(server).has(name))) {
        return cb("errnone");
    }
    commands.server.get(server).delete(name);
    let sett = settings.server.get(server);
    for (let i = 0; i < sett.commands.length; i++) {
        if (sett.commands[i].name === name) {
            sett.commands.splice(i, 1);
            break;
        }
    }
    saveServer(server, sett, cb);
}

// Returns a new command with the given name and reply.
function createCommand(name, reply) {
    return new Command({
        names: [name],
        allowPrivate: false,
        perms: [],
        code(msg) {
            msg.channel.send(reply);
            return;
        }
    });
}

// Exported function.
// Returns the server's configured command character. Default is !
function getCommandChar(server) {
    return settings.server.has(server) ? settings.server.get(server).char : "!";
}

// Exported function.
// Checks if a command exists.
function checkCommand(cmd) {
    return commands.plugin.has(cmd);
}

// Helper function to display a list of available bot plugins.
function displayPlugins() {
    let payload = [];
    let p = plugins.getLoadedPlugins();
    for (let i of p.values()) {
        if (i.help) {
            payload.push(`\`${i.name}\``);
        }
    }
    return payload.join(", ");
}

function loadAllPlugins(plugins) {
    commands.plugin = new Map();
    for (let plugin of plugins.values()) {
        loadPluginCommands(plugin);
    }
}

function loadPluginCommands(plugin) {
    if (plugin.commands) {
        for (let command in plugin.commands) {
            let cmd = new Command(plugin.commands[command]);
            plugin.commands[command].names.forEach((name) => {
                if (commands.plugin.has(name)) {
                    throw new Error(`duplicate command name found: ${name}`);
                }
                commands.plugin.set(name, cmd);
            });
        }
    }
}

function unloadAllPlugins(plugins) {
    for (let plugin of plugins.values()) {
        unloadPluginCommands(plugin);
    }
}

function unloadPluginCommands(plugin) {
    for (let command in plugin.commands) {
        plugin.commands[command].names.forEach((name) => commands.plugin.delete(name));
    }
}

function loadServerSettings(mb, cb) {
    database.loadAll("commands-server", (err, docs) => {
        if (err) {
            return cb(err);
        }
        for (let doc of docs) {
            settings.server.set(doc._id, new Settings(doc.data));
            let cmds = new Map();
            for (let command of doc.data.commands) {
                if (commands.plugin.has(command.name) || commands.info.has(command.name)) {
                    continue;
                }
                cmds.set(command.name, createCommand(command.name, command.reply));
            }
            commands.server.set(doc._id, cmds);
        }
        cb();
    });
}

function loadInfoCommands(cb) {
    database.loadData("info", "cmds", (err, doc) => {
        if (err) {
            return cb(err);
        }
        commands.info = new Set(doc.data || []);
        cb();
    });
}

function saveServer(server, sett, cb) {
    database.saveData("commands-server", server, sett, cb);
}

function init(mb, plugins, cb) {
    loadAllPlugins(plugins);
    loadPluginCommands(CommandsPlugin);
    async.series([
        loadInfoCommands,
        (cb) => {
            loadServerSettings(mb, cb);
        }
    ], (err) => {
        if (err) {
            throw err;
        }
        mb.on("message", chatHandler);
        cb();
    });
}

function Settings(prev = {}) {
    this.char = prev.char || "!";
    this.commands = prev.commands || [];
}

module.exports = {
    init,
    getCommandChar,
    checkCommand
};
