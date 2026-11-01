const {ChannelType}=require('discord.js');
const CATEGORY='1566572867259207802';
const templates=[
  [
    "01-suc-ihbari-sorusturma",
    "Suç İhbarı ve Soruşturma Talebi",
    "01_Suc_Ihbari_ve_Sorusturma_Talebi.pdf"
  ],
  [
    "02-savciliga-inceleme-talebi",
    "Savcılığa İnceleme ve İşlem Talebi",
    "02_Savciliga_Inceleme_ve_Islem_Talebi.pdf"
  ],
  [
    "03-ifade-alma-tutanagi",
    "İfade Alma Tutanağı",
    "03_Ifade_Alma_Tutanagi.pdf"
  ],
  [
    "04-tanik-beyan-tutanagi",
    "Tanık Beyan Tutanağı",
    "04_Tanik_Beyan_Tutanagi.pdf"
  ],
  [
    "05-delil-sunma-yazisi",
    "Delil Sunma Yazısı",
    "05_Delil_Sunma_Yazisi.pdf"
  ],
  [
    "06-delil-aciklama-talebi",
    "Delil Açıklama Talebi",
    "06_Delil_Aciklama_Talebi.pdf"
  ],
  [
    "07-ek-sorusturma-talebi",
    "Ek Soruşturma İşlemi Talebi",
    "07_Ek_Sorusturma_Islemi_Talebi.pdf"
  ],
  [
    "08-savcilik-inceleme-karari",
    "Savcılık İnceleme Kararı",
    "08_Savcilik_Inceleme_Karari.pdf"
  ],
  [
    "09-sorusturma-degerlendirme",
    "Soruşturma Değerlendirme Raporu",
    "09_Sorusturma_Degerlendirme_Raporu.pdf"
  ],
  [
    "10-karar-yeniden-degerlendirme",
    "Kararın Yeniden Değerlendirilmesi",
    "10_Karar_Yeniden_Degerlendirme.pdf"
  ],
  [
    "11-kovusturma-karari-inceleme",
    "Kovuşturma Kararı İncelemesi",
    "11_Kovusturma_Karari_Inceleme.pdf"
  ],
  [
    "12-mahkemeye-talep-dilekcesi",
    "Mahkemeye Talep Dilekçesi",
    "12_Mahkemeye_Talep_Dilekcesi.pdf"
  ]
];
async function setup(guild){
 await guild.channels.fetch();
 const parent=guild.channels.cache.get(CATEGORY);
 if(!parent||parent.type!==ChannelType.GuildCategory)return;
 for(const [name,label,filename] of templates){
  let channel=guild.channels.cache.find(c=>c.parentId===CATEGORY&&c.name===name);
  if(channel)continue;
  channel=await guild.channels.create({
   name,type:ChannelType.GuildText,parent:CATEGORY,
   topic:label+' | PDF: '+filename+' | Örnek belge yükleme kanalı',
   reason:'California belge şablonları için ayrı yükleme kanalı'
  });
  await channel.send({content:'**'+label+'**\nBu kanala **'+filename+'** dosyasını yükleyebilirsiniz. Bu kanal bir şablon arşividir; belgeler otomatik yüklenmez.',allowedMentions:{parse:[]}});
 }
}
function install(client){
 client.once('ready',async()=>{for(const guild of client.guilds.cache.values())try{await setup(guild)}catch(err){console.error('Belge şablon kanalları:',err.message)}});
 client.on('guildCreate',guild=>setup(guild).catch(err=>console.error('Belge kanalları:',err.message)));
}
module.exports={install};
