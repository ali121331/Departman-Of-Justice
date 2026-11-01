const {ChannelType,PermissionFlagsBits: P,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags}=require('discord.js');
const C={active:'1566555227522474146',pending:'1566531861239562432',closed:'1566531914595311677',appeal:'1566531950183841852',intake:'1566532560589295657',prosecutor:'1374078438792495145'};
const tag='DOJCASE|', db=new Map(), busy=new Set();
const key=(g,n)=>g.id+':'+n;
const esc=t=>String(t||'').replace(/@/g,'＠').slice(0,1600);
const card=(title,body)=>new EmbedBuilder().setColor(0x20446b).setTitle(title).setDescription(body).setTimestamp();
function data(c){return tag+JSON.stringify(c)}
function parse(ch){if(!ch.topic?.startsWith(tag))return null;try{return JSON.parse(ch.topic.slice(tag.length))}catch{return null}}
function perms(g,member,edit=true){return [{id:g.roles.everyone.id,deny:[P.ViewChannel]},{id:g.members.me.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.ManageChannels,P.AttachFiles]},{id:member,allow:edit?[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.AttachFiles]:[P.ViewChannel,P.ReadMessageHistory],...(edit?{}:{deny:[P.SendMessages,P.AttachFiles]})}]}
const digits=m=>(m.nickname||'').match(/#(\d{5,6})$/)?.[1];
function currentYear(){return new Intl.DateTimeFormat('en',{year:'2-digit',timeZone:'America/Los_Angeles'}).format(new Date())}
function next(g){
 const prefix='CA-'+currentYear()+'-INT-';let max=0;
 for(const [k,c] of db)if(k.startsWith(g.id+':')&&c.number.startsWith(prefix))max=Math.max(max,Number(c.number.slice(prefix.length))||0);
 return prefix+String(max+1).padStart(5,'0');
}
async function scan(g){
 await g.channels.fetch();
 for(const ch of g.channels.cache.values()){
  const c=parse(ch);if(!c?.number)continue;
  const k=key(g,c.number),old=db.get(k);
  // Prefer the canonical shared or decision channel over old review copies.
  if(!old||ch.id===c.shared||(!old.shared&&ch.id===c.review))db.set(k,c);
 }
}
async function category(g,kind,id){
 const name='doj-'+kind+'-'+id;
 await g.channels.fetch();
 let found=g.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&x.name===name);
 if(found)return found;
 return g.channels.create({name,type:ChannelType.GuildCategory,permissionOverwrites:perms(g,id),reason:'DOJ özel dosya kategorisi'});
}
async function room(g,c,person,kind,edit=true){
 const cat=await category(g,kind,person);
 const ch=await g.channels.create({name:kind+'-'+c.number.toLowerCase(),type:ChannelType.GuildText,parent:cat.id,permissionOverwrites:perms(g,person,edit),topic:'Dosya '+c.number});
 await ch.send({embeds:[card('Dosya • '+c.number,'Bu alandaki mesajlar ilgili dosyanın savcı arşivine aktarılır. Yetki: '+(edit?'Mesaj yazabilir':'Salt okunur'))]});
 return ch;
}
async function save(g,c){
 db.set(key(g,c.number),c);
 const main=c.shared?await g.channels.fetch(c.shared).catch(()=>null):null;
 const review=c.review?await g.channels.fetch(c.review).catch(()=>null):null;
 const canonical=main||review;
 if(!canonical)throw Error('Kalıcı dosya kayıt kanalı bulunamadı');
 await canonical.setTopic(data(c));
}
function statement(m){const attachments=[...m.attachments.values()].map(a=>'['+esc(a.name)+']('+a.url+')').join('\n');return '**Gönderen:** <@'+m.author.id+'>\n**Metin:** '+esc(m.content||'Belge')+'\n**Ekler:**\n'+(attachments||'Yok')}
async function filing(m){
 const g=m.guild;
 const eligible=(await g.members.fetch()).filter(u=>!u.user.bot&&u.roles.cache.has(C.prosecutor));
 if(!eligible.size)return m.reply('Atanabilir savcı bulunamadı.');
 const prosecutor=[...eligible.values()][Math.floor(Math.random()*eligible.size)];
 const number=next(g);
 const review=await g.channels.create({name:'inceleme-'+number.toLowerCase(),type:ChannelType.GuildText,parent:C.pending,permissionOverwrites:perms(g,prosecutor.id)});
 const c={number,owner:m.author.id,prosecutor:prosecutor.id,status:'pending',review:review.id,shared:null,participants:{},judge:null,decision:null};
 await save(g,c);
 const buttons=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('file:yes:'+number).setLabel('Kabul').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId('file:no:'+number).setLabel('Red').setStyle(ButtonStyle.Danger));
 await review.send({embeds:[card('Dosya '+number,statement(m))],components:[buttons]});
 await m.reply({content:'Başvurunuz kaydedildi. Dosya numarası: **'+number+'**',allowedMentions:{repliedUser:false}});
}
async function reviewChoice(i){
 const [,decision,num]=i.customId.split(':');const c=db.get(key(i.guild,num));
 if(!c||c.status!=='pending'||i.channelId!==c.review||i.user.id!==c.prosecutor)return i.reply({content:'Bu dosyada yetkili değilsiniz.',flags:MessageFlags.Ephemeral});
 const modal=new ModalBuilder().setCustomId('filedecision:'+decision+':'+num).setTitle('Dosya kararı');
 modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Karar gerekçesi').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1300)));
 await i.showModal(modal);
}
async function decision(i){
 const [,type,num]=i.customId.split(':'),g=i.guild,c=db.get(key(g,num));
 if(!c||c.status!=='pending'||c.prosecutor!==i.user.id)return i.reply({content:'Bu dosya için yetkiniz yok.',flags:MessageFlags.Ephemeral});
 await i.deferReply({flags:MessageFlags.Ephemeral});
 const review=await g.channels.fetch(c.review);
 const main=await g.channels.create({name:(type==='yes'?'dosya-':'ret-')+num.toLowerCase(),type:ChannelType.GuildText,parent:type==='yes'?C.active:C.closed,permissionOverwrites:perms(g,c.prosecutor),topic:'Dosya '+num});
 c.shared=main.id;c.status=type==='yes'?'active':'rejected';c.decision={by:i.user.id,reason:i.fields.getTextInputValue('reason'),time:Date.now(),type};
 await main.send({embeds:[card('Dosya '+num+' • Karar','Savcı: <@'+c.prosecutor+'>\nKarar: '+(type==='yes'?'Kabul':'Red')+'\nGerekçe: '+esc(c.decision.reason))]});
 // Preserve review messages and attachment links before deleting the review channel.
 let before;
 for(let page=0;page<5;page++){
  const batch=await review.messages.fetch({limit:100,...(before?{before}:{})});
  if(!batch.size)break;
  for(const m of [...batch.values()].reverse()){
   const body=m.author.bot?m.embeds.map(e=>e.description||'').join('\n'):statement(m);
   if(body)await main.send({embeds:[card('İnceleme kaydı • '+num,body.slice(0,4000))]});
  }
  before=batch.last().id;if(batch.size<100)break;
 }
 if(type==='yes'){
  c.participants[c.owner]={kind:'avukat',edit:true};
  const ownerRoom=await room(g,c,c.owner,'avukat',true);c.participants[c.owner].channel=ownerRoom.id;
  const prosecutorRoom=await room(g,c,c.prosecutor,'savci',true);c.prosecutorRoom=prosecutorRoom.id;
 }
 await save(g,c);
 await review.delete('İnceleme sona erdi, karar arşivlendi');
 c.review=null;await save(g,c);
 await i.editReply('Karar kaydedildi. İnceleme kanalı silindi. Dosya: '+num);
}
async function addByRegistry(i){
 const g=i.guild,num=i.options.getString('dosya').toUpperCase(),registry=i.options.getString('sicil'),access=i.options.getString('yetki');
 const c=db.get(key(g,num));if(!c||c.status!=='active')return i.reply({content:'Aktif dosya bulunamadı.',flags:MessageFlags.Ephemeral});
 if(c.prosecutor!==i.user.id)return i.reply({content:'Yalnızca dosyanın savcısı üye ekleyebilir.',flags:MessageFlags.Ephemeral});
 await i.deferReply({flags:MessageFlags.Ephemeral});
 const members=await g.members.fetch();
 const matches=[...members.values()].filter(m=>digits(m)===registry);
 if(matches.length!==1)return i.editReply('Sicil bulunamadı veya birden fazla kişide var. İşlem yapılmadı.');
 const member=matches[0];if(member.id===c.prosecutor)return i.editReply('Savcı zaten dosyaya atanmış.');
 const edit=access==='duzenle';
 const existing=c.participants[member.id];
 let channel=existing?.channel?await g.channels.fetch(existing.channel).catch(()=>null):null;
 if(!channel)channel=await room(g,c,member.id,'katilimci',edit);
 else await channel.permissionOverwrites.edit(member.id,{ViewChannel:true,ReadMessageHistory:true,SendMessages:edit,AttachFiles:edit});
 c.participants[member.id]={kind:'katilimci',edit,channel:channel.id};
 await save(g,c);
 // Give access to prior case history without exposing the prosecutor-only main channel.
 const main=await g.channels.fetch(c.shared);
 let before,history=[];
 for(let n=0;n<5;n++){const batch=await main.messages.fetch({limit:100,...(before?{before}:{})});if(!batch.size)break;history.push(...batch.values());before=batch.last().id;if(batch.size<100)break}
 for(const msg of history.reverse()){
  const description=msg.embeds.map(x=>x.description||'').join('\n')||msg.content;
  if(description)await channel.send({embeds:[card('Dosya geçmişi • '+num,description.slice(0,4000))]});
 }
 await i.editReply('Personel eklendi: <@'+member.id+'> • '+(edit?'Düzenleyebilir':'Salt okunur')+' • <#'+channel.id+'>');
}
async function assignJudge(i){
 const g=i.guild,num=i.options.getString('dosya').toUpperCase(),c=db.get(key(g,num));
 if(!c||c.status!=='active')return i.reply({content:'Aktif dosya bulunamadı.',flags:MessageFlags.Ephemeral});
 if(c.prosecutor!==i.user.id)return i.reply({content:'Atama yalnızca dosyanın savcısı tarafından yapılır.',flags:MessageFlags.Ephemeral});
 const role=process.env.JUDGE_ROLE_ID;
 if(!role)return i.reply({content:'Render Environment bölümüne JUDGE_ROLE_ID eklenmelidir.',flags:MessageFlags.Ephemeral});
 await i.deferReply({flags:MessageFlags.Ephemeral});
 const eligible=(await g.members.fetch()).filter(m=>!m.user.bot&&m.roles.cache.has(role));
 if(!eligible.size)return i.editReply('Atanabilecek hâkim bulunamadı.');
 const judge=[...eligible.values()][Math.floor(Math.random()*eligible.size)];
 let roomId=c.judge?.channel;
 if(roomId&&c.judge.id!==judge.id){const old=await g.channels.fetch(roomId).catch(()=>null);if(old)await old.delete('Hakim değişikliği');roomId=null}
 if(!roomId){const ch=await room(g,c,judge.id,'hakim',true);roomId=ch.id}
 c.judge={id:judge.id,channel:roomId};
 await save(g,c);await i.editReply('Hâkim atandı: <@'+judge.id+'> • <#'+roomId+'>');
}
async function relay(m){
 const c=[...db.entries()].filter(([k,c])=>k.startsWith(m.guild.id+':')&&c.status==='active').map(x=>x[1]).find(c=>c.prosecutorRoom===m.channelId||c.judge?.channel===m.channelId||Object.values(c.participants||{}).some(p=>p.channel===m.channelId));
 if(!c)return;
 const main=await m.guild.channels.fetch(c.shared).catch(()=>null);if(!main)return;
 await main.send({embeds:[card('Dosya '+c.number+' • Belge/Beyan',statement(m))],allowedMentions:{parse:[]}});
 // Participants may view prior records only from their private rooms.
 await m.react('✅').catch(()=>{});
}
async function install(client){
 client.once('ready',async()=>{for(const g of client.guilds.cache.values())try{await scan(g)}catch(e){console.error('Dosya yüklenemedi',e)}});
 client.on('guildCreate',g=>scan(g).catch(console.error));
 client.on('messageCreate',m=>{
  if(!m.guild||m.author.bot)return;
  const work=async()=>{
   if(m.channel.parentId===C.intake&&m.channel.name==='belge-sunma'&&(m.content||m.attachments.size))return filing(m);
   return relay(m);
  };
  if(busy.has(m.guild.id))return work().catch(console.error);
  // Serialize new case numbering to avoid collisions.
  if(m.channel.parentId===C.intake&&m.channel.name==='belge-sunma'){
   busy.add(m.guild.id);work().catch(console.error).finally(()=>busy.delete(m.guild.id));
  }else work().catch(console.error);
 });
 client.on('interactionCreate',i=>{
  if(!i.inGuild())return;
  const work=async()=>{
   if(i.isButton()&&i.customId.startsWith('file:'))return reviewChoice(i);
   if(i.isModalSubmit()&&i.customId.startsWith('filedecision:'))return decision(i);
   if(i.isChatInputCommand()&&i.commandName==='dosya-ekle')return addByRegistry(i);
   if(i.isChatInputCommand()&&i.commandName==='hakim')return assignJudge(i);
  };
  work().catch(async e=>{console.error('Dosya işlemi:',e);const content='Dosya işlemi tamamlanamadı: '+e.message;if(i.deferred||i.replied)await i.editReply(content).catch(()=>{});else await i.reply({content,flags:MessageFlags.Ephemeral}).catch(()=>{})});
 });
}
module.exports={install};
