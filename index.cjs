const {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  Routes,
  REST,
  EmbedBuilder,
  PermissionsBitField
} = require("discord.js");

const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./casino.db");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const RUNES_ICON = "https://i.imgur.com/NKtQxmY.png";
const MAX_BET = 500;
const SALARY_COOLDOWN = 6 * 60 * 60 * 1000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

/* ================= DATABASE ================= */
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    userId TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 1000,
    lastSalary INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    guildId TEXT PRIMARY KEY,
    channelId TEXT
  )`);
});

/* ================= HELPERS ================= */
function getUser(id, cb) {
  db.get("SELECT * FROM users WHERE userId = ?", [id], (err, row) => {
    if (!row) {
      db.run("INSERT INTO users (userId) VALUES (?)", [id], () =>
        getUser(id, cb)
      );
    } else cb(row);
  });
}

function onlyCasinoChannel(guildId, channelId, cb) {
  db.get("SELECT channelId FROM settings WHERE guildId = ?", [guildId], (e, r) => {
    if (!r || r.channelId !== channelId) return;
    cb();
  });
}

/* ================= SLASH COMMANDS ================= */
const commands = [
  new SlashCommandBuilder().setName("اوامر").setDescription("شرح أوامر البوت"),
  new SlashCommandBuilder().setName("رصيد").setDescription("عرض رصيدك"),
  new SlashCommandBuilder().setName("راتب").setDescription("استلام الراتب"),
  new SlashCommandBuilder()
    .setName("تحويل")
    .setDescription("تحويل رونات")
    .addUserOption(o => o.setName("عضو").setDescription("المستلم").setRequired(true))
    .addIntegerOption(o => o.setName("مبلغ").setDescription("المبلغ").setRequired(true)),
  new SlashCommandBuilder()
    .setName("ستيب")
    .setDescription("تحديد شات الكازينو")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("✅ Slash Commands Registered");
})();

/* ================= READY ================= */
client.once("ready", () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);
});

/* ================= SLASH HANDLER ================= */
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  const { commandName, guildId, channelId, user } = i;

  if (commandName === "ستيب") {
    db.run(
      "INSERT OR REPLACE INTO settings (guildId, channelId) VALUES (?, ?)",
      [guildId, channelId]
    );
    return i.reply("✅ تم تحديد هذا الشات للكازينو");
  }

  onlyCasinoChannel(guildId, channelId, () => {
    if (commandName === "رصيد") {
      getUser(user.id, u => {
        i.reply(`💰 رصيدك: **${u.balance} Runes**`);
      });
    }

    if (commandName === "راتب") {
      getUser(user.id, u => {
        const now = Date.now();
        if (now - u.lastSalary < SALARY_COOLDOWN)
          return i.reply("⏳ راتبك مو جاهز");

        db.run(
          "UPDATE users SET balance = balance + 500, lastSalary = ? WHERE userId = ?",
          [now, user.id]
        );
        i.reply("💸 استلمت **500 Runes**");
      });
    }

    if (commandName === "تحويل") {
      const target = i.options.getUser("عضو");
      const amount = i.options.getInteger("مبلغ");

      if (amount <= 0 || amount > MAX_BET)
        return i.reply("❌ مبلغ غير صالح");

      getUser(user.id, u => {
        if (u.balance < amount) return i.reply("❌ رصيدك ما يكفي");

        getUser(target.id, () => {
          db.run("UPDATE users SET balance = balance - ? WHERE userId = ?", [amount, user.id]);
          db.run("UPDATE users SET balance = balance + ? WHERE userId = ?", [amount, target.id]);
          i.reply(`✅ حولت ${amount} Runes لـ ${target.username}`);
        });
      });
    }

    if (commandName === "اوامر") {
      i.reply(
`📜 **أوامر الكازينو**
/رصيد – عرض رصيدك
/راتب – كل 6 ساعات
/تحويل – تحويل رونات
ألعاب:
نرد – روليت – تخمين – حصان
💠 العملة: Runes`
      );
    }
  });
});

/* ================= MESSAGE COMMANDS ================= */
client.on("messageCreate", msg => {
  if (msg.author.bot || !msg.guild) return;

  onlyCasinoChannel(msg.guild.id, msg.channel.id, () => {
    if (msg.content === "رصيد") {
      getUser(msg.author.id, u => {
        msg.reply(`💰 رصيدك: ${u.balance} Runes`);
      });
    }
    if (msg.content === "راتب") {
      getUser(msg.author.id, u => {
        const now = Date.now();
        if (now - u.lastSalary < SALARY_COOLDOWN)
          return msg.reply("⏳ راتبك مو جاهز");

        db.run(
          "UPDATE users SET balance = balance + 500, lastSalary = ? WHERE userId = ?",
          [now, msg.author.id]
        );
        msg.reply("💸 استلمت 500 Runes");
      });
    }
  });
});

client.login(TOKEN);
