import { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } from 'discord.js';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const COIN_IMAGE = 'https://i.imgur.com/NKtQxmY.png';

// قاعدة البيانات
let db;
(async () => {
  db = await open({ filename: './ronz.db', driver: sqlite3.Database });

  await db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    ronz INTEGER,
    lastSalary INTEGER
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS guilds (
    guildId TEXT PRIMARY KEY,
    channelId TEXT
  )`);
})();

// المتجر
const shop = [
  { name: 'VIP', price: 4000 },
  { name: 'زيادة راتب 25%', price: 1500 },
  { name: 'زيادة راتب 50%', price: 2500 },
  { name: 'صندوق كنز', price: 1000 }
];

// ======= التعامل مع الرسائل (كتابة نصية) =======
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const guildData = await db.get('SELECT channelId FROM guilds WHERE guildId = ?', message.guild.id);
  if (!guildData) return;
  if (message.channel.id !== guildData.channelId) return;

  const args = message.content.trim().split(/ +/g);
  const command = args[0].toLowerCase();

  // تسجيل اللاعب
  let user = await db.get('SELECT * FROM users WHERE id = ?', message.author.id);
  if (!user) {
    await db.run('INSERT INTO users (id, ronz, lastSalary) VALUES (?, ?, ?)', message.author.id, 0, 0);
    user = { id: message.author.id, ronz: 0, lastSalary: 0 };
  }

  // ======= أوامر عامة =======
  if (command === 'رصيد') {
    const embed = new EmbedBuilder()
      .setTitle('💎 رصيدك')
      .setDescription(`**${user.ronz} Ronz**`)
      .setColor(0xC9A24D)
      .setThumbnail(COIN_IMAGE);
    return message.reply({ embeds: [embed] });
  }

  if (command === 'راتب') {
    const now = Date.now();
    if (now - user.lastSalary < 6 * 60 * 60 * 1000) return message.reply('⏳ راتبك لم يجهز بعد.');
    const salary = Math.floor(Math.random() * (500 - 150 + 1)) + 150;
    const total = user.ronz + salary;
    await db.run('UPDATE users SET ronz = ?, lastSalary = ? WHERE id = ?', total, now, message.author.id);

    const embed = new EmbedBuilder()
      .setColor(0xC9A24D)
      .setTitle('💰 الراتب')
      .setDescription(`استلمت **${salary} Ronz**\nرصيدك الآن: **${total} Ronz**`)
      .setThumbnail(COIN_IMAGE);

    return message.reply({ embeds: [embed] });
  }

  if (command === 'متجر') {
    const list = shop.map((i, x) => `${x + 1}. ${i.name} — ${i.price} Ronz`).join('\n');
    return message.reply(`🛒 **المتجر**\n${list}\n\nللشراء: شراء [رقم]`);
  }

  if (command === 'شراء') {
    const num = parseInt(args[1]) - 1;
    const item = shop[num];
    if (!item) return message.reply('❌ هذا العنصر غير موجود.');
    if (user.ronz < item.price) return message.reply('❌ رصيدك غير كافي');

    let newRonz = user.ronz - item.price;

    if (item.name === 'صندوق كنز') {
      const reward = Math.floor(Math.random() * (1500 - 50 + 1)) + 50;
      newRonz += reward;
      await db.run('UPDATE users SET ronz = ? WHERE id = ?', newRonz, message.author.id);
      return message.reply(`🎁 فتحت صندوق الكنز وحصلت على **${reward} Ronz**\nرصيدك الآن: ${newRonz} Ronz`);
    }

    await db.run('UPDATE users SET ronz = ? WHERE id = ?', newRonz, message.author.id);
    return message.reply(`✅ اشتريت **${item.name}**\nرصيدك الآن: ${newRonz} Ronz`);
  }

  if (command === 'أوامر') {
    const embed = new EmbedBuilder()
      .setTitle('📜 أوامر بوت الكازينو')
      .setColor(0xC9A24D)
      .setDescription(`
**/ستيب [قناة]** - تحديد الشات (Admin فقط)
**/راتب** أو 'راتب' - الحصول على الراتب كل 6 ساعات
**/رصيد** أو 'رصيد' - معرفة الرصيد
**/متجر** أو 'متجر' - عرض المتجر
**/شراء [رقم]** أو 'شراء [رقم]' - شراء من المتجر
**روليت [المبلغ] [رقم/لون] [خيار]** - لعب روليت
**نرد [المبلغ]** - لعب نرد
**تخمين [المبلغ] [رقم]** - تخمين الرقم
**بوكر [المبلغ]** - لعب بوكر مبسط
**حصان [المبلغ] [رقم الحصان]** - سباق حصان
**سلوت [المبلغ]** - سلوت ماشين
**عجلة [المبلغ]** - عجلة الحظ
      `)
      .setThumbnail(COIN_IMAGE);

    return message.reply({ embeds: [embed] });
  }

  // ======= الألعاب =======
  // نرد
  if (command === 'نرد') {
    let amount = parseInt(args[1]);
    if (amount > 500) return message.reply('❌ الحد الأقصى 500 Ronz');
    if (amount > user.ronz) return message.reply('❌ رصيدك غير كافي');

    const roll = Math.floor(Math.random() * 6) + 1;
    const winnings = roll >= 4 ? amount * 2 : 0;
    const newRonz = user.ronz - amount + winnings;
    await db.run('UPDATE users SET ronz = ? WHERE id = ?', newRonz, message.author.id);

    return message.reply(`🎲 رميت النرد: ${roll}\n${winnings ? `✅ فزت! ${winnings} Ronz` : `❌ خسرت ${amount} Ronz`}\nرصيدك الآن: ${newRonz} Ronz`);
  }

  // روليت
  if (command === 'روليت') {
    let amount = parseInt(args[1]);
    const type = args[2]?.toLowerCase();
    const choice = args[3];

    if (amount > 500) return message.reply('❌ الحد الأقصى 500 Ronz');
    if (amount > user.ronz) return message.reply('❌ رصيدك غير كافي');

    const number = Math.floor(Math.random() * 37);
    const color = (number === 0 ? 'اخضر' : number % 2 === 0 ? 'اسود' : 'احمر');
    let win = false, winnings = 0, newRonz = user.ronz - amount;

    if (type === 'رقم' && parseInt(choice) === number) { win = true; winnings = amount * 35; }
    else if (type === 'لون' && choice.toLowerCase() === color) { win = true; winnings = amount * 2; }

    if (win) newRonz += winnings;
    await db.run('UPDATE users SET ronz = ? WHERE id = ?', newRonz, message.author.id);

    return message.reply(`🎡 الرقم الفائز: ${number} (${color})\n${win ? `✅ فزت! ${winnings} Ronz` : `❌ خسرت ${amount} Ronz`}\nرصيدك الآن: ${newRonz} Ronz`);
  }

  // تخمين
  if (command === 'تخمين') {
    let amount = parseInt(args[1]);
    const guess = parseInt(args[2]);
    if (amount > 500) return message.reply('❌ الحد الأقصى 500 Ronz');
    if (amount > user.ronz) return message.reply('❌ رصيدك غير كافي');

    const number = Math.floor(Math.random() * 10) + 1;
    const winnings = guess === number ? amount * 10 : 0;
    const newRonz = user.ronz - amount + winnings;
    await db.run('UPDATE users SET ronz = ? WHERE id = ?', newRonz, message.author.id);

    return message.reply(`🔢 الرقم الصحيح: ${number}\n${winnings ? `✅ فزت! ${winnings} Ronz` : `❌ خسرت ${amount} Ronz`}\nرصيدك الآن: ${newRonz} Ronz`);
  }

  // بوكر
  if (command === 'بوكر') {
    let amount = parseInt(args[1]);
    if (amount > 500) return message.reply('❌ الحد الأقصى 500 Ronz');
    if (amount > user.ronz) return message.reply('❌ رصيدك غير كافي');

    const cards = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const playerCard = cards[Math.floor(Math.random() * cards.length)];
    const botCard = cards[Math.floor(Math.random() * cards.length)];

    const winnings = cards.indexOf(playerCard) > cards.indexOf(botCard) ? amount * 3 : 0;
    const newRonz = user.ronz - amount + winnings;
    await db.run('UPDATE users SET ronz = ? WHERE id = ?', newRonz, message.author.id);

    return message.reply(`🃏 ورقتك: ${playerCard}\n🃏 ورقة البوت: ${botCard}\n${winnings ? `✅ فزت! ${winnings} Ronz` : `❌ خسرت ${amount} Ronz`}\nرصيدك الآن: ${newRonz} Ronz`);
  }

  // حصان
  if (command === 'حصان') {
    let amount = parseInt(args[1]);
    const pick = parseInt(args[2]) - 1;
    if (amount > 500) return message.reply('❌ الحد الأقصى 500 Ronz');
    if (amount > user.ronz) return message.reply('❌ رصيدك غير كافي');

    const horses = ['حصان1','حصان2','حصان3','حصان4'];
    const winner = Math.floor(Math.random() * horses.length);
    const winnings = pick === winner ? amount * 5 : 0;
    const newRonz = user.ronz - amount + winnings;
    await db.run('UPDATE users SET ronz = ? WHERE id = ?', newRonz, message.author.id);

    return message.reply(`🏇 الحصان الفائز: ${horses[winner]}\n${winnings ? `✅ فزت! ${winnings} Ronz` : `❌ خسرت ${amount} Ronz`}\nرصيدك الآن: ${newRonz} Ronz`);
  }

  // سلوت ماشين
  if (command === 'سلوت') {
    let amount = parseInt(args[1]);
    if (!amount || amount > 500) return message.reply('❌ الحد الأقصى 500 Ronz');
    if (amount > user.ronz) return message.reply('❌ رصيدك غير كافي');

    const symbols = ['🍒','🍋','🔔','🍉','⭐','💎'];
    const reel = [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
    ];

    let multiplier = 0;
    if (reel[0] === reel[1] && reel[1] === reel[2]) multiplier = 10;
    else if (reel[0] === reel[1] || reel[1] === reel[2] || reel[0] === reel[2]) multiplier = 2;
    else multiplier = 0;

    const winnings = amount * multiplier;
    const newRonz = user.ronz - amount + winnings;
    await db.run('UPDATE users SET ronz = ? WHERE id = ?', newRonz, message.author.id);

    const embed = new EmbedBuilder()
        .setTitle('🎰 سلوت ماشين')
        .setColor(0xC9A24D)
        .setDescription(`${reel.join(' | ')}\n${winnings ? `✅ فزت! حصلت على ${winnings} Ronz` : `❌ خسرت ${amount} Ronz`}\nرصيدك الآن: ${newRonz} Ronz`)
        .setThumbnail(COIN_IMAGE);

    return message.reply({ embeds: [embed] });
  }

  // عجلة الحظ
  if (command === 'عجلة') {
    let amount = parseInt(args[1]);
    if (!amount || amount > 500) return message.reply('❌ الحد الأقصى 500 Ronz');
    if (amount > user.ronz) return message.reply('❌ رصيدك غير كافي');

    const wheel = [
        {name: '💰 2×', multiplier: 2},
        {name: '💎 3×', multiplier: 3},
        {name: '⭐ 5×', multiplier: 5},
        {name: '🍀 1×', multiplier: 1},
        {name: '💣 خسارة', multiplier: 0},
        {name: '🎁 صندوق', multiplier: 0}
    ];

    const spin = wheel[Math.floor(Math.random() * wheel.length)];
    let winnings = spin.multiplier * amount;
    let newRonz = user.ronz - amount + winnings;

    if (spin.name === '🎁 صندوق') {
        const reward = Math.floor(Math.random() * (1500 - 50 + 1)) + 50;
        newRonz = user.ronz - amount + reward;
        await db.run('UPDATE users SET ronz = ? WHERE id = ?', newRonz, message.author.id);
        return message.reply(`🎁 حصلت على صندوق كنز! ربحك: ${reward} Ronz\nرصيدك الآن: ${newRonz} Ronz`);
    }

    await db.run('UPDATE users SET ronz = ? WHERE id = ?', newRonz, message.author.id);

    const embed = new EmbedBuilder()
        .setTitle('🎡 عجلة الحظ')
        .setColor(0xC9A24D)
        .setDescription(`${spin.name}\n${winnings ? `✅ فزت! حصلت على ${winnings} Ronz` : `❌ خسرت ${amount} Ronz`}\nرصيدك الآن: ${newRonz} Ronz`)
        .setThumbnail(COIN_IMAGE);

    return message.reply({ embeds: [embed] });
  }

});

client.once('ready', () => {
  console.log(`✅ Bot Ready: ${client.user.tag}`);
});

client.login(process.env.TOKEN);
