# Departman Of Justice — Discord Bot

Render Web Service üzerinde çalışan DOJ botu. Geliştirici: **anevrix**.

## Özellikler
- `/panel tür:Mesai` → Mesai başlat, bitir, bilgilerim butonlu panel (Sunucuyu Yönet).
- `/panel tür:Başvuru` → Başvuru formu paneli (Sunucuyu Yönet).
- `/mesai` → Toplam mesai ve aktif durum; yetkililer başka üyeyi de sorgular.
- `/mesai-liste` → Aktif mesaide olanlar (Sunucuyu Yönet).
- Başvurular ayarlanan kanala gider; yetkili **Kabul Et** / **Reddet** butonuna basınca karar gerekçesi formu açılır. Başvuran kişiye özel mesaj denenir.
- Mesai başlangıç/bitiş kayıtları yalnızca botun kullanacağı ayrı bir **mesai log kanalına** yazılır. Bot yeniden başladığında son 2000 kayıt taranarak mesailer yüklenir.
- `/health` endpoint'i.

## Environment (Render > Environment)
| Key | Açıklama |
|---|---|
| `DISCORD_TOKEN` | Discord bot tokeni (zorunlu) |
| `GUILD_ID` | Sunucu ID (önerilir) |
| `DUTY_LOG_CHANNEL_ID` | Botun yazıp okuyabildiği ayrı mesai log metin kanalı (mesai için zorunlu) |
| `APPLICATION_CHANNEL_ID` | Yetkililerin başvuruları inceleyeceği metin kanalı (başvuru için zorunlu) |
| `ADMIN_ROLE_ID` | Yetkili rol ID (isteğe bağlı; Sunucuyu Yönet yetkisi zaten geçerlidir) |
| `PORT` | Render otomatik verir, belirtmek gerekmiyor |

## Render
- Runtime: Node
- Build: `npm install`
- Start: `npm start`
- Health Check Path: `/health`

Botu davet ederken `bot` ve `applications.commands` scope'larıyla davet et. İlgili metin kanallarında **Kanalları Görüntüle**, **Mesaj Gönder**, **Mesaj Geçmişini Oku**, **Bağlantı Yerleştir** izinleri gerekli.

**Notlar**
- Ücretsiz Render Web Service uykuya geçebilir.
- Geçici Discord CDN URL'lerindeki `ex=` süresi dolarsa paneldeki görseller yüklenmez. Kalıcı URL ile değiştirilmesi gerekir.
- Mesai logu son 2000 mesajı okuyarak yüklenir; daha uzun geçmişte tam kayıt için kalıcı veritabanına geçilmelidir. Log kanalını silmeyin.
- Discord uygulama ikonunu ve banner'ını kod değişikliğiyle ayarlamak yerine Discord Developer Portal'dan yükleyin.

## DOJ / USM otomatik numara ve IC isim
- DOJ rolü: `1566506941705101384` → 6 haneli benzersiz RP sicil numarası (`#100000` gibi).
- USM rolü: `1566506899116134501` → 5 haneli RP rozet numarası; iki son rakam birbirinin aynı veya ardışığı olamaz; başka USM üyesinin son iki hanesi de aynı olamaz.
- IC isim kanalı: `1374086832941174844`. Kullanıcı kendi IC adını bu kanala mesaj olarak yazar; bot takma adını değiştirirken mevcut `#` numarasını korur.
- `/numara-tara` mevcut rol üyelerini tarar, numarası olmayanlara atama yapar. Var olan numaraları değiştirmez.
- Rolü sonradan verilen personele otomatik numara atanır.
- Discord Developer Portal > Bot > **Server Members Intent** ve **Message Content Intent** açılmalı.
- Botun rolü, numaralandırılacak kişilerin rollerinden yukarıda olmalı ve **Manage Nicknames / Takma Adları Yönet** iznine sahip olmalı.
- USM son iki hane kısıtları nedeniyle uygun çift sayısı sınırlıdır; kapasite dolarsa bot yeni numara atamaz.
- Numaralar sunucu içindeki kurgusal RP kimlikleridir, resmî sicil numaraları değildir.
