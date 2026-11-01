const http = require('node:http');
const numbering = require('./numbering');
const installNumberRenewal = require('./renew-numbers');
const { Client, GatewayIntentBits, ActivityType, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');

const ENV = process.env;
if (!ENV.DISCORD_TOKEN) { console.error('DISCORD_TOKEN is missing'); process.exit(1); }
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const BANNER = 'https://cdn.discordapp.com/attachments/1374091464123879535/1566496926931750942/Z.png?ex=6ae8c173&is=6ae76ff3&hm=d823165f45fe02f7b30fcb2ded581ac21563dd4f0c4e79fc0f37ef63d2958d52';
const LOGO = 'https://cdn.discordapp.com/attachments/1374091464123879535/1566497126354255922/images.png?ex=6ae8c1a3&is=6ae77023&hm=1c38cc6797053f860fcc866cb471211c2741db9ec59a5dc5b4fbbcb6970b1fe1';
const color = 0x173b63;
const sessions = new Map();
const totals = new Map();
const registered = new Set();
const ephemeral = MessageFlags.Ephemeral;
const uid = i => i.guildId + ':' + i.user.id;
const admin = i => i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || (!!ENV.ADMIN_ROLE_ID && i.member?.roles?.cache?.has(ENV.ADMIN_ROLE_ID));
const fmt = ms => { const m = Math.floor(Math.max(0,ms)/60000); return Math.floor(m/60)+'sa '+m%60+'dk'; };
const embed = (title, desc) => new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color).setFooter({text:'Departman Of Justice • anevrix yapmıştır'}).setTimestamp();
const btn = (id,label,style=ButtonStyle.Primary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const dutyRow = () => new ActionRowBuilder().addComponents(btn('duty:start','Mesai Başlat',ButtonStyle.Success),btn('duty:end','Mesai Bitir',ButtonStyle.Danger),btn('duty:me','Mesaim',ButtonStyle.Secondary));
const appRow = () => new ActionRowBuilder().addComponents(btn('apply:open','Başvuru Yap',ButtonStyle.Primary));
const commandDefinitions = [
 new SlashCommandBuilder().setName('panel').setDescription('Departman panellerini gönderir').addStringOption(o=>o.setName('tür').setDescription('Panel türü').setRequired(true).addChoices({name:'Mesai',value:'mesai'},{name:'Başvuru',value:'basvuru'})).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 new SlashCommandBuilder().setName('mesai').setDescription('Kendi mesai durumun').addUserOption(o=>o.setName('üye').setDescription('Yetkililer başka üyeyi görebilir')),
 new SlashCommandBuilder().setName('numara-yenile').setDescription('DOJ ve USM numaralarını topluca yenile').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 new SlashCommandBuilder().setName('numara-tara').setDescription('DOJ ve USM üyelerine eksik numaraları verir').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 new SlashCommandBuilder().setName('mesai-liste').setDescription('Aktif mesaileri listeler').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
];
async function channel(id) { if (!id) return null; return client.channels.fetch(id).catch(()=>null); }
async function audit(guildId, userId, kind, total, started, ended) {
 const ch=await channel(ENV.DUTY_LOG_CHANNEL_ID);
 if (!ch || !ch.isTextBased() || ch.guildId!==guildId) throw new Error('DUTY_LOG_CHANNEL_ID geçerli bir metin kanalı olmalı');
 await ch.send({content:'DOJ_DUTY '+JSON.stringify({guildId,userId,kind,total,started,ended}),allowedMentions:{parse:[]}});
}
async function loadDuty() {
 const ch=await channel(ENV.DUTY_LOG_CHANNEL_ID); if(!ch || !ch.isTextBased()) {console.warn('DUTY_LOG_CHANNEL_ID not configured');return;}
 let before; const arr=[]; 
 for(let n=0;n<20;n++){const batch=await ch.messages.fetch({limit:100,...(before?{before}:{})});if(!batch.size)break;arr.push(...batch.values());before=batch.last().id;if(batch.size<100)break;}
 for(const msg of arr.reverse()){
  if(msg.author.id!==client.user.id || !msg.content.startsWith('DOJ_DUTY '))continue;
  try{const a=JSON.parse(msg.content.slice(9));const key=a.guildId+':'+a.userId;
   if(a.kind==='start'){sessions.set(key,a.started);}
   else if(a.kind==='end'){sessions.delete(key);totals.set(key,a.total);}
  }catch{}
 }
 console.log('Recovered duty data:',totals.size,'totals,',sessions.size,'active');
}
function showDuty(key) {const start=sessions.get(key);return 'Toplam: **'+fmt((totals.get(key)||0)+(start?Date.now()-start:0))+'**\\nDurum: **'+(start?'Mesaide':'Mesai dışında')+'**'+(start?'\\nBaşlangıç: <t:'+Math.floor(start/1000)+':F>':'');}
const srv=http.createServer((req,res)=>{let ok=client.isReady();res.writeHead((req.url==='/'||req.url==='/health')?(ok?200:503):404,{'Content-Type':'application/json'});res.end(JSON.stringify({service:'Departman Of Justice',connected:ok}));});
srv.listen(Number(ENV.PORT||10000),'0.0.0.0');
client.once('ready',async()=>{
 console.log('DOJ online:',client.user.tag);
 client.user.setPresence({activities:[{name:'anevrix yapmıştır',type:ActivityType.Playing}],status:'online'});
 try{await loadDuty();}catch(e){console.error('Duty load:',e);}
 const target=ENV.GUILD_ID?client.guilds.cache.filter(g=>g.id===ENV.GUILD_ID):client.guilds.cache;
 for(const [id,g] of target){try{await g.commands.set(commandDefinitions.map(c=>c.toJSON()));registered.add(id);console.log('Commands registered:',id);}catch(e){console.error('Command register failed:',id,e.message);}}
});
client.on('guildCreate',async g=>{if(ENV.GUILD_ID && ENV.GUILD_ID!==g.id)return;try{await g.commands.set(commandDefinitions.map(c=>c.toJSON()));}catch(e){console.error(e);}});
client.on('interactionCreate',async i=>{
 if(!i.inGuild())return;
 try{
 if(i.isChatInputCommand()){
  if(i.commandName==='panel'){
   if(!admin(i))return i.reply({content:'Bu komut için Sunucuyu Yönet yetkisi gerekli.',flags:ephemeral});
   const kind=i.options.getString('tür');
   const e=embed(kind==='mesai'?'⚖️ DOJ • Mesai Paneli':'⚖️ DOJ • Başvuru Paneli',kind==='mesai'?'Görev başlangıcını ve bitişini aşağıdan kaydet.':'Departmana katılmak için başvuru formunu doldur.').setImage(BANNER).setThumbnail(LOGO);
   await i.channel.send({embeds:[e],components:[kind==='mesai'?dutyRow():appRow()]});
   return i.reply({content:'Panel gönderildi.',flags:ephemeral});
  }
  if(i.commandName==='mesai'){
   const u=i.options.getUser('üye')||i.user;if(u.id!==i.user.id&&!admin(i))return i.reply({content:'Başkasının mesaisini görüntüleyemezsin.',flags:ephemeral});
   return i.reply({embeds:[embed('Mesai • '+u.username,showDuty(i.guildId+':'+u.id))],flags:ephemeral});
  }
  if(i.commandName==='mesai-liste'){
   if(!admin(i))return i.reply({content:'Yetkin yok.',flags:ephemeral});
   const list=[...sessions.entries()].filter(([k])=>k.startsWith(i.guildId+':')).slice(0,40).map(([k,v])=>'<@'+k.split(':')[1]+'> • '+fmt(Date.now()-v));
   return i.reply({embeds:[embed('Aktif Mesailer',list.join('\\n')||'Aktif mesai yok.')],flags:ephemeral});
  }
 }
 if(i.isButton()){
  if(i.customId==='duty:me')return i.reply({embeds:[embed('Mesai Bilgim',showDuty(uid(i)))],flags:ephemeral});
  if(i.customId==='duty:start'){
   if(sessions.has(uid(i)))return i.reply({content:'Zaten mesaidesin.',flags:ephemeral});
   const now=Date.now();await audit(i.guildId,i.user.id,'start',totals.get(uid(i))||0,now,null);sessions.set(uid(i),now);
   return i.reply({content:'✅ Mesain başladı: <t:'+Math.floor(now/1000)+':F>',flags:ephemeral});
  }
  if(i.customId==='duty:end'){
   const start=sessions.get(uid(i));if(!start)return i.reply({content:'Aktif mesain yok.',flags:ephemeral});
   const now=Date.now();const duration=now-start;const total=(totals.get(uid(i))||0)+duration;
   await audit(i.guildId,i.user.id,'end',total,start,now);sessions.delete(uid(i));totals.set(uid(i),total);
   return i.reply({content:'✅ Mesain bitti. Bu mesai: '+fmt(duration)+' • Toplam: '+fmt(total),flags:ephemeral});
  }
  if(i.customId==='apply:open'){
   const modal=new ModalBuilder().setCustomId('apply:submit').setTitle('DOJ Başvuru Formu');
   modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ic').setLabel('IC Ad Soyad').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('age').setLabel('Yaş').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('why').setLabel('Neden DOJ?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(900)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('experience').setLabel('RP deneyimi').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(900))
   );return i.showModal(modal);
  }
  if(i.customId.startsWith('review:')){
   if(!admin(i))return i.reply({content:'Başvuru değerlendirme yetkin yok.',flags:ephemeral});
   const [,decision,applicant]=i.customId.split(':');
   const modal=new ModalBuilder().setCustomId('decision:'+decision+':'+applicant).setTitle(decision==='accept'?'Başvuru Kabul':'Başvuru Red');
   modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Karar açıklaması').setRequired(true).setStyle(TextInputStyle.Paragraph).setMaxLength(900)));
   return i.showModal(modal);
  }
 }
 if(i.isModalSubmit()){
  if(i.customId==='apply:submit'){
   const ch=await channel(ENV.APPLICATION_CHANNEL_ID);
   if(!ch||!ch.isTextBased()||ch.guildId!==i.guildId)return i.reply({content:'Başvuru kanalı ayarlanmamış. Yetkiliye bildir.',flags:ephemeral});
   const get=k=>i.fields.getTextInputValue(k);
   const e=embed('⚖️ Yeni DOJ Başvurusu','Başvuran: <@'+i.user.id+'>').addFields(
    {name:'IC Ad Soyad',value:get('ic')},{name:'Yaş',value:get('age')},{name:'Neden DOJ?',value:get('why')},{name:'RP deneyimi',value:get('experience')}
   ).setThumbnail(LOGO).setImage(BANNER);
   const row=new ActionRowBuilder().addComponents(btn('review:accept:'+i.user.id,'Kabul Et',ButtonStyle.Success),btn('review:reject:'+i.user.id,'Reddet',ButtonStyle.Danger));
   await ch.send({embeds:[e],components:[row],allowedMentions:{parse:[]}});
   return i.reply({content:'✅ Başvurun yetkililere iletildi.',flags:ephemeral});
  }
  if(i.customId.startsWith('decision:')){
   if(!admin(i))return i.reply({content:'Yetkin yok.',flags:ephemeral});
   const [,decision,applicant]=i.customId.split(':');const reason=i.fields.getTextInputValue('reason');
   const prior=i.message.embeds[0];
   const updated=EmbedBuilder.from(prior).addFields({name:'Karar',value:(decision==='accept'?'✅ Kabul':'❌ Red')+' — <@'+i.user.id+'>\\nAçıklama: '+reason}).setColor(decision==='accept'?0x248a47:0xc03b3b);
   await i.update({embeds:[updated],components:[]});
   try{const user=await client.users.fetch(applicant);await user.send('⚖️ DOJ başvurun '+(decision==='accept'?'kabul edildi.':'reddedildi.')+'\\nAçıklama: '+reason);}catch(e){console.warn('Cannot DM applicant:',e.message);}
   return;
  }
 }
 }catch(e){console.error('Interaction failed:',e);if(i.replied||i.deferred)await i.followUp({content:'İşlem başarısız oldu. Ayarları ve yetkileri kontrol edin.',flags:ephemeral}).catch(()=>{});else await i.reply({content:'İşlem başarısız oldu. Ayarları ve yetkileri kontrol edin.',flags:ephemeral}).catch(()=>{});}
});
client.on('guildMemberAdd',async member=>{
  try{
    const roleId='1426712033428246660';
    if(member.roles.cache.has(roleId))return;
    await member.roles.add(roleId,'Yeni katılan üye: Kayıtsız rolü');
    console.log('Kayıtsız rolü verildi:',member.id);
  }catch(err){console.error('Kayıtsız rolü verilemedi:',member.id,err.message);}
});
numbering.install(client);
installNumberRenewal(client);
client.on('error',e=>console.error('Discord:',e));
client.login(ENV.DISCORD_TOKEN).catch(e=>{console.error('Login failed:',e);process.exit(1);});
process.on('SIGTERM',()=>{client.destroy();srv.close();});
