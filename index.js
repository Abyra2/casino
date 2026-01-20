const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("./database");
const config = require("./config");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

let announceChannel = null;

// عند دخول عضو
client.on("guildMemberAdd", async (member) => {
  const exists = db.prepare(
    "SELECT * FROM sinless WHERE user_id = ? AND guild_id = ?"
  ).get(member.id, member.guild.id);

  if (exists) return;

  await member.roles.add(config.roleId);

  db.prepare(
    "INSERT INTO sinless VALUES (?, ?, ?)"
  ).run(member.id, member.guild.id, "active");

  if (!announceChannel) return;

  const emoji = config.happyEmojis[Math.floor(Math.random() * config.happyEmojis.length)];

  const embed = new EmbedBuilder()
    .setImage(config.gif)
    .setDescription(`${emoji}\n${member}\n**حصلت على رتبة بلا خطيئة**\nسجل نقي… وسمعة لم تُمس.`);

  announceChannel.send({ embeds: [embed] });
});

// سحب الرتبة (تايم / مخالفة)
async function removeSinless(member) {
  const data = db.prepare(
    "SELECT * FROM sinless WHERE user_id = ? AND guild_id = ? AND status = 'active'"
  ).get(member.id, member.guild.id);

  if (!data) return;

  await member.roles.remove(config.roleId);

  db.prepare(
    "UPDATE sinless SET status = 'removed' WHERE user_id = ? AND guild_id = ?"
  ).run(member.id, member.guild.id);

  if (!announceChannel) return;

  const emoji = config.sadEmojis[Math.floor(Math.random() * config.sadEmojis.length)];

  const embed = new EmbedBuilder()
    .setImage(config.gif)
    .setDescription(`${emoji}\n${member}\n**تم سحب رتبة بلا خطيئة**\nليه ما تحافظ على الوعد؟`);

  announceChannel.send({ embeds: [embed] });
}

// أمر تحديد روم الإعلان
client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  if (i.commandName === "set-announce") {
    if (!i.member.permissions.has(PermissionFlagsBits.Administrator))
      return i.reply({ content: "❌ ما عندك صلاحية", ephemeral: true });

    announceChannel = i.channel;
    i.reply("✅ تم تعيين هذا الروم للإعلانات");
  }
});

client.login(process.env.TOKEN);
