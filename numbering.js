const DOJ_ROLE_ID='1566506941705101384';
const USM_ROLE_ID='1566506899116134501';
const IC_CHANNEL_ID='1374086832941174844';
const locks=new Map();
const numberPattern=/#(\d{5,6})(?!\d)/;
function queue(guild,job){
  const previous=locks.get(guild.id)||Promise.resolve();
  const current=previous.catch(()=>{}).then(job);
  locks.set(guild.id,current);
  current.finally(()=>{if(locks.get(guild.id)===current)locks.delete(guild.id)}).catch(()=>{});
  return current;
}
function existingNumber(member){return member.nickname?.match(numberPattern)?.[1]||null}
function isQualified(member){return member.roles.cache.has(DOJ_ROLE_ID)||member.roles.cache.has(USM_ROLE_ID)}
function validUSMSuffix(pair){return pair[0]!==pair[1] && Math.abs(Number(pair[0])-Number(pair[1]))!==1}
function pickNumber(member,members){
  const usm=member.roles.cache.has(USM_ROLE_ID);
  const used=new Set(),suffixes=new Set();
  for(const m of members.values()){
    const num=existingNumber(m);
    if(!num)continue;
    used.add(num);
    if(m.roles.cache.has(USM_ROLE_ID))suffixes.add(num.slice(-2));
  }
  if(usm){
    for(let n=10000;n<=99999;n++){
      const num=String(n),pair=num.slice(-2);
      if(!used.has(num)&&validUSMSuffix(pair)&&!suffixes.has(pair))return num;
    }
  }else{
    for(let n=100000;n<=999999;n++){
      const num=String(n);
      if(!used.has(num))return num;
    }
  }
  return null;
}
async function assignMember(member,members){
  if(member.user.bot||!isQualified(member))return 'skip';
  if(existingNumber(member))return 'skip';
  if(!member.manageable)return 'permission';
  const number=pickNumber(member,members);
  if(!number)return 'exhausted';
  const base=(member.nickname||member.user.globalName||member.user.username).trim().replace(/\s+#\d{5,6}$/,'');
  const suffix=' #'+number;
  if(base.length+suffix.length>32)return 'length';
  await member.setNickname(base+suffix,'DOJ / USM RP number assigned automatically');
  return number;
}
function install(client){
  async function assign(member){
    return queue(member.guild,async()=>{
      if(!isQualified(member)||existingNumber(member))return;
      const members=await member.guild.members.fetch();
      await assignMember(member,members);
    }).catch(e=>console.error('Auto number:',e.message));
  }
  client.on('guildMemberAdd',assign);
  client.on('guildMemberUpdate',async(oldMember,newMember)=>{
    const added=[DOJ_ROLE_ID,USM_ROLE_ID].some(id=>!oldMember.roles.cache.has(id)&&newMember.roles.cache.has(id));
    if(added)await assign(newMember);
  });
  client.on('messageCreate',async message=>{
    if(message.author.bot||!message.guild||message.channelId!==IC_CHANNEL_ID)return;
    const member=await message.guild.members.fetch(message.author.id).catch(()=>null);
    if(!member)return;
    const name=message.content.trim().replace(/\s+/g,' ');
    if(!name||name.length>28||name.includes('#')||/[@\n\r]/.test(name))return;
    await queue(message.guild,async()=>{
      const latest=await message.guild.members.fetch(member.id);
      const number=existingNumber(latest);
      const suffix=number?' #'+number:'';
      const newName=name+suffix;
      if(newName.length>32||!latest.manageable)return;
      await latest.setNickname(newName,'IC name channel update; preserves number');
      // An IC name update can precede a role assignment.
      if(!number&&isQualified(latest)){
        const members=await message.guild.members.fetch();
        await assignMember(latest,members);
      }
      await message.react('✅').catch(()=>{});
    }).catch(e=>console.error('IC name:',e.message));
  });
  client.on('interactionCreate',async i=>{
    if(!i.isChatInputCommand()||i.commandName!=='numara-tara'||!i.inGuild())return;
    if(!i.memberPermissions?.has('ManageGuild'))return i.reply({content:'Bu işlem için Sunucuyu Yönet yetkisi gerekir.',ephemeral:true});
    await i.deferReply({ephemeral:true});
    try{
      const result=await queue(i.guild,async()=>{
        const members=await i.guild.members.fetch();
        const report={assigned:0,skipped:0,failed:0,capacity:0};
        for(const member of members.values()){
          if(!isQualified(member))continue;
          try{
            const r=await assignMember(member,members);
            if(/^\d+$/.test(r))report.assigned++;
            else if(r==='skip')report.skipped++;
            else if(r==='exhausted')report.capacity++;
            else report.failed++;
          }catch(e){report.failed++;console.error('Scan nickname:',member.id,e.message)}
        }
        return report;
      });
      await i.editReply('Tarama tamamlandı. Yeni numara: '+result.assigned+' | Zaten numaralı: '+result.skipped+' | Başarısız: '+result.failed+' | Kapasite dolu: '+result.capacity);
    }catch(e){await i.editReply('Numara taraması başarısız: '+e.message)}
  });
  console.log('DOJ/USM numbering and IC-name listener installed');
}
module.exports={install,DOJ_ROLE_ID,USM_ROLE_ID,IC_CHANNEL_ID};
