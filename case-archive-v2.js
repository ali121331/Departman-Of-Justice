const {ChannelType,PermissionFlagsBits: P,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags}=require('discord.js');
const C={active:'1566555227522474146',pending:'1566531861239562432',closed:'1566531914595311677',appeal:'1566531950183841852',intake:'1566532560589295657',prosecutor:'1374078438792495145'};
const tag='DOJCASE|', db=new Map(), tasks=new Map();
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
 const intake=g.channels.cache.find(x=>x.parentId===C.intake&&x.name==='belge-sunma');
 if(!intake && g.channels.cache.get(C.intake)?.type===ChannelType.GuildCategory){
  await g.channels.create({name:'belge-sunma',type:ChannelType.GuildText,parent:C.intake,topic:'Dosya ve belge başvurularınızı buraya iletin.'});
 }
}
function resolveCase(g,input){
 const q=String(input||'').trim().toUpperCase();
 if(!q)return null;
 const all=[...db.entries()].filter(([k])=>k.startsWith(g.id+':')).map(x=>x[1]);
 const exact=all.find(c=>c.number===q);
 if(exact)return exact;
 if(!/^\d{1,5}$/.test(q))return null;
 const suffix=String(Number(q)).padStart(5,'0');
 const matches=all.filter(c=>c.number.endsWith('-'+suffix));
 return matches.length===1?matches[0]:null;
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
 await review.send({embeds:[card('Dosya '+number,'**Atanan savcı:** <@'+prosecutor.id+'>\n**Başvuru sahibi:** <@'+m.author.id+'>\n\n'+statement(m))],components:[buttons],allowedMentions:{parse:[]}});
 await m.reply({content:'Başvurunuz kaydedildi. **Dosya numarası:** '+number+'\n**Atanan savcı:** <@'+prosecutor.id+'>',allowedMentions:{repliedUser:false,users:[]}});
}
async function reviewChoice(i){
 const [,decision,num]=i.customId.split(':');const c=db.get(key(i.guild,num));
 if(!c||c.status!=='pending'||i.channelId!==c.review||i.user.id!==c.prosecutor)return i.reply({content:'Bu dosyada yetkili değilsiniz.',flags:MessageFlags.Ephemeral});
 const modal=new ModalBuilder().setCustomId('filedecision:'+decision+':'+num).setTitle('Dosya kararı');
 modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Gerekçe (veya kanala belge yükleyin)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1300)));
 await i.showModal(modal);
}
async function decision(i){
 const [,type,num]=i.customId.split(':'),g=i.guild,c=resolveCase(g,num);
 if(!c||c.status!=='pending'||c.prosecutor!==i.user.id)return i.reply({content:'Bu dosya için yetkiniz yok.',flags:MessageFlags.Ephemeral});
 const review=await g.channels.fetch(c.review);
 const reason=i.fields.getTextInputValue('reason')?.trim();
 const recent=await review.messages.fetch({limit:100});
 const evidence=[...recent.values()].filter(m=>m.author.id===i.user.id&&m.attachments.size>0);
 if(!reason&&!evidence.length)return i.reply({content:'Karar gerekçesi yazın veya inceleme kanalına belge yükleyin. En az biri gerekli.',flags:MessageFlags.Ephemeral});
 await i.deferReply({flags:MessageFlags.Ephemeral});
 const main=await g.channels.create({name:(type==='yes'?'dosya-':'ret-')+num.toLowerCase(),type:ChannelType.GuildText,parent:type==='yes'?C.active:C.closed,permissionOverwrites:perms(g,c.prosecutor),topic:'Dosya '+num});
 c.shared=main.id;c.status=type==='yes'?'active':'rejected';c.decision={by:i.user.id,reason:reason||'Belge sunuldu',time:Date.now(),type};
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
 const c=resolveCase(g,num);if(!c||c.status!=='active')return i.reply({content:'Aktif dosya bulunamadı.',flags:MessageFlags.Ephemeral});
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
 const g=i.guild,num=i.options.getString('dosya').toUpperCase(),c=resolveCase(g,num);
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
async function changeStatus(i){
 const g=i.guild,num=i.options.getString('numara').toUpperCase(),target=i.options.getString('durum'),c=resolveCase(g,num);
 if(!c||!['active','appeal'].includes(c.status))return i.reply({content:'Bu durumda dosya bulunamadı.',flags:MessageFlags.Ephemeral});
 if(i.user.id!==c.prosecutor&&!i.memberPermissions?.has(P.ManageGuild))return i.reply({content:'Dosya durumunu değiştirme yetkiniz yok.',flags:MessageFlags.Ephemeral});
 await i.deferReply({flags:MessageFlags.Ephemeral});
 const main=await g.channels.fetch(c.shared);
 await main.setParent(target==='closed'?C.closed:C.appeal,{lockPermissions:false});
 c.status=target;await save(g,c);
 await main.send({embeds:[card('Dosya durumu • '+num,target==='closed'?'Dosya kapatıldı.':'Dosya itiraza gönderildi.')]});
 await i.editReply('Dosya durumu güncellendi: '+target);
}

async function recuseJudge(i){
 const g=i.guild,num=i.options.getString('dosya').toUpperCase(),c=resolveCase(g,num);
 if(!c||!['active','appeal'].includes(c.status))return i.reply({content:'Dosya bulunamadı.',flags:MessageFlags.Ephemeral});
 if(c.prosecutor!==i.user.id)return i.reply({content:'Yalnızca dosya savcısı hâkim değişikliği isteyebilir.',flags:MessageFlags.Ephemeral});
 if(!c.judge?.id)return i.reply({content:'Bu dosyada henüz atanmış hâkim yok. /hakim kullan.',flags:MessageFlags.Ephemeral});
 const reason=i.options.getString('gerekce')?.trim();
 const document=i.options.getAttachment('belge');
 if(!reason&&!document?.url)return i.reply({content:'Gerekçe veya belge zorunludur.',flags:MessageFlags.Ephemeral});
 const role=process.env.JUDGE_ROLE_ID;
 if(!role)return i.reply({content:'JUDGE_ROLE_ID eksik.',flags:MessageFlags.Ephemeral});
 await i.deferReply({flags:MessageFlags.Ephemeral});
 const available=(await g.members.fetch()).filter(m=>!m.user.bot&&m.roles.cache.has(role)&&m.id!==c.judge.id);
 if(!available.size)return i.editReply('Farklı bir hâkim bulunamadı.');
 const newJudge=[...available.values()][Math.floor(Math.random()*available.size)];
 const former=c.judge;
 const newRoom=await room(g,c,newJudge.id,'hakim',true);
 c.judge={id:newJudge.id,channel:newRoom.id};
 c.judgeHistory=[...(c.judgeHistory||[]),{old:former.id,new:newJudge.id,at:Date.now(),reason:reason||'Belge sunuldu',document:document?.url||null}];
 await save(g,c);
 const oldRoom=await g.channels.fetch(former.channel).catch(()=>null);
 if(oldRoom){await oldRoom.permissionOverwrites.edit(former.id,{ViewChannel:false,SendMessages:false});}
 const main=await g.channels.fetch(c.shared);
 await main.send({embeds:[card('Hâkim değişikliği • '+num,'Önceki hâkim: <@'+former.id+'>\nYeni hâkim: <@'+newJudge.id+'>\nGerekçe: '+esc(reason||'Belge sunuldu')+'\nBelge: '+(document?'['+esc(document.name)+']('+document.url+')':'Yok'))]});
 await i.editReply('Yeni hâkim: <@'+newJudge.id+'> • <#'+newRoom.id+'>');
}
async function documentedTransition(i,status){
 const g=i.guild,num=i.options.getString('dosya').toUpperCase(),c=resolveCase(g,num);
 if(!c||!['active','appeal','closed'].includes(c.status))return i.reply({content:'Dosya bulunamadı.',flags:MessageFlags.Ephemeral});
 if(status==='closed'&&!['active','appeal'].includes(c.status))return i.reply({content:'Dosya zaten kapalı.',flags:MessageFlags.Ephemeral});
 if(status==='appeal'&&!['active','closed'].includes(c.status))return i.reply({content:'Bu dosya zaten itirazda.',flags:MessageFlags.Ephemeral});
 if(c.prosecutor!==i.user.id&&!i.memberPermissions?.has(P.ManageGuild))return i.reply({content:'Dosya işlem yetkiniz bulunmuyor.',flags:MessageFlags.Ephemeral});
 const doc=i.options.getAttachment('belge'),reason=i.options.getString('gerekce')?.trim();
 if(!reason&&!doc?.url)return i.reply({content:'Gerekçe yaz veya belge ekle. İkisinden biri gerekli.',flags:MessageFlags.Ephemeral});
 await i.deferReply({flags:MessageFlags.Ephemeral});
 const main=await g.channels.fetch(c.shared);
 // Record decision and attachment link before moving the case.
 await main.send({embeds:[card((status==='closed'?'Kapatma Kararı':'İtiraz Dilekçesi')+' • '+num,
  '**İşlem yapan:** <@'+i.user.id+'>\n**Gerekçe:** '+esc(reason||'Belgede sunulmuştur')+'\n**Belge:** '+(doc?'['+esc(doc.name)+']('+doc.url+')':'Eklenmedi'))]});
 const previous=c.status;
 c.status=status;
 c.events=[...(c.events||[]),{type:status,by:i.user.id,reason:(reason||'').slice(0,300),document:doc?.url||null,at:Date.now()}].slice(-15);
 await main.setParent(status==='closed'?C.closed:C.appeal,{lockPermissions:false});
 try{await save(g,c)}catch(e){c.status=previous;throw e}
 await i.editReply('İşlem kaydedildi: '+num+' • '+(status==='closed'?'Kapatıldı':'İtiraza gönderildi'));
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
  const intake=m.channel.parentId===C.intake&&m.channel.name==='belge-sunma';
  if(intake&&!(m.content||m.attachments.size))return;
  if(intake){
   const prev=tasks.get(m.guild.id)||Promise.resolve();
   const work=prev.catch(()=>{}).then(()=>filing(m));
   tasks.set(m.guild.id,work);
   work.catch(e=>console.error('Dosya açılışı:',e)).finally(()=>{if(tasks.get(m.guild.id)===work)tasks.delete(m.guild.id)});
  }else relay(m).catch(e=>console.error('Belge aktarımı:',e));
 });
 client.on('interactionCreate',i=>{
  if(!i.inGuild())return;
  const work=async()=>{
   if(i.isButton()&&i.customId.startsWith('file:'))return reviewChoice(i);
   if(i.isModalSubmit()&&i.customId.startsWith('filedecision:'))return decision(i);
   if(i.isChatInputCommand()&&i.commandName==='dosya-ekle')return addByRegistry(i);
   if(i.isChatInputCommand()&&i.commandName==='hakim')return assignJudge(i);
   if(i.isChatInputCommand()&&i.commandName==='dosya-durum')return changeStatus(i);
   if(i.isChatInputCommand()&&i.commandName==='reddi-hakim')return recuseJudge(i);
   if(i.isChatInputCommand()&&i.commandName==='dosya-kapat')return documentedTransition(i,'closed');
   if(i.isChatInputCommand()&&i.commandName==='itiraz')return documentedTransition(i,'appeal');
  };
  work().catch(async e=>{console.error('Dosya işlemi:',e);const content='Dosya işlemi tamamlanamadı: '+e.message;if(i.deferred||i.replied)await i.editReply(content).catch(()=>{});else await i.reply({content,flags:MessageFlags.Ephemeral}).catch(()=>{})});
 });
}
module.exports={install};
