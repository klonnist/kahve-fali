// Fal metin kütüphanesi. Analiz sonuçları hangi havuzdan seçileceğini belirler.
window.FAL = {
  titles: {
    light: ['Fincanın ferah, yolun açık', 'Aydınlık bir fincan bu', 'Telvelerin gülümsüyor'],
    mid: ['Fincanın konuşuyor', 'Hareketli bir fincan', 'Telvelerde bir hikâye var'],
    dark: ['Fincanın dolu dolu', 'Ağır ama bereketli bir fincan', 'Telveler çok şey anlatıyor']
  },

  symbols: [
    { id: 'kus', icon: '🕊️', name: 'Kuş', text: 'Fincanında bir kuş var; çok yakında bir haber kanatlanıp geliyor, hem de sevindirici.' },
    { id: 'yol', icon: '🛤️', name: 'Yol', text: 'Fincanın ortasından açık bir yol geçiyor. Bir yolculuk ya da yeni bir başlangıç kapında.' },
    { id: 'balik', icon: '🐟', name: 'Balık', text: 'Balık görünüyor; kısmet ve bereket demek. Beklemediğin yerden bir kazanç gelecek.' },
    { id: 'kalp', icon: '❤️', name: 'Kalp', text: 'Bir kalp belirmiş. Gönlünü meşgul eden biri seni de düşünüyor.' },
    { id: 'goz', icon: '🧿', name: 'Göz', text: 'Bir göz var, nazar değmiş sana. Bir dua oku, bir mavi boncuk tak, kıskananlar da var çevrende.' },
    { id: 'dag', icon: '⛰️', name: 'Dağ', text: 'Bir dağ yükseliyor. Önünde bir engel var ama aşacaksın, zirvede seni güzel bir manzara bekliyor.' },
    { id: 'yuzuk', icon: '💍', name: 'Yüzük', text: 'Halka şeklinde bir iz var; bir söz, bir nişan ya da bir anlaşma yakın.' },
    { id: 'anahtar', icon: '🗝️', name: 'Anahtar', text: 'Anahtar görünüyor. Uzun zamandır kapalı duran bir kapı açılacak, bir işin çözülecek.' },
    { id: 'agac', icon: '🌳', name: 'Ağaç', text: 'Kökleri sağlam bir ağaç var. Ailenden güç alacaksın, bir büyüğün duası arkanda.' },
    { id: 'yildiz', icon: '⭐', name: 'Yıldız', text: 'Parlak bir yıldız görünüyor; şansın açık, dileğin gökyüzüne ulaşmış.' },
    { id: 'kapi', icon: '🚪', name: 'Kapı', text: 'Bir kapı aralanmış. Yeni bir iş ya da yeni bir ev ihtimali var.' },
    { id: 'yilan', icon: '🐍', name: 'Yılan', text: 'Kıvrılmış bir yılan var; çevrende iki yüzlü biri olabilir. Sırlarını herkese açma.' },
    { id: 'at', icon: '🐎', name: 'At', text: 'Koşan bir at görünüyor; muradına ermene az kaldı, işlerin hızlanacak.' },
    { id: 'ay', icon: '🌙', name: 'Hilal', text: 'Bir hilal var; yeni bir dönem başlıyor, üç vakte kadar içine bir ferahlık dolacak.' },
    { id: 'cicek', icon: '🌸', name: 'Çiçek', text: 'Çiçek açmış; bir kutlama, bir sevinç ya da hoş bir sürpriz var.' },
    { id: 'kus2', icon: '🦅', name: 'Kartal', text: 'Kanatlarını açmış güçlü bir kuş var; yükseleceksin, emeğinin karşılığını alacaksın.' },
    { id: 'kopek', icon: '🐕', name: 'Köpek', text: 'Sadık bir dost figürü var. Zor anında yanında olacak biri hep orada.' },
    { id: 'ev', icon: '🏠', name: 'Ev', text: 'Bir ev şekli var; evinle ilgili bir değişiklik, belki bir taşınma ya da yenilenme var.' },
    { id: 'mektup', icon: '✉️', name: 'Zarf', text: 'Kare bir zarf görünüyor; resmi bir evrak ya da beklediğin bir mesaj gelecek.' },
    { id: 'kelebek', icon: '🦋', name: 'Kelebek', text: 'Bir kelebek var; hayatına hafiflik ve tatlı bir heyecan girecek.' }
  ],

  // Her kategori: low / mid / high skora göre havuz.
  sections: {
    genel: {
      icon: '🔮', title: 'Genel Enerji',
      low: [
        'Fincanın oldukça açık, içinde ağır bir yük yok. Son günlerde kafanı kurcalayan şeyler aslında sandığın kadar büyük değil; biraz nefes aldığında hepsinin yerine oturduğunu göreceksin.',
        'Telvelerin hafif ve dağınık; bu, ruhunun serbest kalmak istediğini gösteriyor. Kendine biraz vakit ayır, yeni bir sayfa açmaya hazırsın.'
      ],
      mid: [
        'Fincanın hareketli. Hayatında bir sürü şey aynı anda dönüyor ama kontrol sende. Ufak bir sabırla hepsini toparlayacaksın.',
        'Telveler dengeli dağılmış; içinde hem kaygı hem umut var. Ama umut ağır basıyor, kalbinin sesine kulak ver.'
      ],
      high: [
        'Fincanın dolu dolu, telveler yoğun. Omuzlarında epey yük var, bunu hissediyorum. Ama yoğun fincan bereketli fincandır; bu dönem bittiğinde emeğinin karşılığını katlayarak alacaksın.',
        'Koyu, kalın telveler var; çok düşünüyorsun, içine atıyorsun. Kafandakini biriyle paylaşınca nasıl hafiflediğine şaşıracaksın.'
      ]
    },
    ask: {
      icon: '💞', title: 'Aşk & Gönül',
      low: [
        'Gönül tarafında sakin sular var. Ama fincanın kenarında ince bir çizgi beliriyor: hiç beklemediğin bir anda biri dikkatini çekecek.',
        'Kalbin şu an kendini dinliyor. Acele etme; doğru kişi yolda, sen hazır olduğunda karşına çıkacak.'
      ],
      mid: [
        'Aklında biri var, değil mi? Fincanda iki figür birbirine bakıyor. Aranızdaki mesafe kısalıyor, ilk adımı atmaktan çekinme.',
        'Bir konuşma, bir mesaj bekliyorsun. Telveler diyor ki o mesaj gelecek; ama sen de gönlünü biraz aç.'
      ],
      high: [
        'Gönül işlerin yoğun! Seni seven, seni düşünen biri var ama söyleyemiyor. Küçük bir işaret ver, gerisi kendiliğinden gelecek.',
        'Aşk tarafında bir karar anı var. Kalbinle aklın biraz çatışıyor; fincan kalbinden yana. İçinden geleni yap.'
      ]
    },
    para: {
      icon: '💰', title: 'Para & Kısmet',
      low: [
        'Maddi konularda sakin bir dönem. Büyük harcamaları biraz ertele, üç vakte kadar bir rahatlama görünüyor.',
        'Para tarafı şimdilik idare eder ama fincanın dibinde bir ışık var: uzun vadede güzel bir kazanç.'
      ],
      mid: [
        'Fincanda ufak ufak telve taneleri var; bunlar para demek. Küçük ama sürekli bir kazanç kapısı açılıyor.',
        'İş tarafında bir teklif ya da bir fırsat görünüyor. Değerlendirmeden önce iyice düşün, ama kaçırma.'
      ],
      high: [
        'Tanecik tanecik telveler fincanını doldurmuş; kısmetin bol! Beklemediğin bir yerden para gelecek, ya da alacağın tahsil olacak.',
        'Bereketli bir fincan bu. Emeğinin karşılığını alacağın, cebinin rahatlayacağı bir dönem kapıda.'
      ]
    },
    haber: {
      icon: '🕊️', title: 'Yol & Haber',
      low: [
        'Uzaklardan sessizlik var ama bu kötü değil; beklediğin haber yolda, sadece biraz gecikiyor.',
        'Şimdilik yerinde sayıyormuş gibi hissetsen de fincanda kısa bir gezi görünüyor. Bir dostla yapılan plan gerçekleşecek.'
      ],
      mid: [
        'Fincanın kenarında açık bir yol var. Yakında bir yere gideceksin ya da biri sana gelecek. Hayırlı bir ziyaret.',
        'Bir telefon, bir mesaj... Yakın zamanda seni gülümsetecek bir haber alacaksın.'
      ],
      high: [
        'Yolların çok açık! Bir seyahat, bir taşınma ya da hayatını değiştirecek bir haber var. Kapı çalınınca hazır ol.',
        'Fincanın ağzında hareketli bir yol var; üç gün, üç hafta ya da üç ay içinde güzel bir haber kapında.'
      ]
    },
    ruh: {
      icon: '🌿', title: 'Sağlık & Ruh Hali',
      low: [
        'Ruhun hafif, enerjin yerinde. Bu güzel dönemi değerlendir; seni yoran şeylerden uzak dur.',
        'Fincan ferah, ruhun da öyle olmak istiyor. Biraz doğa, biraz uyku sana çok iyi gelecek.'
      ],
      mid: [
        'Biraz yorgunsun, belki uykuların düzensiz. Kendine nazik davran; küçük molalar büyük fark yaratacak.',
        'Kafan dolu ama kalbin sağlam. Sevdiğin bir şeyi yapmak için kendine izin ver.'
      ],
      high: [
        'Çok şeyi aynı anda taşıyorsun ve bu seni yoruyor. Bir süre "hayır" demeyi öğren; senin de dinlenmeye hakkın var.',
        'İçine attığın şeyler var. Bir dostla dertleşmek, bir gözyaşı bile sana iyi gelecek; sonrasında ferahlayacaksın.'
      ]
    },
    gelecek: {
      icon: '🌅', title: 'Yakın Gelecek',
      low: [
        'Önümüzdeki günler sakin ve huzurlu geçecek. Bu sakinlik, yakında gelecek güzel bir sürprizin habercisi.',
        'Fincanın dibi aydınlık. Uzun vadede seni güzel günler bekliyor; sabret, emeklerin boşa gitmeyecek.'
      ],
      mid: [
        'Yakın zamanda küçük bir değişiklik olacak; ilk başta tedirgin edebilir ama sonu hayır. Akışa güven.',
        'Bir karar vermen gerekecek. İki yol görünüyor, sağ taraftaki daha aydınlık; içindeki ses de onu söylüyor.'
      ],
      high: [
        'Hareketli günler geliyor! Hayatında yeni bir dönem başlıyor, eskiyi geride bırakmaya hazırsın.',
        'Büyük bir değişim kapıda. Korkma; fincan bu değişimin sana iyi geleceğini, yüzünü güldüreceğini söylüyor.'
      ]
    }
  },

  // Fincanın ağzı (yakın zaman) vs dibi (uzak zaman)
  timing: {
    near: 'Telveler fincanın ağzına yakın toplanmış; anlattıklarım çok yakında, belki günler içinde gerçekleşecek.',
    far: 'Telveler daha çok dibe çökmüş; bunlar biraz zaman alacak ama mutlaka olacak, aceleye gerek yok.',
    even: 'Telveler fincana eşit dağılmış; bazı şeyler hemen, bazıları ise zamanla olacak.'
  },
  sides: {
    right: 'Sağ taraf daha dolu; dışarıdan, çevrenden gelen etkiler ağır basıyor.',
    left: 'Sol taraf daha dolu; kalbine, iç dünyana ve evine dair meseleler öne çıkıyor.'
  },

  wish: {
    yes: ['Dileğin olacak!', 'Niyetin kabul!', 'Muradına ereceksin!'],
    soon: ['Biraz sabır, olacak', 'Dileğin yolda', 'Vakti gelince olacak'],
    yesText: [
      'Fincanın dibinde net bir açıklık var. Tuttuğun niyet hayırlısıyla gerçekleşecek.',
      'Telveler dileğinin önünü açmış. İnan ve bekle, sevindirici sonuç geliyor.'
    ],
    soonText: [
      'Dileğin kabul ama zamanı henüz gelmedi. Biraz daha sabır, sonra kendiliğinden gelecek.',
      'Niyetinin önünde küçük bir taş var; sen yürümeye devam et, o taş kendiliğinden kalkacak.'
    ]
  },

  loading: [
    'Fincan ısınıyor…',
    'Telveler okunuyor…',
    'Semboller beliriyor…',
    'Yollar, kuşlar, kalpler…',
    'Niyetine bakılıyor…'
  ]
};
