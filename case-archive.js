const {ChannelType,PermissionFlagsBits,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags} = require('discord.js');
const CONFIG={
 active:'1566531570377039955',
 pending:'1566531861239562432',
 closed:'1566531914595311677',
 appeal:'1566531950183841852',
 intakeCategory:'1566532560589295657',
 prosecutorRole:'1374078438792495145'
};
const metaPrefix='DOJCASE|';
const cases=new Map();
let task=Promise.resolve();
const serial=fn=>{const p=task.catch(()=>{}).then(fn);task=p;return p};
const safe=x=>String(x||'').replace(/[@\r\n]/g,' ').slice(0,1500);
const record=c=>metaPrefix+JSON.stringify({number:c.number,owner:c.owner,prosecutor:c.prosecutor,status:c.status,review:c.review,shared:c.shared,lawyer:c.lawyer});
const judge=i=>i.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
const embed=(title,body)=>new EmbedBuilder().setColor(0x203d67).setTitle(title).setDescription(body).setFooter({text:'Departman Of Justice • Dosya Arşivi'}).setTimestamp();
const lock=(guild,ids)=>[
 {id:guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
 {id:guild.members.me.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels]},
 ...ids.map(id=>({id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles]}))
];
async function setup(guild){
 await guild.channels.fetch();
 for(const channel of guild.channels.cache.values()){
  if(!channel.topic?.startsWith(metaPrefix))continue;
  try{const c=JSON.parse(channel.topic.slice(metaPrefix.length));if(c.number)cases.set(guild.id+':'+c.number,c)}catch{}
 }
 const cat=guild.channels.cache.get(CONFIG.intakeCategory);
 if(!cat||cat.type!==ChannelType.GuildCategory){console.warn('Belge sunma kategorisi bulunamadı:',guild.id);return}
 let intake=guild.channels.cache.find(x=>x.parentId===cat.id&&x.name==='belge-sunma');
 if(!intake){
  intake=await guild.channels.create({name:'belge-sunma',type:ChannelType.GuildText,parent:cat.id,topic:'Belge gönderimi • Ekli dosya veya metin gönderin; savcı incelemesi için kayıt açılır.'});
 }
 console.log('Dosya arşivi hazır:',guild.id,intake.id,'kayıtlar:',cases.size);
}
async function currentRecord(guild,caseNum){
 const k=guild.id+':'+caseNum;let c=cases.get(k);
 if(c)return c;
 await setup(guild);return cases.get(k);
}
function nextNum(){
 const yy=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'2-digit'}).format(new Date());
 let max=0;
 for(const c of cases.values()){
  const m=c.number?.match(new RegExp('^CA-'+yy+'-INT-(\\d{5})$'));
  if(m)max=Math.max(max,Number(m[1]));
 }
 return 'CA-'+yy+'-INT-'+String(max+1).padStart(5,'0');
}
async function revise(guild,c){
 const review=await guild.channels.fetch(c.review);
 if(review)await review.setTopic(record(c));
 cases.set(guild.id+':'+c.number,c);
}
function fields(message){
 const attachments=[...message.attachments.values()].map(a=>'['+safe(a.name)+']('+a.url+')').join('\n');
 return '**Gönderen:** <@'+message.author.id+'>\n**Açıklama:** '+(safe(message.content)||'Ek belge')+'\n**Belgeler:**\n'+(attachments||'Metin beyanı');
}
async function start(message){
 const guild=message.guild;
 const prosecutors=(await guild.members.fetch()).filter(m=>!m.user.bot&&m.roles.cache.has(CONFIG.prosecutorRole));
 if(!prosecutors.size){await message.reply('Şu an atanabilir savcı bulunamadı. Lütfen yönetime bildirin.');return}
 const prosecutor=[...prosecutors.values()][Math.floor(Math.random()*prosecutors.size)];
 const number=nextNum();
 const review=await guild.channels.create({
  name:'inceleme-'+number.toLowerCase(),type:ChannelType.GuildText,parent:CONFIG.pending,
  permissionOverwrites:lock(guild,[prosecutor.id]),reason:'Savcıya özel dosya inceleme'});
 const c={number,owner:message.author.id,prosecutor:prosecutor.id,status:'pending',review:review.id,shared:null,lawyer:null};
 await revise(guild,c);
 const actions=new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('case:accept:'+number).setLabel('Dosyayı Kabul Et').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('case:reject:'+number).setLabel('Dosyayı Reddet').setStyle(ButtonStyle.Danger));
 await review.send({content:'Atanan savcı: <@'+prosecutor.id+'>',embeds:[embed('Dosya '+number,fields(message))],components:[actions],allowedMentions:{users:[prosecutor.id]}});
 await message.reply({content:'Belgeniz teslim alındı. **Dosya takip numarası:** '+number+'. İnceleme için savcıya atandı.',allowedMentions:{repliedUser:false}});
}
async function accept(i,c){
 const guild=i.guild;
 const shared=await guild.channels.create({
  name:'dosya-'+c.number.toLowerCase(),type:ChannelType.GuildText,parent:CONFIG.active,
  permissionOverwrites:lock(guild,[c.owner,c.prosecutor]),
  topic:'Aktif dosya: '+c.number+' • paylaşılan belge ve işlem kayıtları'});
 const lawyer=await guild.channels.create({
  name:'avukat-'+c.number.toLowerCase(),type:ChannelType.GuildText,parent:CONFIG.active,
  permissionOverwrites:lock(guild,[c.owner]),
  topic:'Belge sunan kişinin özel yazışma alanı • '+c.number});
 c.shared=shared.id;c.lawyer=lawyer.id;c.status='active';
 await revise(guild,c);
 await shared.send({embeds:[embed('Aktif Dosya '+c.number,
  '**Başvuru sahibi:** <@'+c.owner+'>\n**Atanan savcı:** <@'+c.prosecutor+'>\nİlgili belgeler ve sonraki yazışmalar bu dosyada takip edilir.')]});
 const msgs=await i.channel.messages.fetch({limit:20});
 const original=[...msgs.values()].find(m=>m.author.id===i.client.user.id&&m.embeds?.[0]?.title==='Dosya '+c.number);
 if(original)await shared.send({embeds:original.embeds});
 await lawyer.send({content:'<@'+c.owner+'>',embeds:[embed('Özel Belge Kanalı • '+c.number,'Bu kanala gönderdiğiniz belgeler ve mesajlar ortak aktif dosya kanalına aktarılır.')],allowedMentions:{users:[c.owner]}});
 await i.update({components:[]});
 await i.followUp({content:'Dosya kabul edildi: <#'+shared.id+'> | Belge sunan kanal: <#'+lawyer.id+'>',flags:MessageFlags.Ephemeral});
}
async function reviewAction(i){
 const [,decision,number]=i.customId.split(':');
 const c=await currentRecord(i.guild,number);
 if(!c)return i.reply({content:'Dosya kaydı bulunamadı.',flags:MessageFlags.Ephemeral});
 if(c.status!=='pending')return i.reply({content:'Bu dosya zaten işleme alınmış.',flags:MessageFlags.Ephemeral});
 if(i.channelId!==c.review || (i.user.id!==c.prosecutor&&!judge(i)))
  return i.reply({content:'Bu dosyayı yalnızca atanan savcı değerlendirebilir.',flags:MessageFlags.Ephemeral});
 if(decision==='accept')return accept(i,c);
 c.status='rejected';await revise(i.guild,c);
 await i.update({components:[]});
 await i.channel.send({embeds:[embed('Dosya Reddedildi • '+number,'Karar veren: <@'+i.user.id+'>')]});
 await i.followUp({content:'Dosya reddedildi.',flags:MessageFlags.Ephemeral});
}
async function relay(message){
 if(message.author.bot)return;
 const c=[...cases.values()].find(c=>c.status==='active'&&c.lawyer===message.channelId);
 if(!c)return;
 const target=await message.guild.channels.fetch(c.shared).catch(()=>null);
 if(!target)return;
 await target.send({embeds:[embed('Dosya '+c.number+' • Yeni Belge/Beyan',fields(message))],allowedMentions:{parse:[]}});
 await message.react('✅').catch(()=>{});
}
function install(client){
 client.once('ready',async()=>{
  for(const guild of client.guilds.cache.values())try{await setup(guild)}catch(e){console.error('Dosya kurulumu:',e)}
 });
 client.on('messageCreate',m=>{
  if(!m.guild||m.author.bot)return;
  serial(async()=>{
   const intake=m.guild.channels.cache.find(x=>x.parentId===CONFIG.intakeCategory&&x.name==='belge-sunma');
   if(m.channelId===intake?.id&&(m.attachments.size||m.content.trim()))await start(m);
   else await relay(m);
  }).catch(e=>console.error('Belge işleme hatası:',e));
 });
 client.on('interactionCreate',i=>{
  if(i.isButton()&&i.customId.startsWith('case:'))reviewAction(i).catch(async e=>{
   console.error('Savcı kararı:',e);
   if(i.deferred||i.replied)await i.followUp({content:'İşlem başarısız.',flags:MessageFlags.Ephemeral}).catch(()=>{});
   else await i.reply({content:'İşlem başarısız.',flags:MessageFlags.Ephemeral}).catch(()=>{});
  });
 });
 client.on('guildCreate',g=>setup(g).catch(console.error));
}
module.exports={install,CONFIG};
