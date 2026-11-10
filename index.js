const http = require('node:http');
const numbering = require('./numbering');
const caseArchive = require('./case-archive-v2');
const unitDuty = require('./duty-units');
const documentChannels = require('./document-channels');
const installNumberRenewal = require('./renew-numbers');
const { Client, GatewayIntentBits, ActivityType, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');

const ENV = process.env;
const DUTY_LOG_CHANNEL_ID = '1566542232419307720';
if (!ENV.DISCORD_TOKEN) { console.error('DISCORD_TOKEN is missing'); process.exit(1); }
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const BANNER = 'https://cdn.discordapp.com/attachments/1374091464123879535/1566496926931750942/Z.png?ex=6ae8c173&is=6ae76ff3&hm=d823165f45fe02f7b30fcb2ded581ac21563dd4f0c4e79fc0f37ef63d2958d52';
const LOGO = 'https://cdn.discordapp.com/attachments/1374091464123879535/1566497126354255922/images.png?ex=6ae8c1a3&is=6ae77023&hm=1c38cc6797053f860fcc866cb471211c2741db9ec59a5dc5b4fbbcb6970b1fe1';
const color = 0x173b63;
// 10 Kasım anma durumu: Türkiye saatine göre yalnızca 10 Kasım 2026'da gösterilir.
const regularPresence = {activities:[{name:'anevrix yapmıştır',type:ActivityType.Playing}],status:'online'};
const remembrancePresence = {activities:[{name:'🇹🇷 10 Kasım | Saygı, Minnet ve Özlemle ♾️',type:ActivityType.Playing}],status:'online'};
function applyRemembrancePresence(){
 if(!client.isReady())return;
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const remembering=day==='2026-11-10';
 client.user.setPresence(remembering?remembrancePresence:regularPresence);
}

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
 new SlashCommandBuilder().setName('mesai').setDescription('DOJ / USM mesai bilgisi').addUserOption(o=>o.setName('uye').setDescription('Personel')),
 new SlashCommandBuilder().setName('mesai-duzenle').setDescription('Personelin mesai süresini dakika olarak artır/azalt').addUserOption(o=>o.setName('uye').setDescription('Personel').setRequired(true)).addStringOption(o=>o.setName('kurum').setDescription('Kurum').setRequired(true).addChoices({name:'DOJ',value:'DOJ'},{name:'USM',value:'USM'})).addIntegerOption(o=>o.setName('dakika').setDescription('Pozitif ekle, negatif çıkar').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 new SlashCommandBuilder().setName('mesai-sonlandir').setDescription('Aktif mesaiyi yönetici olarak bitir').addUserOption(o=>o.setName('uye').setDescription('Personel').setRequired(true)).addStringOption(o=>o.setName('kurum').setDescription('Kurum').setRequired(true).addChoices({name:'DOJ',value:'DOJ'},{name:'USM',value:'USM'})).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 new SlashCommandBuilder().setName('mesai-sifirla').setDescription('Personelin veya kurumun mesaisini sıfırla').addStringOption(o=>o.setName('kurum').setDescription('Kurum').setRequired(true).addChoices({name:'DOJ',value:'DOJ'},{name:'USM',value:'USM'})).addUserOption(o=>o.setName('uye').setDescription('Personel (tüm değilse)')).addBooleanOption(o=>o.setName('tum').setDescription('Kurumdaki herkes')).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 new SlashCommandBuilder().setName('reddi-hakim').setDescription('Dosyaya mevcut hakimden farklı yeni hakim ata').addStringOption(o=>o.setName('dosya').setDescription('Dosya numarası').setRequired(true)).addStringOption(o=>o.setName('gerekce').setDescription('Gerekçe veya belge')).addAttachmentOption(o=>o.setName('belge').setDescription('Gerekçe yerine belge')),
 new SlashCommandBuilder().setName('dosya-kapat').setDescription('Karar belgesiyle dosyayı kapat').addStringOption(o=>o.setName('dosya').setDescription('Dosya numarası').setRequired(true)).addStringOption(o=>o.setName('gerekce').setDescription('Kapatma gerekçesi (belge yerine yazılabilir)')).addAttachmentOption(o=>o.setName('belge').setDescription('Karar veya kapatma belgesi (gerekçe yerine)')),
 new SlashCommandBuilder().setName('itiraz').setDescription('İtiraz dilekçesiyle dosyayı itiraza gönder').addStringOption(o=>o.setName('dosya').setDescription('Dosya numarası').setRequired(true)).addStringOption(o=>o.setName('gerekce').setDescription('İtiraz gerekçesi (belge yerine yazılabilir)')).addAttachmentOption(o=>o.setName('belge').setDescription('İtiraz dilekçesi / belge (gerekçe yerine)')),
 new SlashCommandBuilder().setName('dosya-ekle').setDescription('Sicil numarası ile dosyaya personel ekle').addStringOption(o=>o.setName('dosya').setDescription('Dosya numarası').setRequired(true)).addStringOption(o=>o.setName('sicil').setDescription('Kişinin # sonrası sicil/rozet numarası').setRequired(true)).addStringOption(o=>o.setName('yetki').setDescription('Dosyaya erişim yetkisi').setRequired(true).addChoices({name:'Salt okunur',value:'goruntule'},{name:'Belge ve metin ekleyebilir',value:'duzenle'})),
 new SlashCommandBuilder().setName('belge-sun').setDescription('Belge sun: rastgele veya seçilen savcıya ata').addStringOption(o=>o.setName('kaynak').setDescription('Belgenin geldiği kişi veya kurum, örn. LSPD').setRequired(true)).addAttachmentOption(o=>o.setName('belge').setDescription('Sunulacak belge')).addStringOption(o=>o.setName('aciklama').setDescription('Belge veya başvuru açıklaması')).addUserOption(o=>o.setName('savci').setDescription('İsteğe bağlı atanacak savcı')),
 new SlashCommandBuilder().setName('savci-degistir').setDescription('Dosyanın savcısını devret veya devral').addStringOption(o=>o.setName('dosya').setDescription('Dosya numarası veya kısa numara').setRequired(true)).addUserOption(o=>o.setName('yeni-savci').setDescription('Boşsa komutu kullanan savcı devralır')).addStringOption(o=>o.setName('gerekce').setDescription('Devir gerekçesi')),
 new SlashCommandBuilder().setName('dosyaya-belge').setDescription('Mevcut dosyaya kaynak belirterek belge ekle').addStringOption(o=>o.setName('dosya').setDescription('Dosya numarası veya 3 gibi kısa numara').setRequired(true)).addStringOption(o=>o.setName('kaynak').setDescription('Belgenin geldiği kişi/kurum').setRequired(true)).addAttachmentOption(o=>o.setName('belge').setDescription('Dosyaya eklenecek belge')).addStringOption(o=>o.setName('aciklama').setDescription('Belge açıklaması')),
 new SlashCommandBuilder().setName('hakim').setDescription('Dosyaya rastgele hâkim ata').addStringOption(o=>o.setName('dosya').setDescription('Dosya numarası').setRequired(true)),
 new SlashCommandBuilder().setName('kurallar').setDescription('California DOJ ve USM görev ve usul ilkeleri'),
 new SlashCommandBuilder().setName('numara-yenile').setDescription('DOJ ve USM numaralarını topluca yenile').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 new SlashCommandBuilder().setName('numara-tara').setDescription('DOJ ve USM üyelerine eksik numaraları verir').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 new SlashCommandBuilder().setName('mesai-liste').setDescription('Aktif mesaileri listeler').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
];
async function channel(id) { if (!id) return null; return client.channels.fetch(id).catch(()=>null); }
const dutyMessageIds = new Map();
const dutyLocks = new Map();
async function audit(guildId,userId,kind,total,started,ended) {
 const ch=await channel(DUTY_LOG_CHANNEL_ID);
 if(!ch || !ch.isTextBased() || ch.guildId!==guildId)throw new Error('Mesai log kanalı bulunamadı');
 const key=guildId+':'+userId;
 const previous=dutyLocks.get(key)||Promise.resolve();
 const job=previous.catch(()=>{}).then(async()=>{
  const now=Date.now();
  const active=kind==='start';
  const record={guildId,userId,kind,total,started,ended,updatedAt:now};
  const summary=embed('⚖️ Personel Mesai Kaydı',
    '**Personel:** <@'+userId+'>\n'+
    '**Durum:** '+(active?'🟢 Mesaide':'⚪ Mesai tamamlandı')+'\n'+
    '**Toplam mesai:** **'+fmt(total+(active?now-started:0))+'**'+
    (active?'\n**Başlangıç:** <t:'+Math.floor(started/1000)+':F>':
      '\n**Son mesai:** '+fmt(ended-started)+'\n**Bitiş:** <t:'+Math.floor(ended/1000)+':F>'));
  // Create the replacement before deleting the old record to avoid data loss.
  const sent=await ch.send({content:'DOJ_DUTY '+JSON.stringify(record),embeds:[summary],allowedMentions:{parse:[]}});
  const old=dutyMessageIds.get(key);
  dutyMessageIds.set(key,sent.id);
  if(old&&old!==sent.id){
   await ch.messages.delete(old).catch(e=>console.warn('Eski mesai kaydı silinemedi:',e.message));
  }
 });
 dutyLocks.set(key,job);
 try{await job}finally{if(dutyLocks.get(key)===job)dutyLocks.delete(key)}
}
async function loadDuty() {
 const ch=await channel(DUTY_LOG_CHANNEL_ID);
 if(!ch||!ch.isTextBased()){console.warn('Mesai log kanalı bulunamadı');return}
 let before;const arr=[];
 for(let n=0;n<20;n++){
  const batch=await ch.messages.fetch({limit:100,...(before?{before}:{})});
  if(!batch.size)break;
  arr.push(...batch.values());before=batch.last().id;
  if(batch.size<100)break;
 }
 for(const msg of arr.reverse()){
  if(msg.author.id!==client.user.id||!msg.content.startsWith('DOJ_DUTY '))continue;
  try{
   const a=JSON.parse(msg.content.slice(9));
   const key=a.guildId+':'+a.userId;
   if(a.kind==='start'){
    sessions.set(key,a.started);
    if(Number.isFinite(a.total))totals.set(key,a.total);
   }else if(a.kind==='end'){
    sessions.delete(key);
    totals.set(key,a.total);
   }
   dutyMessageIds.set(key,msg.id);
  }catch(e){console.warn('Mesai verisi okunamadı:',e.message)}
 }
 console.log('Mesai kayıtları yüklendi:',totals.size,'toplam,',sessions.size,'aktif');
}
function showDuty(key) {const start=sessions.get(key);return 'Toplam: **'+fmt((totals.get(key)||0)+(start?Date.now()-start:0))+'**\\nDurum: **'+(start?'Mesaide':'Mesai dışında')+'**'+(start?'\\nBaşlangıç: <t:'+Math.floor(start/1000)+':F>':'');}
const srv=http.createServer((req,res)=>{let ok=client.isReady();res.writeHead((req.url==='/'||req.url==='/health')?(ok?200:503):404,{'Content-Type':'application/json'});res.end(JSON.stringify({service:'Departman Of Justice',connected:ok}));});
srv.listen(Number(ENV.PORT||10000),'0.0.0.0');
client.once('ready',async()=>{
 console.log('DOJ online:',client.user.tag);
 applyRemembrancePresence();
 const remembranceTimer=setInterval(applyRemembrancePresence,60*1000);
 remembranceTimer.unref();
 try{/* Legacy duty state replaced by duty-units.js */}catch(e){console.error('Duty load:',e);}
 const target=ENV.GUILD_ID?client.guilds.cache.filter(g=>g.id===ENV.GUILD_ID):client.guilds.cache;
 for(const [id,g] of target){try{await g.commands.set(commandDefinitions.map(c=>c.toJSON()));registered.add(id);console.log('Commands registered:',id);}catch(e){console.error('Command register failed:',id,e.message);}}
});
client.on('guildCreate',async g=>{if(ENV.GUILD_ID && ENV.GUILD_ID!==g.id)return;try{await g.commands.set(commandDefinitions.map(c=>c.toJSON()));}catch(e){console.error(e);}});
client.on('interactionCreate',async i=>{
 if(!i.inGuild())return;
 try{
 if(i.isChatInputCommand()){
  if(i.commandName==='kurallar'){
   const info=embed('⚖️ California • DOJ / USM Usul ve Görev İlkeleri',
    '**Kurumlar:** CA DOJ eyalet hukuk kurumu; USMS federal kolluk; yargıçlar bağımsız mahkeme mensuplarıdır.\n'+
    '**Usul:** Arama, gözaltı, tutuklama ve delil işlemlerinde hukuki dayanak ve işlem kaydı bulunmalı; tarafsızlık ve savunma hakları korunmalıdır.\n'+
    '**Disiplin:** Yetki suistimali, sahte mesai, yetkisiz bilgi kullanımı ve delil uydurmak yasaktır.\n'+
    '**Numaralar:** DOJ ve USM için ayrı kurum içi takip numaraları kullanılır; bunlar resmî devlet kimlikleri değildir.\n'+
    '**Detaylı iç tüzük:** https://github.com/ali121331/Departman-Of-Justice/blob/main/CALIFORNIA_POLICY.md');
   return i.reply({embeds:[info],flags:ephemeral});
  }
  if(i.commandName==='panel'){
   if(!admin(i))return i.reply({content:'Bu komut için Sunucuyu Yönet yetkisi gerekli.',flags:ephemeral});
   const kind=i.options.getString('tür');
   const e=embed(kind==='mesai'?'⚖️ DOJ / USM • Mesai Paneli':'⚖️ DOJ • Başvuru Paneli',kind==='mesai'?'Görev başlangıç ve bitiş işlemlerini bu panelden kaydedin.':'Başvuru formunu eksiksiz doldurun. Görev ve yetkiler kurum bazında değerlendirilir.').setImage(BANNER).setThumbnail(LOGO);
   await i.channel.send({embeds:[e],components:kind==='mesai'?unitDuty.panel():[appRow()]});
   return i.reply({content:'Panel gönderildi.',flags:ephemeral});
  }
  if(false&&i.commandName==='mesai'){
   const u=i.options.getUser('üye')||i.user;if(u.id!==i.user.id&&!admin(i))return i.reply({content:'Başkasının mesaisini görüntüleyemezsin.',flags:ephemeral});
   return i.reply({embeds:[embed('Mesai • '+u.username,showDuty(i.guildId+':'+u.id))],flags:ephemeral});
  }
  if(false&&i.commandName==='mesai-liste'){
   if(!admin(i))return i.reply({content:'Yetkin yok.',flags:ephemeral});
   const list=[...sessions.entries()].filter(([k])=>k.startsWith(i.guildId+':')).slice(0,40).map(([k,v])=>'<@'+k.split(':')[1]+'> • '+fmt(Date.now()-v));
   return i.reply({embeds:[embed('Aktif Mesailer',list.join('\\n')||'Aktif mesai yok.')],flags:ephemeral});
  }
 }
 if(i.isButton()){
  if(false&&i.customId==='duty:me')return i.reply({embeds:[embed('Mesai Bilgim',showDuty(uid(i)))],flags:ephemeral});
  if(false&&i.customId==='duty:start'){
   if(sessions.has(uid(i)))return i.reply({content:'Zaten mesaidesin.',flags:ephemeral});
   const now=Date.now();await audit(i.guildId,i.user.id,'start',totals.get(uid(i))||0,now,null);sessions.set(uid(i),now);
   return i.reply({content:'✅ Mesain başladı: <t:'+Math.floor(now/1000)+':F>',flags:ephemeral});
  }
  if(false&&i.customId==='duty:end'){
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
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('experience').setLabel('İlgili görev deneyimi').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(900))
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
    {name:'IC Ad Soyad',value:get('ic')},{name:'Yaş',value:get('age')},{name:'Neden DOJ?',value:get('why')},{name:'İlgili görev deneyimi',value:get('experience')}
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
caseArchive.install(client);
unitDuty.install(client);
documentChannels.install(client);
installNumberRenewal(client);
client.on('error',e=>console.error('Discord:',e));
client.login(ENV.DISCORD_TOKEN).catch(e=>{console.error('Login failed:',e);process.exit(1);});
process.on('SIGTERM',()=>{client.destroy();srv.close();});
