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
- DOJ rolü: `1566506941705101384` → 6 haneli benzersiz kurum içi sicil numarası (`#100000` gibi).
- USM rolü: `1566506899116134501` → 5 haneli kurum içi rozet numarası; iki son rakam birbirinin aynı veya ardışığı olamaz; başka USM üyesinin son iki hanesi de aynı olamaz.
- IC isim kanalı: `1374086832941174844`. Kullanıcı kendi IC adını bu kanala mesaj olarak yazar; bot takma adını değiştirirken mevcut `#` numarasını korur.
- `/numara-tara` mevcut rol üyelerini tarar, numarası olmayanlara atama yapar. Var olan numaraları değiştirmez.
- Rolü sonradan verilen personele otomatik numara atanır.
- Discord Developer Portal > Bot > **Server Members Intent** ve **Message Content Intent** açılmalı.
- Botun rolü, numaralandırılacak kişilerin rollerinden yukarıda olmalı ve **Manage Nicknames / Takma Adları Yönet** iznine sahip olmalı.
- USM son iki hane kısıtları nedeniyle uygun çift sayısı sınırlıdır; kapasite dolarsa bot yeni numara atamaz.
- Numaralar sunucu içindeki kurgusal kurum içi kimlikleridir, resmî sicil numaraları değildir.

## Rastgele numara üretimi (güncel)
- USM: Rastgele **5 haneli** badge number. Son iki hane ne kendi içinde aynı ne de art arda rakam olabilir; başka USM personelinin son iki hanesiyle çakışamaz. Üçlü artan/azalan rakam dizilerinden de kaçınılır.
- DOJ: Rastgele **6 haneli** sicil numarası. Tek kural başka DOJ personelinin siciliyle aynı olmamasıdır.
- Sistemler ayrı değerlendirilir. İki role birden sahip üyelerde takma ad için USM önceliklidir.
- Daha önceden # ile atanmış numaralar otomatik değiştirilmez. Yeni numaralar rol atandığında veya /numara-tara ile verilir.

## Dosya arşiv sistemi (California düzeni)
- **Belge Sunma kategori:** `1566532560589295657` → bot kategori içinde `#belge-sunma` kanalı oluşturur. Bu kanala belge veya metin göndermek dosya açar.
- **Onay Bekleyen Dosyalar:** `1566531861239562432` → yalnızca atanmış savcıya açık özel inceleme kanalı.
- **Aktif Dosyalar:** `1566531570377039955` → savcı ile belge sunan kişinin görebildiği ortak dosya kanalı; ayrıca belge sunan kişi için ayrı özel kanal.
- **Kapanan Dosyalar:** `1566531914595311677` → `/dosya-durum` ile aktif dosyayı taşır.
- **İtiraza Giden Dosyalar:** `1566531950183841852` → `/dosya-durum` ile taşır.
- **Savcı rol ID:** `1374078438792495145`, atama uygun roldeki üyeler arasından rastgeledir.
- Her dosya `CA-26-INT-00001` biçiminde benzersiz kurum içi takip numarası alır. California mahkemesinin gerçek dava numarası değildir.
- Savcı inceleme kanalındaki kabul/red butonlarıyla işlem yapar. Kabulde ortak aktif kanal ve belgeyi sunan kişiye özel kanal açılır. Özel kanala gelen sonraki yazılar ortak kanala aktarılır.
- `/dosya-durum numara:<numara> durum:Kapat` veya `İtiraza gönder`, atanmış savcı veya sunucu yönetimi kullanabilir.
- Kayıtlar inceleme kanalının topic alanında tutulur; yeniden başlatıldığında buradan yüklenir. Kategorileri ve inceleme kanallarını silmeyin.
- Botta **Manage Channels, View Channel, Send Messages, Read Message History, Attach Files, Manage Roles** (ayrı sistemler için) yetkileri gerekir. Savcı rolünün üzerinde bot rolü bulunması tavsiye edilir.
- Orijinal Discord belge bağlantılarının geçerliliği değişebilir; kritik kayıtların yedeklenmesi gerekir.

## Savcı karar iş akışı
- Onay bekleyen özel dosya kanalına savcı **metin, PDF, görsel ve diğer ekleri** karar vermeden önce mesaj olarak yükleyebilir.
- **Kabul Et** veya **Reddet** butonu gerekçe girmek için metin formu açar; gerekçe zorunludur.
- Kabulde savcı ekleri ve ilk başvuru aktif ortak dosya kanalına aktarılır; ayrıca savcıya özel **savci-...** çalışma kanalı açılır. Başvuru sahibinin **avukat-...** özel kanalı da korunur.
- Ret kararında savcı metni ve ekleri karar arşivinde tutulur; aktif dosya kanalı açılmaz.
- Karar verildiğinde Onay Bekleyen inceleme kanalı, **Kapanan Dosyalar** kategorisinde erişimi kapalı **karar-...** kaydı olarak saklanır. Kaydı silmemek, yeniden başlatma sonrası veri ve delillerin korunması için gereklidir.
- Otomatik arşiv yalnızca son 500 inceleme mesajındaki savcı metin/eklerini yeni aktif dosyaya kopyalar. Daha büyük dosyalar için kalıcı belge deposu gerekir.

## Dosya odaları ve karar sonrası kapanış — güncel
- Her belge sunan kişi için `doj-avukat-KULLANICI_ID` kategorisi; kabul edilen dosya için `avukat-CA-...` kanalı burada açılır.
- Her atanmış savcı için `doj-savci-KULLANICI_ID` kategorisi; kabul edilen dosya için `savci-CA-...` kanalı burada açılır.
- Bu iki çalışma kanalı **Aktif Dosyalar** kategorisinde değildir. Ortak `dosya-CA-...` kanalı Aktif Dosyalar içinde kalır.
- Savcı ve belge sunan kişinin çalışma kanallarına gönderilen metin ve ek bağlantıları ortak dosya kanalına yansıtılır.
- Karar verildikten sonra Onay Bekleyen kategorisindeki **inceleme kanalı silinir**. Kabulde belge ve karar önce aktif kanala aktarılır; ret halinde ayrı bir `ret-CA-...` karar kaydı Kapanan Dosyalar kategorisine yazılır.
- Eski sürümde açılmış dosyaların özel kanalları otomatik taşınmaz; yeni onaylanan dosyalar yeni kategori düzenini kullanır.
- Silinen inceleme kanalı geri alınamaz. Aktarılmayan mesajlar kaybolabileceğinden gerçek belgeler için yedekleme gerekir.

## Dosya arşivi v2 — kişiye özel erişim (güncel)
- Aktif dosya kategori ID: `1566555227522474146`. Ana `dosya-...` kanalı yalnızca atanmış savcı ve botun okuyabileceği şekilde oluşturulur (Discord Administrator yetkisi olan sunucu yöneticileri yine erişebilir).
- Avukat/belge sunan kişi için `doj-avukat-KULLANICI_ID` kategorisi, savcı için `doj-savci-KULLANICI_ID` kategorisi, yeni eklenen personel için `doj-katilimci-KULLANICI_ID` kategorisi açılır.
- `/dosya-ekle dosya:CA-... sicil:213414 yetki:goruntule|duzenle` komutu yalnızca dosyanın atanmış savcısı tarafından kullanılabilir. Kişi takma adındaki `#` sonrasında bulunan sicil/rozet numarasından bulunur. Kişiye özel kanal ve son 500 kayıt üzerinden geçmiş kopyası oluşturulur.
- Salt okunur yetki mesaj yazmayı yasaklar. Düzenleme yetkisi kişiye özel kanaldan metin ve ek gönderme yetkisidir; ana savcı arşivindeki mesajları silme/düzenleme yetkisi vermez.
- `/hakim dosya:CA-...` komutu atanan savcı tarafından çalıştırılır; `JUDGE_ROLE_ID` ENV ile belirlenen rol üyelerinden rastgele hâkim seçer ve kendisine özel `doj-hakim-KULLANICI_ID` kategorisinde kanal açar.
- Her özel kanaldan gönderilen metin ve ek bağlantıları ana savcı dosyasına aktarılır. Özel kanal mesaj geçmişi Discord üzerinde kalır.
- Dosya kayıtları Discord kanal konularına yazılır, bot yeniden başlatılınca yeniden yüklenir. Kanal ve mesaj silinirse kayıtlar kaybolabilir. Üretim ortamında bağımsız veritabanı ve ek dosya yedekleme önerilir.
- `JUDGE_ROLE_ID` ayarlanmadan hâkim atama komutu çalışmaz.
- Discord kategori ve kanal sınırları ile konu alanındaki 1024 karakter limiti, çok sayıda kişi/dosya için ek bir veritabanı ihtiyacına yol açabilir.

## Yeni işlem komutları
- `/reddi-hakim dosya:... gerekce:...`: atanmış savcı, mevcut hâkimden farklı rastgele bir hâkim seçer. Eski hâkimin kendi kanalına erişimi kaldırılır, yeni hâkim için özel kategori/kanal oluşturulur. Bu bir sunucu içi atama işlemidir; yargısal reddi hâkim kararının yerine geçmez.
- `/dosya-kapat dosya:... gerekce:... belge:<ek>`: kapatma gerekçesi ve karar belgesi zorunludur; belge bağlantısı dosya ana arşivine yazılır.
- `/itiraz dosya:... gerekce:... belge:<ek>`: itiraz dilekçesi zorunludur; dosya İtiraza Giden Dosyalar kategorisine taşınır.
- Eski `/dosya-durum` komutu yeni belge zorunluluğunu aşmaması için yeni komut listesinden çıkarıldı.
- Belgeler Discord CDN bağlantılarıyla kaydedilir. Kritik evrak için ayrıca güvenli, kalıcı yedekleme gerekir.
