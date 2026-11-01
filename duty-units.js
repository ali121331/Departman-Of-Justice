const {EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags,PermissionFlagsBits}=require('discord.js');
const DOJ='1566506941705101384',USM='1566506899116134501';
const LOG='1566542232419307720', PREFIX='DOJ_USM_DUTY ';
const records=new Map(), ids=new Map(), queues=new Map(), prompts=new Map();
const f=ms=>{const m=Math.floor(Math.max(0,ms)/60000);return Math.floor(m/60)+' sa '+m%60+' dk'};
const k=(g,unit,u)=>g+':'+unit+':'+u;
const get=(g,u,t)=>records.get(k(g,t,u))||{guildId:g,userId:u,unit:t,total:0,started:null,checkAt:null,deadline:null};
const e=(title,body)=>new EmbedBuilder().setColor(0x173b63).setTitle(title).setDescription(body).setTimestamp();
const isManager=i=>i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)||(process.env.ADMIN_ROLE_ID&&i.member?.roles?.cache?.has(process.env.ADMIN_ROLE_ID));
const valid=(unit,member)=>member?.roles?.cache?.has(unit==='DOJ'?DOJ:USM);
function panel(){
 return [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('shift:begin:DOJ').setLabel('DOJ Mesai Başlat').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('shift:finish:DOJ').setLabel('DOJ Mesai Bitir').setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId('shift:begin:USM').setLabel('USM Mesai Başlat').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('shift:finish:USM').setLabel('USM Mesai Bitir').setStyle(ButtonStyle.Danger)),
  new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('shift:mine').setLabel('Mesai Bilgilerim').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('shift:active').setLabel('Aktif DOJ / USM').setStyle(ButtonStyle.Primary))];
}
const lock=async(key,fn)=>{const prev=queues.get(key)||Promise.resolve();const task=prev.catch(()=>{}).then(fn);queues.set(key,task);try{return await task}finally{if(queues.get(key)===task)queues.delete(key)}};
async function logChannel(client,g){const ch=await client.channels.fetch(LOG).catch(()=>null);if(!ch||ch.guildId!==g||!ch.isTextBased())throw Error('Mesai log kanalı bulunamadı');return ch}
async function save(client,r){
 const key=k(r.guildId,r.unit,r.userId);
 const ch=await logChannel(client,r.guildId);
 await lock(key,async()=>{
  const body='**Personel:** <@'+r.userId+'>\n**Kurum:** '+r.unit+'\n**Durum:** '+(r.started?'🟢 Aktif':'⚪ Mesai dışı')+'\n**Toplam:** '+f(r.total+(r.started?Date.now()-r.started:0))+(r.started?'\n**Başlangıç:** <t:'+Math.floor(r.started/1000)+':F>':'')+(r.deadline?'\n**Onay bekliyor:** <t:'+Math.floor(r.deadline/1000)+':R>':'');
  const sent=await ch.send({content:PREFIX+JSON.stringify(r),embeds:[e('Mesai Kaydı • '+r.unit,body)],allowedMentions:{parse:[]}});
  const old=ids.get(key);ids.set(key,sent.id);records.set(key,{...r});
  if(old&&old!==sent.id)await ch.messages.delete(old).catch(err=>console.warn('Eski mesai logu:',err.message));
 });
}
async function load(client){
 const ch=await client.channels.fetch(LOG).catch(()=>null);if(!ch)return;
 const all=[];let before;
 for(let j=0;j<30;j++){const batch=await ch.messages.fetch({limit:100,...before?{before}:{}});if(!batch.size)break;all.push(...batch.values());before=batch.last().id;if(batch.size<100)break}
 for(const msg of all.reverse()){
  if(msg.author.id!==client.user.id||!msg.content.startsWith(PREFIX))continue;
  try{const r=JSON.parse(msg.content.slice(PREFIX.length));if(!['DOJ','USM'].includes(r.unit))continue;const key=k(r.guildId,r.unit,r.userId);records.set(key,r);ids.set(key,msg.id)}catch{}
 }
 console.log('DOJ/USM mesai kayıtları:',records.size);
}
async function start(client,i,unit){
 if(!valid(unit,i.member))return i.reply({content:unit+' rolü gerekli.',flags:MessageFlags.Ephemeral});
 const r=get(i.guildId,i.user.id,unit);
 if(r.started)return i.reply({content:unit+' mesain zaten açık.',flags:MessageFlags.Ephemeral});
 r.started=Date.now();r.checkAt=r.started+3600000;r.deadline=null;
 await save(client,r);return i.reply({content:unit+' mesain başladı.',flags:MessageFlags.Ephemeral});
}
async function end(client,g,u,unit,reason){
 const r=get(g,u,unit);
 if(!r.started)return null;
 const delta=Math.max(0,Date.now()-r.started);r.total+=delta;r.started=null;r.checkAt=null;r.deadline=null;
 await save(client,r);return {delta,total:r.total,reason};
}
const details=(g,u,unit)=>{const r=get(g,u,unit);return '**'+unit+'** • '+(r.started?'🟢 Aktif':'⚪ Pasif')+' • Toplam **'+f(r.total+(r.started?Date.now()-r.started:0))+'**'};
function active(g,unit){
 const found=[...records.values()].filter(r=>r.guildId===g&&r.started&&(!unit||r.unit===unit));
 return found.length?found.slice(0,35).map(r=>'<@'+r.userId+'> • '+r.unit+' • '+f(Date.now()-r.started)).join('\n'):'Aktif mesai yok.';
}
async function manage(client,i){
 const cmd=i.commandName,member=i.options.getUser('uye')||i.user,unit=i.options.getString('kurum')||'DOJ';
 if(cmd==='mesai')return i.reply({embeds:[e('Mesai • '+member.username,details(i.guildId,member.id,'DOJ')+'\n'+details(i.guildId,member.id,'USM'))],flags:MessageFlags.Ephemeral});
 if(cmd==='mesai-liste')return i.reply({embeds:[e('Aktif DOJ / USM Mesaileri', '**DOJ**\n'+active(i.guildId,'DOJ')+'\n\n**USM**\n'+active(i.guildId,'USM'))],flags:MessageFlags.Ephemeral});
 if(!isManager(i))return i.reply({content:'Yönetim yetkisi gerekli.',flags:MessageFlags.Ephemeral});
 if(cmd==='mesai-duzenle'){
  const minutes=i.options.getInteger('dakika');if(minutes===0)return i.reply({content:'Sıfır değişiklik yapılmadı.',flags:MessageFlags.Ephemeral});
  const r=get(i.guildId,member.id,unit);r.total=Math.max(0,r.total+minutes*60000);
  await save(client,r);return i.reply({content:member.username+' • '+unit+' toplam: '+f(r.total),flags:MessageFlags.Ephemeral});
 }
 if(cmd==='mesai-sonlandir'){
  const result=await end(client,i.guildId,member.id,unit,'Yetkili müdahalesi');
  return i.reply({content:result?'Mesai sonlandırıldı: '+f(result.delta):'Aktif mesai bulunamadı.',flags:MessageFlags.Ephemeral});
 }
 if(cmd==='mesai-sifirla'){
  const all=i.options.getBoolean('tum');
  if(all){
   const selected=[...records.values()].filter(r=>r.guildId===i.guildId&&r.unit===unit);
   for(const r of selected){r.total=0;r.started=null;r.checkAt=null;r.deadline=null;await save(client,r)}
   return i.reply({content:unit+' için '+selected.length+' personelin mesaisi sıfırlandı.',flags:MessageFlags.Ephemeral});
  }
  const r=get(i.guildId,member.id,unit);r.total=0;r.started=null;r.checkAt=null;r.deadline=null;await save(client,r);
  return i.reply({content:member.username+' '+unit+' mesaisi sıfırlandı.',flags:MessageFlags.Ephemeral});
 }
}
async function tick(client){
 for(const r of [...records.values()]){
  if(!r.started)continue;
  try{
   if(r.deadline&&Date.now()>=r.deadline){await end(client,r.guildId,r.userId,r.unit,'30 dakikalık onay süresi doldu');continue}
   if(!r.deadline&&Date.now()>=(r.checkAt||r.started+3600000)){
    const ch=await logChannel(client,r.guildId);
    const confirm=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('shift:confirm:'+r.unit+':'+r.userId).setLabel('Mesaiye Devam Ediyorum').setStyle(ButtonStyle.Success));
    r.deadline=Date.now()+1800000;await save(client,r);
    const m=await ch.send({content:'<@'+r.userId+'> • '+r.unit+' mesai onayı (30 dakika).',components:[confirm],allowedMentions:{users:[r.userId]}});
    prompts.set(k(r.guildId,r.unit,r.userId),m.id);
   }
  }catch(err){console.warn('Mesai kontrolü:',err.message)}
 }
}
function install(client){
 client.once('ready',async()=>{await load(client);const t=setInterval(()=>tick(client).catch(console.error),60000);t.unref();await tick(client)});
 client.on('interactionCreate',i=>{
  if(!i.inGuild())return;
  (async()=>{
   if(i.isButton()&&i.customId.startsWith('shift:')){
    const [,action,unit,user]=i.customId.split(':');
    if(action==='mine')return i.reply({embeds:[e('Mesai Bilgilerim',details(i.guildId,i.user.id,'DOJ')+'\n'+details(i.guildId,i.user.id,'USM'))],flags:MessageFlags.Ephemeral});
    if(action==='active')return i.reply({embeds:[e('Aktif Mesailer','**DOJ**\n'+active(i.guildId,'DOJ')+'\n\n**USM**\n'+active(i.guildId,'USM'))],flags:MessageFlags.Ephemeral});
    if(action==='begin')return start(client,i,unit);
    if(action==='finish'){
     const done=await end(client,i.guildId,i.user.id,unit);
     return i.reply({content:done?unit+' mesain bitti. Süre: '+f(done.delta)+' • Toplam: '+f(done.total):'Aktif mesai yok.',flags:MessageFlags.Ephemeral});
    }
    if(action==='confirm'){
     if(i.user.id!==user)return i.reply({content:'Bu onay sadece mesai sahibine aittir.',flags:MessageFlags.Ephemeral});
     const r=get(i.guildId,user,unit);
     if(!r.started||!r.deadline||Date.now()>r.deadline)return i.reply({content:'Onay süresi geçti veya aktif onay bulunamadı.',flags:MessageFlags.Ephemeral});
     r.deadline=null;r.checkAt=Date.now()+3600000;await save(client,r);
     return i.update({content:'✅ <@'+user+'> • '+unit+' mesai onayı alındı.',components:[],allowedMentions:{parse:[]}});
    }
   }
   if(i.isChatInputCommand()&&['mesai','mesai-liste','mesai-duzenle','mesai-sonlandir','mesai-sifirla'].includes(i.commandName))return manage(client,i);
  })().catch(err=>{console.error('Mesai:',err);if(!i.replied&&!i.deferred)i.reply({content:'Mesai işlemi başarısız.',flags:MessageFlags.Ephemeral}).catch(()=>{})});
 });
}
module.exports={install,panel};
