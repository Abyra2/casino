const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('set-announce')
    .setDescription('تحديد روم الإعلان للرتب')
    .setDefaultMemberPermissions(0)
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('⚡️ تسجيل أوامر السلاش على السيرفر...');
    await rest.put(
      Routes.applicationGuildCommands('BOT_ID', 'GUILD_ID'), // حط ID البوت وID السيرفر
      { body: commands }
    );
    console.log('✅ تم تسجيل أوامر السلاش على السيرفر!');
  } catch (err) {
    console.error(err);
  }
})();
