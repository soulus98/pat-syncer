const fs = require("fs"),
			path = require("path"),
			{ Collection, MessageEmbed } = require("discord.js"),
			{ dateToTime } = require("./misc.js"),
			patreonIds = new Collection,
			vipIds = new Collection;

let list = [];

module.exports = {
	async sweep(server){
		console.log("Loading members...");
		const allMembers = await server.members.fetch();
		const roledMembers = allMembers.filter(m => m.roles.cache.has(ops.patRole) || m.roles.cache.has(ops.vipRole));
		console.log("Members loaded. Checking and sweeping.");
		const guildFiles = fs.readdirSync(path.resolve(__dirname, "../server/guilds")).filter(fileName => fileName.endsWith(".json"));
		for (const fileName of guildFiles) {
			const guildConfig = require(`../server/guilds/${fileName}`);
			for (const roleId of guildConfig.patRoles) {
				const arr = patreonIds.get(guildConfig.serverID);
				if (arr) {
					arr.push(roleId);
					patreonIds.set(guildConfig.serverID, arr);
				}	else {
					patreonIds.set(guildConfig.serverID, [roleId]);
				}
			}
			const arr = vipIds.get(guildConfig.serverID);
			if (arr) {
				arr.push(guildConfig.vipRole);
				vipIds.set(guildConfig.serverID, arr);
			}	else vipIds.set(guildConfig.serverID, [guildConfig.vipRole]);
		}
		let removedAmount = 0;
		let addedAmount = 0;
		const logsChannel = await server.channels.fetch(ops.logsChannel);
		logsChannel.send("Sweeping server for VIP and Patreon Roles");
		await checkMember(0);
		console.log(`[${dateToTime(new Date())}]: Sweeped. ${removedAmount} members had their roles removed and ${addedAmount} members had roles added.`);
		logsChannel.send(`Sweep finished! ${removedAmount} members had their roles removed and ${addedAmount} members had roles added.`);
		async function checkMember(i) {
			const member = roledMembers.at(i);
			if (member.bot) {
				await checkMember(i + 1);
				return;
			}	else {
				const res = await module.exports.check(member);
				if (res?.includes("removed")) removedAmount++;
				if (res?.includes("added")) addedAmount++;
				if (i == roledMembers.size - 1) return;
				await checkMember(i + 1);
				return;
			}
		}
	},
	async checkRole(member, roleId){
		const server = member.guild;
		const serverPatIds = patreonIds.get(server.id);
		const serverVIPIds = vipIds.get(server.id);
		if (!serverPatIds.includes(roleId) && !serverVIPIds.includes(roleId)) return;
		const res = await module.exports.check(member);
		return res;
	},
	async check(member){
		if (list.includes(member.id)) {
			return "overriden";
		}
		try {
			const givePat = await checkPat(member);
			const giveVIP = await checkVIP(member);
			const server = await member.client.guilds.fetch(ops.serverID);
			let serverMember;
			try {
				serverMember = await server.members.fetch(member.id);
			} catch (e) {
				if (!e.code == 10007) console.error(e);
				return;
			}
			const memberRoles = serverMember.roles;
			const hadPat = memberRoles.cache.has(ops.patRole);
			const hadVIP = memberRoles.cache.has(ops.vipRole);
			const results = [];
			if (givePat && hadPat) {
				results.push(false);
			} else if (givePat) {
				results.push("addPat");
			} else if (hadPat) {
				results.push("remPat");
			} else {
				results.push(false);
			}
			if (giveVIP && hadVIP) {
				results.push(false);
			} else if (giveVIP) {
				results.push("addVIP");
			} else if (hadVIP) {
				results.push("remVIP");
			} else {
				results.push(false);
			}
			if (!results[0] && !results[1]) return;
			let addRes = [],
					remRes = [];
			if (results[0] == "addPat") {
				await memberRoles.add(ops.patRole);
				addRes.push("Patreon");
			} else if (results[0] == "remPat") {
				await memberRoles.remove(ops.patRole);
				remRes.push("Patreon");
			}
			if (results[1] == "addVIP") {
				await memberRoles.add(ops.vipRole);
				addRes.push("VIP");
			} else if (results[1] == "remVIP") {
				await memberRoles.remove(ops.vipRole);
				remRes.push("VIP");
			}
			const result = [ ];
			if (addRes.length == 0) addRes = ["Nothing"];
			else result.push("added");
			if (remRes.length == 0) remRes = ["Nothing"];
			else result.push("removed");
			const embed = new MessageEmbed()
			.setColor(0xFFFF00)
			.setTitle("Roles updated.")
			.setThumbnail(member.user.displayAvatarURL())
			.setDescription(`User: ${member}\nAdded: ${addRes.join("\n• ")}\nRemoved: ${remRes.join("\n• ")}`);
			console.log(`${member.user.username}#${member.id} Added: ${addRes.join(", ")}. Removed: ${remRes.join(", ")}`);
			const logsChannel = await server.channels.fetch(ops.logsChannel);
			logsChannel.send({ embeds: [embed] });
			return result;
		} catch (err) {
			console.error(err);
		}
	},
	async addOverride(id) {
		if (list.includes(id)) throw "already";
		list.push(id);
		await module.exports.saveOverride();
		return;
	},
	async removeOverride(id) {
		if (!list.includes(id)) throw "not";
		list.splice(list.indexOf(id));
		await module.exports.saveOverride();
		return;
	},
	async loadOverride() {
		const res = await delCache();
		if (res != "success") throw `Error thrown when loading override list. Error: ${res}`;
		try {
			const jsonList = require("../server/overrideList.json");
			list = jsonList;
			console.log(`Override list loaded. It contains ${list.length} members.`);
			return list;
		} catch (e) {
			if (e.code == "MODULE_NOT_FOUND") {
				fs.writeFile(path.resolve(__dirname, "../server/overrideList.json"), "[]", (err) => {
					if (err){
						throw `Error thrown when writing the override list file. Error: ${err}`;
					}
					console.log("Could not find overrideList.json. Making a new one...");
					list = require("../server/overrideList.json");
					return list;
				});
			}	else {
				throw `Error thrown when loading the override list (2). Error: ${e}`;
			}
		}
	},
	async saveOverride() {
		fs.writeFile(path.resolve(__dirname, "../server/overrideList.json"), JSON.stringify(list), (err) => {
			if (err){
				throw `Error: An error occured while saving the cleanup list. Error: ${err}`;
			} else {
				return;
			}
		});
	},
};
async function checkPat(member){
	for (const [sId, arr] of patreonIds) {
		const s = await member.client.guilds.cache.get(sId);
		let sMember;
		try {
			sMember = await s.members.fetch(member.id);
		} catch (e) {
			if (!e.code == 10007) console.error(e);
			continue;
		}
		for (const roleId of arr) {
			if (sMember.roles.cache.has(roleId)) {
				return true;
			}
		}
	}
	return false;
}
async function checkVIP(member) {
	for (const [sId, arr] of vipIds) {
		const s = await member.client.guilds.cache.get(sId);
		let sMember;
		try {
			sMember = await s.members.fetch(member.id);
		} catch (e) {
			if (!e.code == 10007) console.error(e);
			continue;
		}
		for (const roleId of arr) {
			if (sMember.roles.cache.has(roleId)) {
				return true;
			}
		}
	}
	return false;
}
async function delCache() {
	try {
		delete require.cache[require.resolve("../server/overrideList.json")];
		return "success";
	} catch (e){
		if (e.code == "MODULE_NOT_FOUND") {
			// do nothing
			return "success";
		} else {
			throw e;
		}
	}
}
