const { token } = require("./server/keys.json"),
			fs = require("fs"),
			path = require("path"),
			Discord = require("discord.js"),
			{ handleCommand } = require("./handlers/commands.js"),
			{ dateToTime, errorMessage, dev } = require("./func/misc.js"),
			Sync = require("./func/sync.js"),
			ver = require("./package.json").version,
			act = require("./server/config.json").activity || ver;
const client = new Discord.Client({
	intents: [
		Discord.Intents.FLAGS.GUILDS,
		Discord.Intents.FLAGS.GUILD_MESSAGES,
		Discord.Intents.FLAGS.GUILD_MEMBERS,
	],
	partials: [
		"CHANNEL",
		"GUILD_MEMBER",
	],
	presence: {
		status: "online",
		activities: [{
			name: act,
			type: "PLAYING",
		}],
	},
}),
launchDate = new Date();
let loaded = false,
		server = {};
ops = {};
module.exports = { loadConfigs };

// Loads all the variables at program launch
async function load(){
	console.log("======================================================================================\n");
	console.log("Server starting...");
		await loadConfigs();
		await loadCommands();
		await Sync.loadOverride();
		client.login(token);
}
// Loads (or re-loads) the bot settings
function loadConfigs(){
	return new Promise((resolve) => {
		ops = {};
		delete require.cache[require.resolve("./server/config.json")];
		ops = require("./server/config.json");
		if (!loaded){
			console.log("\nLoading configs...");
			console.log("\nConfigs:", ops);
			loaded = true;
			resolve();
		} else {
			(async () => {
				server = await client.guilds.fetch(ops.serverID);
				console.log("\nReloaded configs\n");
				resolve();
			})();
		}
	});
}
// Loads the command files. This was standard in the discord.js guide
function loadCommands(){
	return new Promise((resolve) => {
		client.commands = new Discord.Collection();
		const commandFiles = fs.readdirSync(path.resolve(__dirname, "./commands")).filter(file => file.endsWith(".js"));
		let commandFilesNames = "\nThe currently loaded commands and cooldowns are:\n";
		for (const file of commandFiles) {		// Loads commands
			const command = require(`./commands/${file}`);
			commandFilesNames = commandFilesNames + ops.prefix + command.name;
			if (command.cooldown){
				commandFilesNames = commandFilesNames + ":\t" + command.cooldown + " seconds \n";
			} else {
				commandFilesNames = commandFilesNames + "\n";
			}
			client.commands.set(command.name, command);
		}
		console.log(commandFilesNames);
		resolve();
	});
}

load();

client.once("ready", async () => {
	server = await client.guilds.fetch(ops.serverID);
	const soul = await client.users.fetch(dev, false, true);
	client.user.setActivity(`${act}`);
	if (server == undefined){
		console.log("\nOops the main server is broken.");
		return;
	}
	const activeServers = client.guilds.cache;
	const activeServerList = [];
	activeServers.each(serv => activeServerList.push(`"${serv.name}" aka #${serv.id}`));
	soul.send(`**Dev message:** Active in:\n${activeServerList.join("\n")}`).catch(console.error);
	soul.send(`**Dev message:** Loaded patreon sync bot in guild: "${server.name}"#${server.id}`).catch(console.error);
	console.log(`\nActive in:\n${activeServerList.join("\n")}`);
	console.log(`\nServer started at: ${launchDate.toLocaleString()}. Loaded in guild: "${server.name}"#${server.id}`);
	console.log("\n======================================================================================\n");
	console.log("Set a daily interval for sweeping.");
	console.log("Sweeping patreon members...");
	await Sync.sweep(server);
	setInterval(() => {
		console.log(`[${dateToTime(new Date())}]: Daily sweep of patreon members...`);
		Sync.sweep(server);
	}, 24 * 60 * 60 * 1000);

	client.on("guildMemberUpdate", async (oldMember, newMember) => {
		if (newMember.partial) console.log("newMember was partial. newMember:", newMember);
		const audit = await newMember.guild.fetchAuditLogs({
			limit:1,
			type: "MEMBER_ROLE_UPDATE",
		});
		const entry = audit.entries.first();
		const entTime = entry.createdTimestamp,
					entKey = entry.changes[0].key,
					entTargetId = entry.target.id;
		if (
			entTime > Date.now() - 5000
			&& (entKey == "$add" || entKey == "$remove")
			&& entTargetId == newMember.id
		) {
			if (newMember.guild.id != ops.serverID)	Sync.checkRole(newMember, entry.changes[0].new[0].id);
			else if (entry.changes[0].new[0].id == ops.plusRole) Sync.roleReverse(newMember, entKey);
		}
	})
	.on("guildMemberAdd", async (guildMember) => {
		if (guildMember.guild.id == ops.serverID) {
			const res = await Sync.check(guildMember);
			if (res == "added") console.log(`${guildMember.user.username}#${guildMember.id} joined the server and was given a role`);
			if (res == "removed") console.error(`Impossible bug. ${guildMember.user.username}#${guildMember.id} had erroneous roles upon entering the main server...?`);
		} else {
			Sync.checkReverseJoin(guildMember);
		}
	})
	.on("guildMemberRemove", async (guildMember) => {
		Sync.checkReverseRemove(guildMember);
	});

})
.on("messageCreate", async (message) => {
	if (message.guild == server) handleCommand(message, new Date()); // command handler
})
.on("shardError", (error) => {
	console.error(`[${dateToTime(new Date())}]: Websocket disconnect: ${error}`);
})
.on("shardResume", () => {
	if (loaded) {
		console.error("Resumed! Refreshing Activity...");
		client.user.setActivity(`${act}`);
	}
})
.on("shardDisconnect", () => {
	console.error("Disconnected!");
})
.on("shardReady", () => {
	if (loaded) {
		console.error("Reconnected! Refreshing Activity...");
		client.user.setActivity(`${act}`);
	}
})
.on("shardReconnecting", () => {
	console.error("Reconnecting...");
});

process.on("uncaughtException", (err) => {
	errorMessage(new Date(), false, `Uncaught Exception: ${err}`);
})
.on("unhandledRejection", (err, promise) => {
	console.error(`[${dateToTime(new Date())}]: Unhandled rejection at `, promise, `reason: ${err}`);
})
.on("SIGINT", () => {
  console.log(`Process ${process.pid} has been interrupted`);
});
