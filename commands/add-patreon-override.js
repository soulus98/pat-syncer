const Sync = require("../func/sync.js");

module.exports = {
	name: "add-patreon-override",
	description: "Adds a member to the group of people who aren't ever checked or sweeped.",
  aliases: ["add-patreon", "ap"],
  usage: `\`${ops.prefix}ap <id/tag>\``,
	guildOnly:true,
	args:true,
	type:"Patreon",
	async execute(message, args) {
		let id = 0;
		if (args[0].startsWith("<@") && args[0].endsWith(">")) {
			id = args[0].slice(2, -1);
			if (id.startsWith("!")) id = id.slice(1);
		} else {
			id = args[0];
		}
		try {
			const member = await message.guild.members.fetch(id);
			try {
				await Sync.addOverride(id);
				message.react("👍");
				return;
			} catch (e) {
				if (e == "already") {
					message.reply(`The member ${member.user.username}#${id} was already in the patreon override list.`);
					return `, but it failed, as ${id} was already in the overrideList`;
				}
			}
		} catch (e) {
			if (e.code == 50035) {
				message.reply(`\`${id}\` is not a valid Discord Snowflake. Please try again.`);
				return `, but it failed, as there was a typo etc in the id: ${id}.`;
			}
			if (e.code == 10013) {
				message.reply("I was not able to find this member. Perhaps they have left or there is a typo.");
				return `, but it failed, as I could not find the member with id: ${id}.`;
			}
			console.error(e);
		}
	},
};
