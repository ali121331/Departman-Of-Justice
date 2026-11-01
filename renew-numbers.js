const { randomInt } = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');
const DOJ='1566506941705101384';
const USM='1566506899116134501';
const currentNumber=m=>(m.nickname||'').match(/#(\d{5,6})$/)?.[1]||null;
const eligible=m=>!m.user.bot&&(m.roles.cache.has(DOJ)||m.roles.cache.has(USM));
const suffixOK=p=>p[0]!==p[1] && Math.abs(Number(p[0])-Number(p[1]))!==1;
const runOK=s=>!([...s].some((_,i)=>i+2<s.length && Math.abs(+s[i+1]- +s[i])===1 && (+s[i+1]- +s[i])===(+s[i+2]- +s[i+1])));
let busy=false;
module.exports=function install(client){
 client.on('interactionCreate',async i=>{
  if(!i.inGuild())return;
  if(i.isChatInputCommand() && i.commandName==='numara-yenile'){
   if(!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))return i.reply({content:'Sunucuyu Yönet yetkisi gerekir.',flags:MessageFlags.Ephemeral});
   const button=new ButtonBuilder().setCustomId('renew:'+i.user.id+':'+Date.now()).setLabel('Tüm numaraları yeniden dağıt').setStyle(ButtonStyle.Danger);
   return i.reply({content:'Dikkat: DOJ ve USM numaraları değişecek. IC isimleri korunur. 2 dakika içinde onayla.',components:[new ActionRowBuilder().addComponents(button)],flags:MessageFlags.Ephemeral});
  }
  if(!i.isButton()||!i.customId.startsWith('renew:'))return;
  const [,requester,time]=i.customId.split(':');
  if(i.user.id!==requester||!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))return i.reply({content:'Bu işlemi yalnızca komutu kullanan yetkili onaylayabilir.',flags:MessageFlags.Ephemeral});
  if(Date.now()-Number(time)>120000)return i.reply({content:'Onay süresi doldu.',flags:MessageFlags.Ephemeral});
  if(busy)return i.reply({content:'Bir yenileme işlemi devam ediyor.',flags:MessageFlags.Ephemeral});
  busy=true;
  await i.update({content:'Numaralar yenileniyor...',components:[]});
  try{
   const members=await i.guild.members.fetch();
   const targets=[...members.values()].filter(eligible);
   const old=new Set(targets.map(currentNumber).filter(Boolean));
   const newDOJ=new Set(),newUSM=new Set(),last2=new Set(),plan=[];
   for(const m of targets){
    const usm=m.roles.cache.has(USM);const used=usm?newUSM:newDOJ;
    let num=null;
    for(let tries=0;tries<25000;tries++){
     const value=String(usm?randomInt(10000,100000):randomInt(100000,1000000));
     if(used.has(value)||old.has(value))continue;
     if(usm&&(!suffixOK(value.slice(-2))||last2.has(value.slice(-2))||!runOK(value)))continue;
     num=value;break;
    }
    if(!num){plan.push({m,reason:'capacity'});continue}
    used.add(num);if(usm)last2.add(num.slice(-2));
    const base=(m.nickname||m.user.globalName||m.user.username).replace(/\s*#\d{5,6}$/,'').trim();
    const nick=base+' #'+num;
    plan.push({m,nick,reason:!m.manageable?'permission':nick.length>32?'length':null});
   }
   let updated=0,failed=0;
   for(const p of plan){
    if(p.reason){failed++;continue}
    try{await p.m.setNickname(p.nick,'DOJ/USM toplu numara yenileme');updated++}
    catch(e){failed++;console.error('Nickname refresh:',p.m.id,e.message)}
   }
   await i.followUp({content:'Yenileme tamamlandı. Güncellenen: '+updated+', başarısız/atlanmış: '+failed,flags:MessageFlags.Ephemeral});
  }catch(e){console.error(e);await i.followUp({content:'Yenileme hatası: '+e.message,flags:MessageFlags.Ephemeral}).catch(()=>{})}
  finally{busy=false}
 });
};