const {ChannelType,PermissionFlagsBits,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags,ModalBuilder,TextInputBuilder,TextInputStyle} = require('discord.js');
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
const record=c=>metaPrefix+JSON.stringify({number:c.number,owner:c.owner,prosecutor:c.prosecutor,status:c.status,review:c.review,shared:c.shared,lawyer:c.lawyer,lawyerCategory:c.lawyerCategory,prosecutorCategory:c.prosecutorCategory,prosecutorRoom:c.prosecutorRoom,decision:c.decision});
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
 const review=c.review?await guild.channels.fetch(c.review).catch(()=>null):null;
 if(review)await review.setTopic(record(c));
 if(c.prosecutorRoom){const room=await guild.channels.fetch(c.prosecutorRoom).catch(()=>null);if(room)await room.setTopic(record(c));}
 if(c.shared){const room=await guild.channels.fetch(c.shared).catch(()=>null);if(room)await room.setTopic(record(c));}
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
 const c={number,owner:message.author.id,prosecutor:prosecutor.id,status:'pending',review:review.id,shared:null,lawyer:null,prosecutorRoom:null,decision:null};
 await revise(guild,c);
 const actions=new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('case:accept:'+number).setLabel('Dosyayı Kabul Et').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('case:reject:'+number).setLabel('Dosyayı Reddet').setStyle(ButtonStyle.Danger));
 await review.send({content:'Atanan savcı: <@'+prosecutor.id+'>',embeds:[embed('Dosya '+number,fields(message))],components:[actions],allowedMentions:{users:[prosecutor.id]}});
 await message.reply({content:'Belgeniz teslim alındı. **Dosya takip numarası:** '+number+'. İnceleme için savcıya atandı.',allowedMentions:{repliedUser:false}});
}
async function collectEvidence(review, target, prosecutorId, number) {
 const all=[];
 let before;
 for(let n=0;n<5;n++){
  const batch=await review.messages.fetch({limit:100,...(before?{before}:{})});
  if(!batch.size)break;
  all.push(...batch.values());before=batch.last().id;
  if(batch.size<100)break;
 }
 const messages=all.filter(m=>m.author.id===prosecutorId && (m.content||m.attachments.size))
   .sort((x,y)=>x.createdTimestamp-y.createdTimestamp);
 for(const m of messages){
  const text=fields(m);
  const body=text.length>3800?text.slice(0,3800):text;
  await target.send({embeds:[embed('Savcı Belgesi / Beyanı • '+number,body)],allowedMentions:{parse:[]}});
 }
}
async function archiveReview(guild,c) {
 const review=await guild.channels.fetch(c.review).catch(()=>null);
 if(!review)return;
 await review.delete('Karar ve belgeler aktarıldı; inceleme tamamlandı');
 c.review=null;
}
async function personalCategory(guild,kind,id){
 const marker='doj-'+kind+'-'+id;
 await guild.channels.fetch();
 let cat=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&x.name===marker);
 if(cat)return cat;
 return guild.channels.create({name:marker,type:ChannelType.GuildCategory,
  permissionOverwrites:lock(guild,[id]),reason:'Kişiye özel DOJ dosya kategorisi'});
}

async function finalize(i,c,decision,reason) {
 if(c.status!=='pending')return i.reply({content:'Dosya zaten karara bağlanmış.',flags:MessageFlags.Ephemeral});
 const guild=i.guild,review=await guild.channels.fetch(c.review);
 await i.deferReply({flags:MessageFlags.Ephemeral});
 let target=null;
 if(decision==='accept'){
  const shared=await guild.channels.create({
   name:'dosya-'+c.number.toLowerCase(),type:ChannelType.GuildText,parent:CONFIG.active,
   permissionOverwrites:lock(guild,[c.owner,c.prosecutor]),
   topic:'Aktif dosya • '+c.number});
  const lawyerCategory=await personalCategory(guild,'avukat',c.owner);
  const prosecutorCategory=await personalCategory(guild,'savci',c.prosecutor);
  const lawyer=await guild.channels.create({
   name:'avukat-'+c.number.toLowerCase(),type:ChannelType.GuildText,parent:lawyerCategory.id,
   permissionOverwrites:lock(guild,[c.owner]),
   topic:'Belge sunan kişi için özel dosya kanalı • '+c.number});
  const prosecutorRoom=await guild.channels.create({
   name:'savci-'+c.number.toLowerCase(),type:ChannelType.GuildText,parent:prosecutorCategory.id,
   permissionOverwrites:lock(guild,[c.prosecutor]),
   topic:'Savcıya özel çalışma kanalı • '+c.number});
  c.shared=shared.id;c.lawyer=lawyer.id;c.prosecutorRoom=prosecutorRoom.id;c.lawyerCategory=lawyerCategory.id;c.prosecutorCategory=prosecutorCategory.id;
  target=shared;
  await shared.send({embeds:[embed('Aktif Dosya • '+c.number,'**Belge sunan:** <@'+c.owner+'>\n**Atanan savcı:** <@'+c.prosecutor+'>')]});
  await lawyer.send({embeds:[embed('Belge Sunma • '+c.number,'Buraya gönderilen metin ve belgeler ortak dosyaya aktarılır.')]});
  await prosecutorRoom.send({embeds:[embed('Savcı İşlem Kanalı • '+c.number,'Savcı inceleme ve dosya hazırlık işlemleri bu kanalda yürütülür.')]});
 }else{
  target=review;
 }
 c.decision={type:decision,reason,by:i.user.id,at:Date.now()};
 c.status=decision==='accept'?'active':'rejected';
 // Copy the initial filing and prosecutor evidence before closing the review workspace.
 if(target.id!==review.id){
  const messages=await review.messages.fetch({limit:100});
  const original=[...messages.values()].find(m=>m.author.id===i.client.user.id&&m.embeds?.[0]?.title==='Dosya '+c.number);
  if(original)await target.send({embeds:original.embeds});
  await collectEvidence(review,target,c.prosecutor,c.number);
 }
 await target.send({embeds:[embed((decision==='accept'?'Kabul Kararı':'Ret Kararı')+' • '+c.number,
  '**Savcı:** <@'+i.user.id+'>\n**Gerekçe:** '+safe(reason))]});
 await revise(guild,c);
 await archiveReview(guild,c);
 await revise(guild,c);
 await i.editReply(decision==='accept'?'Dosya aktif edildi; onay bekleyen inceleme kanalı kapatıldı.':'Dosya reddedildi; inceleme kanalı kapatıldı.');
}
async function reviewAction(i) {
 const [,decision,number]=i.customId.split(':');
 const c=await currentRecord(i.guild,number);
 if(!c)return i.reply({content:'Dosya bulunamadı.',flags:MessageFlags.Ephemeral});
 if(c.status!=='pending'||i.channelId!==c.review)return i.reply({content:'Bu dosya artık onay beklemiyor.',flags:MessageFlags.Ephemeral});
 if(i.user.id!==c.prosecutor)return i.reply({content:'Kararı yalnızca atanmış savcı verebilir.',flags:MessageFlags.Ephemeral});
 const modal=new ModalBuilder().setCustomId('caseDecision:'+decision+':'+number).setTitle(decision==='accept'?'Dosya Kabul Gerekçesi':'Dosya Ret Gerekçesi');
 modal.addComponents(new ActionRowBuilder().addComponents(
  new TextInputBuilder().setCustomId('reason').setLabel('Karar ve gerekçe metni').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1300)));
 return i.showModal(modal);
}
async function relay(message){
 if(message.author.bot)return;
 const c=[...cases.values()].find(c=>c.status==='active'&&
 (c.lawyer===message.channelId||c.prosecutorRoom===message.channelId));
 if(!c)return;
 const target=await message.guild.channels.fetch(c.shared).catch(()=>null);
 if(!target)return;
 const source=c.lawyer===message.channelId?'Avukat':'Savcı';
 await target.send({embeds:[embed(c.number+' • '+source+' Belge/Beyanı',fields(message))],allowedMentions:{parse:[]}});
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
  if(i.isModalSubmit()&&i.customId.startsWith('caseDecision:')){
   const [,decision,number]=i.customId.split(':');
   (async()=>{const item=await currentRecord(i.guild,number);
    if(!item||item.prosecutor!==i.user.id||item.status!=='pending')return i.reply({content:'Yetki veya dosya durumu uygun değil.',flags:MessageFlags.Ephemeral});
    await serial(()=>finalize(i,item,decision,i.fields.getTextInputValue('reason')));
   })().catch(async e=>{console.error('Dosya karar hatası:',e);if(i.deferred||i.replied)await i.editReply('Karar tamamlanamadı: '+e.message).catch(()=>{});else await i.reply({content:'Karar tamamlanamadı.',flags:MessageFlags.Ephemeral}).catch(()=>{});});
  }
  if(i.isButton()&&i.customId.startsWith('case:'))reviewAction(i).catch(async e=>{
   console.error('Savcı kararı:',e);
   if(i.deferred||i.replied)await i.followUp({content:'İşlem başarısız.',flags:MessageFlags.Ephemeral}).catch(()=>{});
   else await i.reply({content:'İşlem başarısız.',flags:MessageFlags.Ephemeral}).catch(()=>{});
  });
 });
 client.on('interactionCreate',async i=>{
  if(!i.isChatInputCommand()||i.commandName!=='dosya-durum'||!i.inGuild())return;
  try{
   const num=i.options.getString('numara').toUpperCase();
   const status=i.options.getString('durum');
   const item=await currentRecord(i.guild,num);
   if(!item)return i.reply({content:'Dosya bulunamadı.',flags:MessageFlags.Ephemeral});
   if(i.user.id!==item.prosecutor&&!judge(i))return i.reply({content:'Yetkiniz bulunmuyor.',flags:MessageFlags.Ephemeral});
   if(!['active','appeal'].includes(item.status))return i.reply({content:'Dosya bu aşamada taşınamaz.',flags:MessageFlags.Ephemeral});
   const parent=status==='closed'?CONFIG.closed:CONFIG.appeal;
   const main=await i.guild.channels.fetch(item.shared);
   await main.setParent(parent,{lockPermissions:false});
   // Kişiye özel çalışma kanalları kendi kategorilerinde kalır.
   item.status=status;
   await revise(i.guild,item);
   await main.send({embeds:[embed('Dosya durumu • '+num,status==='closed'?'Dosya kapatıldı.':'İtiraz incelemesine gönderildi.')]});
   await i.reply({content:'Dosya durumu güncellendi: '+status,flags:MessageFlags.Ephemeral});
  }catch(e){console.error('Dosya taşıma:',e);if(!i.replied)await i.reply({content:'Dosya durumu güncellenemedi.',flags:MessageFlags.Ephemeral}).catch(()=>{});}
 });
 client.on('guildCreate',g=>setup(g).catch(console.error));
}
module.exports={install,CONFIG};
