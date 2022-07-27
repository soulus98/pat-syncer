const { loadOverride } = require("../func/sync.js");

module.exports = {
	name: "list-overriden-patreon-members",
	description: "Lists all of the filtered raid channels and raid categories.",
  aliases: ["ls", "list", "list-overrides", "list-patreon", "patreon-members"],
  usage: `\`${ops.prefix}list\``,
	guildOnly:true,
	type:"Info",
	async execute(message) {
		const list = await loadOverride();
		const amount = list.length;
		if (amount == 0) {
			message.reply("There are no members currently on the override list");
			return;
		}
		const data = ["Here is the current override list:"];
		list.forEach((id) => {
			data.push(`<@${id}>`);
		});
		message.reply(data.join("\n"));
		return;
	},
};
