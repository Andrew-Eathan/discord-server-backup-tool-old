const fetch = require("node-fetch");
const fs = require("fs");
const reader = require("readline-sync");
const { Console } = require("console");

console.log("+-----------------------------------------+")
console.log("|andreweathan's discord server backup tool|")
console.log("+-----------------------------------------+")
console.log()
let token = reader.question("Insert Token: ")
console.log("Logging in...")

// to-do:
// - add thread saving
// - add channel info file (description, slowmode level, names, etc)
// - add emoji saving
// - maybe add more member saving functionality?

// i hate discord.js 13+ so much that i'm just going to use v12.5.3
// update from future andrew: i have converted this to discord.js 13 lol
const { Client } = require('discord.js-selfbot-v13')
const bot = new Client()

clean4FS = str => str.toLowerCase().replaceAll(/[^a-zA-Z0-9\(\)\s\-]+/gm, "_");

// to keep saved zips short
getInitials = str => {
	let st = ""
	str.split(/\s/gm).forEach(s => st += s[0])
	return st
}

var logout = fs.createWriteStream("logout.log")
var logerr = fs.createWriteStream("logerr.log")
var logs = new Console(logout, logerr);

process.on("unhandledException", e => {
	process.stdout.write("\r\n[ERROR] An unhandled exception happened! Please report this to me :( -- " + e + "\r\n")
	console.log(e)
	logs.error("[CRITICAL] Unhandled exception: " + e)
	logs.error(e)
})

async function getLinkData(link) {
	let res = await fetch(link)
	let buffer = await res.buffer()
	return buffer
}

function timeToLocaleString(date, locale) {
	return date.toLocaleTimeString(locale, {
		hour12: false
	})
}

function dateToLocaleString(date, locale) {
	return date.toLocaleDateString(locale)
}

function dateAndTime(date, locale) {
	return dateToLocaleString(date, locale) + " " + timeToLocaleString(date, locale)
}

let permissionBitLookup = [
	"ADMINISTRATOR",
	"CREATE_INSTANT_INVITE",
	"KICK_MEMBERS",
	"BAN_MEMBERS",
	"MANAGE_CHANNELS",
	"MANAGE_GUILD",
	"ADD_REACTIONS",
	"VIEW_AUDIT_LOG",
	"PRIORITY_SPEAKER",
	"STREAM",
	"VIEW_CHANNEL",
	"SEND_MESSAGES",
	"SEND_TTS_MESSAGES",
	"MANAGE_MESSAGES",
	"EMBED_LINKS",
	"ATTACH_FILES",
	"READ_MESSAGE_HISTORY",
	"MENTION_EVERYONE",
	"USE_EXTERNAL_EMOJIS",
	"VIEW_GUILD_INSIGHTS",
	"CONNECT",
	"SPEAK",
	"MUTE_MEMBERS",
	"DEAFEN_MEMBERS",
	"MOVE_MEMBERS",
	"USE_VAD",
	"CHANGE_NICKNAME",
	"MANAGE_NICKNAMES",
	"MANAGE_ROLES",
	"MANAGE_WEBHOOKS",
	"MANAGE_EMOJIS_AND_STICKERS",
	"USE_APPLICATION_COMMANDS",
	"REQUEST_TO_SPEAK",
	"MANAGE_EVENTS",
	"CREATE_PUBLIC_THREADS",
	"CREATE_PRIVATE_THREADS",
	"SEND_MESSAGES_IN_THREADS",
	//"USE_EMBEDDED_ACTIVITIES", // gave me an error when i tried to use it, maybe it's a v14 thing?
	"MODERATE_MEMBERS"
]

let selectedGuild;
let selectedChannels = [];
let process_continue;
let process_options;
let process_begin;

async function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

// after login to user account, here is where we choose the guild and channels to back up
process_continue = async _ => {
	console.log(`Login successful [${bot.user.tag}]`)
	logs.log(`Login successful [${bot.user.tag}]`)

	let mapping = []
	bot.guilds.cache.forEach(value => mapping.push(value))

	logs.log(`Detected ${mapping.length} guilds:`)

	mapping.forEach((value, idx) => {
		console.log(`${idx}: ${value.name}`, `(${value.memberCount} members)`)
		logs.log(`${idx}: ${value.name} (${value.memberCount}) members) ID: ${value.id}`)
	});

	console.log("This is a list of guilds you are in, type the number of the guild you want to back up!")

	while (selectedGuild == null) {
		let idx = Number(reader.question("> "))
		if (isNaN(idx)) {console.log("Please type a number!"); continue}
		if (idx < 0 || idx >= mapping.length) {console.log("Choice is outside of the bounds!"); continue};
		if (idx % 1 != 0) {console.log("No decimals..."); continue}

		selectedGuild = mapping[idx];
	}

	logs.log(`Selected guild ${selectedGuild.id}`)

	// get channels
	mapping = [];

	let channellist = selectedGuild.channels.cache
	for await (let [id, value] of channellist) {
		if (value.type == "GUILD_TEXT" || value.type == "GUILD_VOICE") {
			mapping.push(value)
		}
	}

	// channels area
	mapping.forEach((value, idx) => {
		if (value.type == "GUILD_TEXT")
			console.log(`${idx}: ${value.name}`)
		else if (value.type == "GUILD_VOICE")
			console.log(`${idx}: ${value.name} (Voice)`)
		else {
			let ctype_clean = value.type.replace(/GUILD_/gm, "").replace(/_/gm, ""); // make the channel type prettier to see
			console.log(`${idx}: ${value.name} (${ctype_clean})`)
		}
	});

	console.log("Select channels by typing their numbers and pressing enter!")
	console.log("To exclude a channel from this list (and the backup), add ! before it (example: !4)")
	console.log("When you're done adding channels, type \"next\"")

	// while there's channels left to choose (0 is falsy so it fails the check if there are no channels)
	while (mapping.length) {
		let idx = reader.question("> ")
		if (idx == "next") break;
		let doRemove = false

		console.log(idx)
		if (idx[0] == "!") {
			doRemove = true;
			idx = idx.substring(1)
			console.log(idx, 1032)
		}
	
		idx = Number(idx);

		if (isNaN(idx)) {console.log("Please type a number, or \"next\" if you're done!"); continue}
		if (idx < 0 || idx >= mapping.length) {console.log("Choice is outside of the bounds!"); continue};
		if (idx % 1 != 0) {console.log("No decimals..."); continue}

		let channel = mapping.splice(idx, 1)[0];
		if (!doRemove) selectedChannels.push(channel);

		logs.log(`${doRemove ? "Excluded" : "Added"} channel ${channel.name} (id ${channel.name}, idx ${idx})`)

		console.log()
		console.log("Remaining channels:")
		mapping.forEach((value, idx) => {
			if (value.type == "GUILD_TEXT")
				console.log(`${idx}: ${value.name}`)
			else if (value.type == "GUILD_VOICE")
				console.log(`${idx}: ${value.name} (Voice)`)
			else {
				let ctype_clean = value.type.replace(/GUILD_/gm, "").replace(/_/gm, ""); // make the channel type prettier to see
				console.log(`${idx}: ${value.name} (${ctype_clean})`)
			}
		});
	}

	console.log(`Selected ${selectedChannels.length} channels!`)
	process_options()
}

//ugly object incoming
let localedata = [
	"af", "af-NA", "am", "ar", "ar-AE", "ar-BH", "ar-DJ", "ar-DZ", "ar-EG", "ar-EH", "ar-ER", "ar-IL", "ar-IQ", "ar-JO", "ar-KM", "ar-KW", "ar-LB", "ar-LY", "ar-MA", "ar-MR", "ar-OM", "ar-PS", "ar-QA", "ar-SA", "ar-SD", "ar-SO", "ar-SS", "ar-SY", "ar-TD", "ar-TN", "ar-YE", "as", "az", "az-Latn", "be", "bg", "bn", "bn-IN", "bs", "bs-Latn", "ca", "ca-AD", "ca-ES-VALENCIA", "ca-FR", "ca-IT", "cs", "cy", "da", "da-GL", "de", "de-AT", "de-BE", "de-CH", "de-IT", "de-LI", "de-LU", "el", "el-CY", "en", "en-001", "en-150", "en-AE", "en-AG", "en-AI", "en-AS", "en-AT", "en-AU", "en-BB", "en-BE", "en-BI", "en-BM", "en-BS", "en-BW", "en-BZ", "en-CA", "en-CC", "en-CH", "en-CK", "en-CM", "en-CX", "en-CY", "en-DE", "en-DG", "en-DK", "en-DM", "en-ER", "en-FI", "en-FJ", "en-FK", "en-FM", "en-GB", "en-GD", "en-GG", "en-GH", "en-GI", "en-GM", "en-GU", "en-GY", "en-HK", "en-IE", "en-IL", "en-IM", "en-IN", "en-IO", "en-JE", "en-JM", "en-KE", "en-KI", "en-KN", "en-KY", "en-LC", "en-LR", "en-LS", "en-MG", "en-MH", "en-MO", "en-MP", "en-MS", "en-MT", "en-MU", "en-MW", "en-MY", "en-NA", "en-NF", "en-NG", "en-NL", "en-NR", "en-NU", "en-NZ", "en-PG", "en-PH", "en-PK", "en-PN", "en-PR", "en-PW", "en-RW", "en-SB", "en-SC", "en-SD", "en-SE", "en-SG", "en-SH", "en-SI", "en-SL", "en-SS", "en-SX", "en-SZ", "en-TC", "en-TK", "en-TO", "en-TT", "en-TV", "en-TZ", "en-UG", "en-UM", "en-US-POSIX", "en-VC", "en-VG", "en-VI", "en-VU", "en-WS", "en-ZA", "en-ZM", "en-ZW", "es", "es-419", "es-AR", "es-BO", "es-BR", "es-BZ", "es-CL", "es-CO", "es-CR", "es-CU", "es-DO", "es-EA", "es-EC", "es-GQ", "es-GT", "es-HN", "es-IC", "es-MX", "es-NI", "es-PA", "es-PE", "es-PH", "es-PR", "es-PY", "es-SV", "es-US", "es-UY", "es-VE", "et", "eu", "fa", "fa-AF", "fi", "fil", "fr", "fr-BE", "fr-BF", "fr-BI", "fr-BJ", "fr-BL", "fr-CA", "fr-CD", "fr-CF", "fr-CG", "fr-CH", "fr-CI", "fr-CM", "fr-DJ", "fr-DZ", "fr-GA", "fr-GF", "fr-GN", "fr-GP", "fr-GQ", "fr-HT", "fr-KM", "fr-LU", "fr-MA", "fr-MC", "fr-MF", "fr-MG", "fr-ML", "fr-MQ", "fr-MR", "fr-MU", "fr-NC", "fr-NE", "fr-PF", "fr-PM", "fr-RE", "fr-RW", "fr-SC", "fr-SN", "fr-SY", "fr-TD", "fr-TG", "fr-TN", "fr-VU", "fr-WF", "fr-YT", "ga", "ga-GB", "gl", "gu", "he", "hi", "hr", "hr-BA", "hu", "hy", "id", "is", "it", "it-CH", "it-SM", "it-VA", "ja", "jv", "ka", "kk", "km", "kn", "ko", "ko-KP", "ky", "lo", "lt", "lv", "mk", "ml", "mn", "mr", "ms", "ms-BN", "ms-ID", "ms-SG", "my", "nb", "nb-SJ", "ne", "ne-IN", "nl", "nl-AW", "nl-BE", "nl-BQ", "nl-CW", "nl-SR", "nl-SX", "or", "pa", "pa-Guru", "pl", "ps", "ps-PK", "pt", "pt-AO", "pt-CH", "pt-CV", "pt-GQ", "pt-GW", "pt-LU", "pt-MO", "pt-MZ", "pt-PT", "pt-ST", "pt-TL", "ro", "ro-MD", "root", "ru", "ru-BY", "ru-KG", "ru-KZ", "ru-MD", "ru-UA", "sd", "sd-Arab", "si", "sk", "sl", "so", "so-DJ", "so-ET", "so-KE", "sq", "sq-MK", "sq-XK", "sr", "sr-Cyrl", "sr-Cyrl-BA", "sr-Cyrl-ME", "sr-Cyrl-XK", "sr-Latn", "sr-Latn-BA", "sr-Latn-ME", "sr-Latn-XK", "sv", "sv-AX", "sv-FI", "sw", "sw-CD", "sw-KE", "sw-UG", "ta", "ta-LK", "ta-MY", "ta-SG", "te", "th", "tk", "tr", "tr-CY", "uk", "ur", "ur-IN", "uz", "uz-Latn", "vi", "yue", "yue-Hant", "zh", "zh-Hans", "zh-Hans-HK", "zh-Hans-MO", "zh-Hans-SG", "zh-Hant", "zh-Hant-HK", "zh-Hant-MO", "zu"
]

let chosen_options = {
	"save_server_data": {
		text: "Save server information? (name, data, avatar, moderation, etc)",
		default: true,
		accepted: [
			"y", "n"
		],
		type: "bool"
	},
	// actually, why would someone not want this
	// removed it
	/*"save_time": {
		text: "Save message time information?",
		default: true,
		accepted: [
			"y", "n"
		],
		type: "bool"
	},*/
	"save_members": {
		text: "Save members?",
		default: true,
		accepted: [
			"y", "n"
		],
		type: "bool"
	},
	"save_members_images": {
		text: "Save the avatars and banners of members? Note: This will save them in a lower quality to avoid large export sizes!\n (y)es, (n)o, yes, in (f)ull quality",
		default: "n",
		accepted: [
			"y", "n", "f"
		],
		type: "choice"
	},
	"save_roles": {
		text: "Save roles?",
		default: true,
		accepted: [
			"y", "n"
		],
		type: "bool"
	},
	"save_member_message_count": {
		text: "Save members message count?",
		default: true,
		accepted: [
			"y", "n"
		],
		type: "bool"
	},
	"save_bans": {
		text: "Save bans? You must have permission to ban in the server to be able to save bans.",
		default: true,
		accepted: [
			"y", "n"
		],
		type: "bool"
	},
	"time_locale": {
		text: localedata.join(", ") + "\n\nChoose your locale of the time from above, leave blank to default to en-US:",
		default: "en-US",
		accepted: localedata,
		type: "choice"
	},
	"interval": {
		text: "How long should the interval in seconds between message requests be for the backup? (0.75-10)\nSet this to 1.5 if you don't know what to choose.\nDiscord may rate-limit you if you put it too low!",
		default: 1.5,
		not_precise: true,
		min: 0.75,
		max: 10,
		type: "number"
	}
}

// option info gathering
process_options = _ => {
	console.log("OPTIONS:")
	console.log("Type y/n or an option depending on the question:")

	Object.keys(chosen_options).forEach(key => {
		let option = chosen_options[key]
		console.log(option.text);
		
		while (true) {
			let answer = reader.question("> ")
			if (answer == "") {
				chosen_options[key] = option.default;
				break;
			}

			process_answer: 
			if (!option.not_precise && !option.accepted.includes(answer)) {
				console.log("Invalid answer, accepted values are:")
				console.log(option.accepted.join(", "))
				console.log("Choose one of the above!")
			}
			else
			{
				switch (option.type) {
					case "bool":
						chosen_options[key] = answer == "y" ? true : false
					break;
					case "number":
						let num = Number(answer)
						if (isNaN(num)) {
							console.log("Please type a number!")
							break process_answer;
						}
						if (num < option.min || num > option.max) {
							console.log("Number outside allowed range!")
							break process_answer;
						}

						chosen_options[key] = num
					break;
					default:
						chosen_options[key] = answer
					break;
				}
				break;
			}
		}
	})

	logs.log(`Parameters:`)
	logs.log(chosen_options)

	console.log("Beginning backup process in 3 seconds!")
	setTimeout(process_begin, 3000)
}

bot.rest.tokenPrefix = "" // trick discovered by a friend to bypass bot-user limitation
bot.login(token).catch(e => {
	console.log(e)
}).then(process_continue);

const JSZip = require("jszip");
process_begin = async _ => {
	// explanation:
	// we start with no previous chunk so we fetch the first ~100 messages (api limit)
	// then we find the ID of the earliest message in this chunk and assign it to prevChunk so we know where to continue next
	// we continue this until we hit <100 messages in a fetch, which means we've reached the channel's end
	// then continue to the next channel, and go on until the end, where we save this information

	let messages;
	let prevChunk;
	let guild = await selectedGuild.fetch()
	let vanityData = {};
	let owner = guild.owner;

	try {
		vanityData = await guild.fetchVanityData()
	} catch {};

	let zip = new JSZip()
	let svinfo;

	if (chosen_options.save_server_data) {
		console.log("Saving server information...")
		svinfo = svinfo ?? zip.folder("server");

		logs.log("[Server backup start]")
		
		// save icon
		svinfo.file("icon.png", getLinkData(guild.iconURL({format: "png"}) ?? "https://cdn.discordapp.com/attachments/947806697878069249/953378638152228874/unknown.png?size=256"))
		svinfo.file("banner.png", getLinkData(guild.bannerURL({format: "png"}) ?? "https://cdn.discordapp.com/attachments/868443505045962783/953379661444948078/unknown.png?size=256"))

		let lookupTier = ["No Tier", "Tier 1", "Tier 2", "Tier 3"]
		let lookupECFL = ["Disabled", "Members without roles", "All members are scanned"]

		// save data stuff
		let str = 
			`Main server information\r\n`
			+ `Name: ${guild.name}\r\n`
			+ `Description: ${guild?.description ?? "None"}\r\n`
			+ `Owner: ${owner?.user?.tag ?? "Unknown"} (ID ${guild.ownerID})\r\n`
			+ `Boosts: ${guild.premiumSubscriptionCount ?? "Unknown"} (${lookupTier[guild.premiumTier]})\r\n`
			+ `Verified: ${guild.verified ? "Yes" : "No"}\r\n`
			+ `Region: ${guild.region}\r\n`
			+ `Partnered: ${guild.partnered ? "Yes" : "No"}\r\n`
			+ `Guild ID: ${guild.id}\r\n`
			+ `Vanity URL (invite): ${vanityData.code ?? "None"} (${vanityData.uses ?? "Unknown"} uses)\r\n`
			+ `Verification Level: ${guild.verificationLevel}\r\n`
			+ `\r\n`
			+ `Extra info:\r\n`
			+ `AFK Channel: ${guild.afkChannel?.name ?? "None"}\r\n`
			+ `AFK Timeout: ${guild.afkTimeout}\r\n`
			+ `Member Count: ${guild.memberCount}\r\n`
			+ `Presence Count: ${guild.approximatePresenceCount}\r\n`
			+ `Created on ${dateToLocaleString(guild.createdAt, chosen_options.time_locale)} at ${timeToLocaleString(guild.createdAt, chosen_options.time_locale)} (locale: ${chosen_options.time_locale})\r\n`
			+ `Notifications: ${guild.defaultMessageNotifications == 0 ? "All" : "Only mentions"}\r\n`
			+ `Maximum members: ${guild.maximumMembers ?? "Unknown"}\r\n`
			+ `Multi-Factor Authentication level: ${guild.mfaLevel}\r\n`
			+ `Guild Preferred Locale: ${guild.preferredLocale}\r\n`
			+ `Explicit Content Filtering: ${lookupECFL[guild.explicitContentFilter]}\r\n`
			+ `\r\n`
			+ `Rules Channel: ${guild.rulesChannel?.name ?? "None"}\r\n`
			+ `System Channel (join messages, boosts, etc): ${guild.systemChannel?.name ?? "None"} (id ${guild.systemChannel?.id ?? "unknown"})\r\n`;

		logs.log("[Server backup end]")
		
		svinfo.file("data.txt", str)
		console.log("Saved server information!")
		logs.log("[Server backup save]")
	}

	if (chosen_options.save_members) {
		console.log("Saving members...")
		logs.log("[Member backup start]")

		svinfo = svinfo ?? zip.folder("server");
		let members = await guild.members.fetch()

		let str = `List of ${members.size} members:\r\n\r\n`
		let imagedata = {}
		let imagefolder
		let doSaveImgs = chosen_options.save_members_images
		if (doSaveImgs != "n") {
			imagefolder = svinfo.folder("member_avatars")
		}
		
		let i = 0;
		for (var member of members) {
			process.stdout.write(`${Math.floor((i + 1) / members.size * 100)}% (${i + 1}/${members.size})        \r`)
			i++
			// using this iteration method gives us an array of key and value for each item
			// so we need to extract the value
			member = member[1]

			// update member with latest uncached copy
			try {
				member = await member.fetch();
			} catch {};

			let user = member.user;
			let ttime = member.communicationDisabledUntil;
			let timeout = member.isCommunicationDisabled() ? `Yes, until ${dateAndTime(ttime, chosen_options.time_locale)}` : "No"
			let boosting = member.premiumSince ? `Yes, since ${dateAndTime(member.premiumSince, chosen_options.time_locale)}` : "No"

			logs.log(`Backing up ${user?.tag} (${i + 1} / ${members.size})`)

			str = str
				+ `${user?.tag}:\r\n`
				+ `Avatar URL: ${user.avatarURL({format: "png"})}\r\n`
				+ `Display Name: ${member.displayName ?? "Unknown"} (Device: ${member?.clientStatus ?? "Unknown"})\r\n`
				+ `Nickname: ${member.nickname ?? "None"}\r\n`
				+ `Timed out?: ${timeout} \r\n`
				+ `Displayed Hex Color: ${member.displayHexColor}\r\n`
				+ `ID: ${user.id}\r\n`
				+ `Joined at: ${dateToLocaleString(member.joinedAt, chosen_options.time_locale)} at ${timeToLocaleString(member.joinedAt, chosen_options.time_locale)}\r\n`
				+ `Pending membership?: ${member.pending ? "Yes" : "No"}\r\n`
				+ `Boosting?: ${boosting}\r\n`
				+ `Current presence: ${member.presence?.status ?? "Unknown"}\r\n`
				+ `Activities: Currently ${member.presence?.activities?.length ?? "unknown"}\r\n`

			// store activity info
			if (member.presence != null)
				member.presence.activities.forEach((activity, idx) => {
					str = str
						+ `    Activity ${idx + 1}:\r\n`
						+ `		   Name: ${activity.name}\r\n`
						+ `		   Details: ${activity.details ?? "None"}\r\n`
						+ `		   Started at: ${dateAndTime(activity.createdAt, chosen_options.time_locale)}\r\n`
						+ `		   Type: ${activity.type}\r\n`
						+ `		   State: ${activity.state ?? "None"}\r\n`
						+ `		   Emoji: ${activity.emoji?.toString() ?? "None"}\r\n`
						+ `		   URL: ${activity.url ?? "None"}\r\n`
				})

			str = str
				+ `Roles: ${member.roles.cache.size}\r\n`

			// store role info, use custom idx because foreach gives snowflake as key
			let role_idx = 0
			member.roles.cache.forEach(role => {
				role_idx++;
				str = str
					+ `    Role ${role_idx}:\r\n`
					+ `		   Name: ${role.name}\r\n`
					+ `		   Hex Color: ${role.hexColor}\r\n`
					+ `		   ID: ${role.id}\r\n`
			})
			
			str = str
				+ `Voice State: ${member.voice.serverMute ? "Server-muted" : "Not server-muted"}, ${member.voice.serverDeaf ? "Server-deafened" : "cot server-deafened"}, and camera ${member.voice.selfVideo ? "enabled" : "disabled"}\r\n`
				+ `\r\n`
				+ `\r\n`

			// incase member image saving is set, save them to a subfolder
			if (doSaveImgs == "y" || doSaveImgs == "f") {
				let userfolder = imagefolder.folder(member.user.tag);
				let size = doSaveImgs == "f" ? 4096 : 128;
				user = await user.fetch()

				// check if guild and user icons/banners are the same, to decide whether to save both or not
				let uicon = member.user.avatarURL({format: "png", size})
				let ubanner = member.user.bannerURL({format: "png", size})
				let gicon = member.displayAvatarURL({format: "png", size})
				// no guild banner, i assume it doesn't exist and i misremembered discord features

				if (uicon) userfolder.file("icon.png", getLinkData(uicon))
				if (ubanner) userfolder.file("banner.png", getLinkData(ubanner))
				if (uicon != gicon) userfolder.file("icon_this_guild.png", getLinkData(gicon))
			}
		}

		logs.log("[Member backup end]")
		console.log()
		svinfo.file("members.txt", str)
		console.log("Saved members!")
		logs.log("[Member backup save]")
	}

	// save role data
	if (chosen_options.save_roles) {
		logs.log("[Role backup start]")
		console.log("Saving role data...")
		svinfo = svinfo ?? zip.folder("server");

		let roles = await guild.roles.fetch()
		let str = `List of ${roles.size} roles:\r\n\r\n`
		let role_idx = 0;

		for (var role of roles) {
			role_idx++;
			role = role[1]

			logs.log(`Backing up ${role.name}`)

			str = str
				+ `Role ${role_idx}:\r\n`
				+ `    Position: ${role.position}\r\n`
				+ `    Displays separately: ${role.hoist ? "Yes" : "No"}\r\n`
				+ `    Name: ${role.name}\r\n`
				+ `    Hex Color: ${role.hexColor}\r\n`
				+ `    ID: ${role.id}\r\n`

			let perms = [];
			permissionBitLookup.forEach(value => {
				if (role.permissions.has(value)) perms.push("		" + value);
			})

			if (perms.length) str += ` Permissions:\r\n${perms.join("\r\n")}`

			// space before another role
			str += "\r\n\r\n"
		}

		logs.log("[Role backup end]")
		svinfo.file("roles.txt", str)
		console.log("Saved role data!")
		logs.log("[Role backup save]")
	}

	ban_save: if (chosen_options.save_bans) {
		logs.log("[Ban backup start]")
		console.log("Saving ban data...")
		svinfo = svinfo ?? zip.folder("server");

		let bans;
		try {
			bans = await guild.bans.fetch()
		}
		catch (e) {
			console.log("Couldn't save bans, you probably don't have access to view them!")
			console.log("Error stack trace: " + e)
			logs.error("Failed to backup bans")
			logs.error(e)
			break ban_save;
		}

		let str = `List of ${bans.length} bans:\r\n\r\n`
		let ban_idx = 0;

		for (var ban of bans) {
			ban_idx++;
			
			str = str
				+ `Ban ${ban_idx}:\r\n`
				+ `    User: ${ban.user?.tag ?? "Unknown tag"} (id ${ban.user?.id ?? "Unknown ID"})\r\n`
				+ `    Reason: ${ban.reason ?? "None provided (possibly unknown)"}\r\n`

			let perms = [];
			permissionBitLookup.forEach(value => {
				if (role.permissions.has(value)) perms.push("		" + value);
			})

			if (perms.length) str += ` Permissions:\r\n${perms.join("\r\n")}`

			// space before another role
			str += "\r\n\r\n"
		}

		logs.log("[Ban backup end]")
		svinfo.file("bans.txt")
		console.log("Saved ban data!")
		logs.log("[Ban backup save]")
	}

	// generate jszip category folders for all of the categories' channels to be put in
	let chinfo;
	let categories;

	if (selectedChannels.length) {
		chinfo = chinfo ?? zip.folder("channels");
		categories = {};

		selectedChannels.forEach(channel => {
			let parent = channel.parent?.name ?? "no category"
			if (!categories[parent])
				categories[parent] = chinfo.folder(clean4FS(parent));
		})
	}
	
	// for member message counts
	let mem_messages = {}

	// channel backup
	if (selectedChannels.length) {
		logs.log("[Channel backup start]")
		console.log("Backing up channels...")
		svinfo = svinfo ?? zip.folder("server");

		let key = -1
		for (var channel of selectedChannels) {
			logs.log(`[Channel #${channel.name} backup start]`)
			key++;
			console.log(`Channel ${key + 1} (#${channel.name}):`)

			let parent = channel.parent?.name ?? "no category"
			let myfolder = categories[parent].folder(clean4FS(channel.name + " (" + channel.id + ")"))
			let c_messages = 0;
			let c_bytes = 0;
			let c_lines = 0;
			let currentchunk = 0;
			let options = {
				limit: 100
			};
			let latesttxt = false;

			// save channel info
			let ch_str = `Info for channel #${channel.name}:\r\n`
				+ `Category: ${parent}\r\n`
				+ `ID: ${channel.id}\r\n`
				+ `Type: ${channel.type}\r\n`
				+ `Position: ${channel.position} (raw: ${channel.rawPosition})\r\n`
				+ `Created on ${dateToLocaleString(channel.createdAt, chosen_options.time_locale)} at ${timeToLocaleString(channel.createdAt, chosen_options.time_locale)} (locale: ${chosen_options.time_locale})\r\n`
				+ `Auto thread archive time: ${channel?.defaultAutoArchiveDuration ?? "Unknown"}\r\n`
			
			switch (channel.type) {
				case "GUILD_TEXT":
					case "DM":
						case "GUILD_NEWS":
							case "GUILD_NEWS":
								ch_str += `Topic: ${channel?.topic ?? "[Unknown]"}\r\n`
									+ `Slowmode Time: ${channel.rateLimitPerUser} second(s)\r\n`
				break;
				case "GUILD_VOICE":
					case "GUILD_STAGE_VOICE":
						ch_str += `Bitrate: ${channel.bitrate}\r\n`
							+ `RTC Region: ${channel?.rtcRegion ?? "Auto"}\r\n`
							+ `Video Quality Mode: ${channel?.videoQualityMode ?? "Unknown"}\r\n`
							+ `User Limit: ${channel.userLimit}\r\n`
				break;
			}

			myfolder.file("info.txt", ch_str)
			logs.log(`[Saved channel info]`)

			let total_str = ""
			let fails = 0
			while (true) {
				let channel = selectedChannels[key];
				
				logs.log(`[Channel #${channel.name} message backup start]`)
				let messages = await channel.messages.fetch(options).catch(async err => {
					fails++;

					logs.error("Failed to save messages, attempt " + fails)
					logs.error(err)
					process.stdout.write("Failed to save messages, retrying... " + fails + " (err: " + err + ")      \r")

					if (fails > 10) {
						total_str += "Couldn't save messages (or any more messages): " + err + "\r\n"
						console.log("\n[ERR] Failed to back up " + channel.name + "! Error message: ", err)
						logs.error("[ERR] Failed to back up " + channel.name + ", error message: ")
						logs.error(err)
						fails = 0
					}
					else {
						return "retry";
					}

					myfolder.file("messages.txt", total_str)
					await sleep(chosen_options.interval * 1000)
					return "fail"
				})

				if (messages == "retry") continue;
				if (messages == "fail") break;
				let this_str = ""

				// turn into an array and reverse so that the last element is the latest message, and the first is the oldest
				// so that we can keep adding new messages to the start of the file
				messages = messages.map(msg => msg).reverse()
				if (messages.length > 0 && !latesttxt) {
					this_str += `[Latest message ID: ${messages[messages.length - 1].id}]\r\n`
					latesttxt = true
				}
				else if (messages.length == 0) this_str += `[No messages in this channel!]\r\n`

				

				for (var msg of messages) {
					let time = msg.createdAt
					let timechunk = time.getUTCDate() + time.getUTCMonth() + time.getUTCFullYear()

					// i use "time chunks" so that i can separate chat messages based on days 
					if (timechunk != currentchunk) {
						this_str += `\r\n-- [${dateToLocaleString(time, chosen_options.time_locale)}] --\r\n`
						currentchunk = timechunk; // sync back up
					}
					
					if (chosen_options["save_member_message_count"])
						mem_messages[msg.author.id] = (mem_messages[msg.author.id] ?? 0) + 1;

					// extract and concatenate attachments
					let att_text = ""
					let attachments = []
					msg.attachments.forEach(att => attachments.push("	" + att.url))
					let att_count = attachments.length

					if (attachments.length) {
						att_text = ` + [${attachments.length} attachments]:\r\n`;
						attachments = attachments.join("\r\n") + "\r\n"
					} else attachments = "";

					// compose this message
					let final_text = "[if you see this something went wrong] " + msg.type + " - " + msg.author.tag + " - " + msg.content + "\r\n";
					let msg_reply = "";
					let time_string = `[${timeToLocaleString(time, chosen_options.time_locale)}]`

					// fetch the message this one replies to (if it replies to any at all)
					
					let refmsg = false
					if (msg.reference) {
						try {
							let msgreply = await channel.messages.fetch(msg.reference.messageId)
							refmsg = msgreply
							msg_reply = " replied to " + msgreply.author.tag
						} 
						catch (e) 
						{
							msg_reply = " replied to a deleted message"
							logs.error(`[WARN] Failed to fetch message for reference id ${msg.reference.messageId}: ${e}`)
						}
					}

					// usual message
					switch (msg?.type) {
						case "DEFAULT":
						case "REPLY": // my code from v12 already handles message references, so i think it'll be fine if i just make the case fallthrough
							if (msg.content.length)
								final_text = `${time_string} ${msg.author.tag}${msg_reply}: ${msg.content}\r\n${att_text}${attachments}`
							else if (att_count) // message without text with attachments
								final_text = `${time_string} ${msg.author.tag}${msg_reply} sent ${att_count} attachments:\r\n${attachments}`
							else { // probably a sticker
								let stickers = msg.stickers.map(s => s)
								let strick = ""
								for (let i of stickers) strick += " [" + i.name + "]"
								final_text = `${time_string} ${msg.author.tag}${msg_reply} sent sticker:${strick}\r\n`
							}
						break;
						case "CHANNEL_PINNED_MESSAGE":
							let msgtxt = refmsg ? `a message by ${refmsg.author.tag}. (content: ${msg.content.substr(0, 32) + msg.content.length > 32 ? "..." : ""})` : "a message that was deleted."
							final_text = `${time_string} ${msg.author.tag} pinned ${refmsg}\r\n`
						case "RECIPIENT_ADD":
							final_text = `${time_string} ${msg.author.tag} added a member!\r\n`
						break;
						case "RECIPIENT_REMOVE":
							final_text = `${time_string} ${msg.author.tag} removed a member!\r\n`
						break;
						case "CALL":
							final_text = `${time_string} ${msg.author.tag} started a call!\r\n`
						break;
						case "CHANNEL_NAME_CHANGE":
							final_text = `${time_string} ${msg.author.tag} changed the channel name!\r\n`
						break;
						case "CHANNEL_ICON_CHANGE":
							final_text = `${time_string} ${msg.author.tag} changed the channel icon!\r\n`
						break;
						case "PINS_ADD":
							final_text = `${time_string} ${msg.author.tag} pinned a message!\r\n`
						break;
						case "GUILD_MEMBER_JOIN":
							final_text = `${time_string} ${msg.author.tag} joined!\r\n`
						break;
						case "USER_PREMIUM_GUILD_SUBSCRIPTION":
							final_text = `${time_string} ${msg.author.tag} boosted this server!\r\n`
						break;
						case "USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_1":
							final_text = `${time_string} This server has reached Tier 1!\r\n`
						break;
						case "USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_2":
							final_text = `${time_string} This server has reached Tier 2!\r\n`
						break;
						case "USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_3":
							final_text = `${time_string} This server has reached Tier 3!\r\n`
						break;
						case "GUILD_DISCOVERY_DISQUALIFIED":
							final_text = `${time_string} This guild has been disqualified from Guild Discovery!\r\n`
						break;
						case "GUILD_DISCOVERY_REQUALIFIED":
							final_text = `${time_string} This guild has been requalified for Guild Discovery!\r\n`
						break;
						case "THREAD_CREATED":
							final_text = `${time_string} ${msg.author.tag} created a thread: ${msg.content}\r\n`
						break;
						case "APPLICATION_COMMAND":
							final_text = `${time_string} A command for the bot ${msg.author.tag} was ran! ${msg.author.tag} responded with: ${msg.content}\r\n`
						break;
						default:
							logs.error("Error: Unimplemented message type")
							logs.error(msg)
							logs.error(final_text)
						break;
					}
					
					this_str += final_text
					c_messages++;
				}

				c_bytes += this_str.length;
				c_lines += this_str.split("\r\n").length
				process.stdout.write(`    ${c_bytes} bytes  |	${c_lines} lines  |  ${c_messages} msgs    \r`)
				logs.log(`    ${c_bytes} bytes  |	${c_lines} lines  |  ${c_messages} msgs    \r`)

				// add the chunk of text at the start
				total_str = this_str + total_str;

				if (messages.length < 100) {
					console.log(`\nChannel ${key + 1} complete, saved ${c_bytes} bytes, ${c_lines} lines and ${c_messages} messages`)
					logs.log(`Channel ${key + 1} complete, saved ${c_bytes} bytes, ${c_lines} lines and ${c_messages} messages`)
					myfolder.file("messages.txt", total_str)
					await sleep(chosen_options.interval * 1000)
					break;
				}

				// set messages "cursor" to the oldest message
				if (messages.length) options.before = messages.shift().id;
				await sleep(chosen_options.interval * 1000)
			}

			logs.log("[Channel backup end]")
		}
		
		if (chosen_options["save_member_message_count"]) {
			let str = ""
			let arr = []
			
			// arrayify our object
			for (var id in mem_messages) {
				arr.push([id, mem_messages[id]])
			}
			
			// sort
			arr.sort((a, b) => {
				return b[1] - a[1]
			})
			
			for (let num = 0; num < arr.length; num++) {
				let kv = arr[num]
				let member;
				try {
					member = await selectedGuild.members.fetch(kv[0])
				} catch {continue}
				if (!member) continue;
				
				str += `(ID ${kv[0]}) - ${member.user.tag}: ${kv[1]} message(s)\r\n`
			}
			
			svinfo.file("message_counts.txt", str)
			console.log("Saved member message counts!")
			logs.log("[Saved member message counts]")
		}

		console.log("Finished backing up channels!")
	}

	logs.log("Generating zip")
	let content = await zip.generateAsync({type: "nodebuffer"})
	let fname = clean4FS(getInitials(guild.name))

	try {
		fs.writeFileSync(fname + ".zip", content)
		console.log("Saved to " + fname + ".zip!")
		logs.log("Saved zip to " + fname + ".zip")
	}
	catch (e) {
		console.log("Couldn't write zip, saving as backup.zip instead! (err string: " + e + ")")
		fs.writeFileSync("backup_" + Math.floor(Math.random() * 69420) + ".zip", content)
		logs.error("Failed to save zip to " + fname + ".zip")
		logs.error(e)
	}

	console.log("Finished backing up, thank you for using this tool!")
	logs.log("Process exit")
	process.exit(0)
}
