// ROKTOK — Languages + Natural Language Performance Mode phrase banks
// Demo dialogue banks give the prototype authentic-feeling lines in priority languages.
// When a connected TEXT provider is available, the script engine upgrades automatically.

export const LANGUAGES = [
  { id: 'en', name: 'English', native: 'English', locale: 'en-US', dir: 'ltr', tts: 'en-US', bank: true },
  { id: 'ps', name: 'Pashto', native: 'پښتو', locale: 'ps-AF', dir: 'ltr', tts: 'ps-AF', bank: true, performanceMode: true },
  { id: 'ur', name: 'Urdu', native: 'اردو', locale: 'ur-PK', dir: 'rtl', tts: 'ur-PK', bank: true, performanceMode: true },
  { id: 'ar', name: 'Arabic', native: 'العربية', locale: 'ar-SA', dir: 'rtl', tts: 'ar-SA', bank: true, performanceMode: true },
  { id: 'hi', name: 'Hindi', native: 'हिन्दी', locale: 'hi-IN', dir: 'ltr', tts: 'hi-IN', bank: true },
  { id: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', locale: 'pa-IN', dir: 'ltr', tts: 'pa-IN', bank: true },
  { id: 'fa', name: 'Persian', native: 'فارسی', locale: 'fa-IR', dir: 'rtl', tts: 'fa-IR', bank: true },
  { id: 'tr', name: 'Turkish', native: 'Türkçe', locale: 'tr-TR', dir: 'ltr', tts: 'tr-TR', bank: true },
  { id: 'bn', name: 'Bengali', native: 'বাংলা', locale: 'bn-BD', dir: 'ltr', tts: 'bn-BD', bank: true },
  { id: 'fr', name: 'French', native: 'Français', locale: 'fr-FR', dir: 'ltr', tts: 'fr-FR', bank: true },
  { id: 'es', name: 'Spanish', native: 'Español', locale: 'es-ES', dir: 'ltr', tts: 'es-ES', bank: true },
  { id: 'de', name: 'German', native: 'Deutsch', locale: 'de-DE', dir: 'ltr', tts: 'de-DE', bank: true },
  { id: 'zh', name: 'Chinese', native: '中文', locale: 'zh-CN', dir: 'ltr', tts: 'zh-CN', bank: true },
  { id: 'ja', name: 'Japanese', native: '日本語', locale: 'ja-JP', dir: 'ltr', tts: 'ja-JP', bank: true },
  { id: 'ko', name: 'Korean', native: '한국어', locale: 'ko-KR', dir: 'ltr', tts: 'ko-KR', bank: true },
  { id: 'pt', name: 'Portuguese', native: 'Português', locale: 'pt-BR', dir: 'ltr', tts: 'pt-BR', bank: true },
  { id: 'ru', name: 'Russian', native: 'Русский', locale: 'ru-RU', dir: 'ltr', tts: 'ru-RU', bank: true }
];
export const langById = id => LANGUAGES.find(l => l.id === id) || LANGUAGES[0];

// Detect the language of a free-text brief
export function detectLanguage(text = '') {
  const t = text.toLowerCase();
  if (/pashto|پښتو|پشتو|pakhtun|pashtun/.test(t)) return 'ps';
  if (/urdu|اردو/.test(t)) return 'ur';
  if (/arabic|عربی|العربية(?!.{0,40}drama)/.test(t)) return 'ar';
  if (/hindi|हिन्दी/.test(t)) return 'hi';
  if (/punjabi|ਪੰਜਾਬੀ/.test(t)) return 'pa';
  if (/persian|farsi|فارسی/.test(t)) return 'fa';
  if (/turkish|türkçe/.test(t)) return 'tr';
  if (/bengali|bangla|বাংলা/.test(t)) return 'bn';
  if (/[؀-ۿ]/.test(text)) {
    // crude arabic-script split: Urdu has ٹ ڈ ڑ ں ے گ چ پ ژ
    if (/[ٹڈڑںےگچپژ]/.test(text)) return 'ur';
    if (/[پچژگ]/.test(text) && !/[أإ]/.test(text)) return 'ps';
    return 'ar';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Phrase banks: theme -> array of dialogue lines (spoken, natural, conversational)
// tone: conflict | emotion | reconcile | neutral | hook | narration
// ---------------------------------------------------------------------------
export const PHRASE_BANKS = {
  ps: {
    hook: [
      'دا ځمکه زموږ د پلار وو، هېرې شو!',
      'نن په دې کنيز کې یو ژبه پورې وړاندې شي!',
      'د زوی جګونه تر اوسه په منډو کې دي.'
    ],
    conflict: [
      'برور، پدې ځمکې کې زما هېوادې حق شته.',
      'پلار پر موږ دوې وړانګې ورکړل — تا یوازې درې غواړي؟',
      'زه با له تا نه نه خبره نه ګرهیم، خپلواکیم.',
      'هغه وخت ته څه ورکړي، هغه ځمکه زما دی!',
      'نه شې یې پرېږدای شه، ما ته رامنه!',
      'تا په هیچ بڼه نه باید لګ ورکړي.'
    ],
    emotion: [
      'ما ته درد لری، خو زړه نه باید ورک شي.',
      'پلار که وو په غبرګ کې، موږ یو کیس نه وو.',
      'د عزت خاطر ټول ځنډمه با منځ ته راوړل.',
      'زما وینا ګڼه مه کړه، زه ښه منظور لرم.'
    ],
    reconcile: [
      'ژبهیې پر موږ لګېدله، زه بخښنه غواړم.',
      'مونږ دوې زوی یو پلار لرو — دا ځمکه موږ ګډه وساتو.',
      'سلامتی بیا راته، برور.'
    ],
    neutral: [
      'سلام، تاسو خیري شئ؟',
      'لاندې راشه، خبرې کړو.',
      'به خیر، خدا ساتي.',
      'زه اوس رام ته راشم.'
    ],
    narrator: [
      'په دې ورځو کې، د کوهونو منځ کې یو کلي او یو وینا وشوه.',
      'باد په کلي کې وژي، خو منډې بې خبره وو.'
    ]
  },
  ur: {
    hook: ['یہ زمین باپ کی تھی — اب دونوں بھائیوں میں تقسیم ہوگی!', 'آج کلے میں ایک بات کھلے کی جائے گی!', 'بڑے بھائی کا غم ابھی تک اس کے چہرے پر ہے۔'],
    conflict: ['بھائی، اس زمین میرا حق ہے۔', 'باپ نے ہم دوں کو حصے دیے تھے، تم تینوں چاہتے ہو؟', 'میں اب تم سے بات نہیں کروں گا، آزاد ہوں۔', 'وہ زمین میری ہے، تم ہاتھ نہ لگاؤ۔', 'نہیں، اسے چھوڑنا نہیں ہے!'],
    emotion: ['میرا دل درد کر رہا ہے، پر ایمان نہیں ہارنا۔', 'باپ ہمارے پیشِ نظر ہوں گے، ہم ایک نہیں تھے۔', 'تعزیر کی خاطر سب باتیں سامنے آئیں۔'],
    reconcile: ['غصہ مجھ پر آگیا، معاف کیجیے۔', 'ہم دونوں ایک باپ کے بیٹے ہیں، یہ زمین مل کر رکھیں گے۔', 'پھر سے ملاقات ہوگی، بھائی۔'],
    neutral: ['السلام علیکم، خیریت ہے؟', 'اندر آئیے، باتیں کرتے ہیں۔', 'ٹھیک ہے، خدا حافظ۔'],
    narrator: ['اس دن پہاڑوں کے درمیان ایک گاؤں میں ایک بات شروع ہوئی۔', 'ہوا گاؤں میں چل رہی تھی، مگر فیصلے ابھی باقی تھے۔']
  },
  ar: {
    hook: ['هذه الأرض كانت لأبينا، والآن يتشاجر عليها ابناه!', 'اليوم ستُقال كلمة صريحة في القرية!', 'حزن الأخ الأكبر ما زال على وجهه.'],
    conflict: ['أخي، لي نصيب في هذه الأرض.', 'أبناها حصتين، فأنت تريد ثلاثاً؟', 'لن أعتمد عليك بعد اليوم، أنا حر.', 'هذه الأرض لي، لا تقترب منها!', 'لن أترك الحقّ أبداً.'],
    emotion: ['قلبي متعب، لكن إيماني لا يضعف.', 'كنا نحن الاثنان أمام أبينا يومها.', 'الكرامة جعلت كل الكلام يظهر الآن.'],
    reconcile: ['الغضب غلبني، أطلب منك الصفح.', 'نحن ابنا أب واحد، ونحفظ هذه الأرض معاً.', 'نلتقي مجدداً يا أخي.'],
    neutral: ['السلام عليكم، كيف حالك؟', 'تعال نتحدث في الداخل.', 'على الخير، في حفظ الله.'],
    narrator: ['في تلك الأيام، بين الجبال، بدأت كلمة في قرية صغيرة.', 'الريح كانت تمرّ في القرية، لكن القرار لم يُحسم بعد.']
  },
  en: {
    hook: ['This land was our father\'s — and now his two sons are fighting over it.', 'Today, one truth will come out in the open!', 'The elder brother\'s grief is still written on his face.'],
    conflict: ['Brother, I have a rightful share in this land.', 'Father divided it in two — now you want three portions?', 'I won\'t listen to you anymore. I\'m done.', 'That field is mine — don\'t touch it.', 'I won\'t let go of what\'s mine!'],
    emotion: ['My heart hurts, but I won\'t break.', 'We were both standing in front of Father that day.', 'Pride put every harsh word in my mouth.'],
    reconcile: ['Anger got the better of me — forgive me.', 'We are two sons of one father. Let\'s keep this land together.', 'We\'ll meet again, brother.'],
    neutral: ['Salam — are you well?', 'Come inside, let\'s talk.', 'All is well, God willing.'],
    narrator: ['In those days, between the mountains, an argument began in a small village.', 'Wind moved through the village, but the decision was still unresolved.']
  },
  hi: {
    hook: ['यह ज़मीन हमारे पिता की थी — और अब दो बेटे उस पर लड़ रहे हैं!', 'आज एक बात खुलकर कही जाएगी!', 'बड़े भाई का दुख अब भी चेहरे पर है।'],
    conflict: ['भाई, इस ज़मीन में मेरा हक़ है।', 'बाप ने दो हिस्से किए थे — अब तीन चाहते हो?', 'अब मैं तुमसे बात नहीं करूँगा।', 'वह खेत मेरा है, हाथ मत लगाओ।'],
    emotion: ['दिल दुख रहा है, पर हिम्मत नहीं हारूँगा।', 'उस दिन हम दोनों बाप के सामने थे।'],
    reconcile: ['ग़ुस्सा मुझ पर हावी हो गया — माफ़ करना।', 'हम दोनों एक बाप के बेटे हैं, ज़मीन साथ रखेंगे।'],
    neutral: ['सलाम, आप ठीक हैं?', 'अंदर आइए, बात करते हैं।'],
    narrator: ['उन दिनों पहाड़ों के बीच एक छोटे गाँव में बहस शुरू हुई।']
  },
  tr: hookish(), ur_dummy: null
};
function hookish() {
  return {
    hook: ['Bu toprak babamızındı — ve şimdi iki oğul tartışıyor!', 'Bugün ortaya bir gerçek çıkacak!'],
    conflict: ['Kardeş, bu toprakta benim payım var.', 'Baba ikiye böldü — sen üçünü mü istiyorsun?', 'Artık seni dinlemiyorum.'],
    emotion: ['Kalbim acıyor ama dağılmayacağım.'],
    reconcile: ['Öfke beni aldı, beni affet.', 'Biz bir babanın iki oğluyuz.'],
    neutral: ['Selam, nasılsın?', 'İçeri gel, konuşalım.'],
    narrator: ['O günlerde dağların arasında küçük bir köyde bir tartışma başladı.']
  };
}
// small generic banks for the remaining languages
const generic = lines => ({ hook: [lines[0], lines[1]], conflict: [lines[2], lines[3]], emotion: [lines[4]], reconcile: [lines[5]], neutral: [lines[6], lines[7]], narrator: [lines[8]] });
PHRASE_BANKS.fa = generic(['این زمین پدر ما بود — و حالا دو پسر بر سر آن نزاع دارند!', 'امروز یک حقیقت آشکار می‌شود!', 'برادر، در این زمین سهم من هست.', 'پدر دو قسمت کرد — تو سه تا می‌خواهی؟', 'دلم درد می‌کند ولی نمی‌شکنم.', 'خشم بر من غلبه کرد — مرا ببخش.', 'سلام، حالتان خوب است؟', 'بیایید داخل حرف بزنیم.', 'در آن روزها، میان کوه‌ها، بحثی آغاز شد.']);
PHRASE_BANKS.pa = generic(['ਇਹ ਜ਼ਮੀਨ ਸਾਡੇ ਪਿਤਾ ਦੀ ਸੀ — ਹੁਣ ਦੋ ਭਰਾ ਲਡ਼ ਰਹੇ ਹਨ!', 'ਅੱਜ ਇੱਕ ਗੱਲ ਖੁੱਲ੍ਹ ਕੇ ਕਹੀ ਜਾਵੇਗੀ!', 'ਭਰਾ, ਇਸ ਜ਼ਮੀਨ ਵਿੱਚ ਮੇਰਾ ਹੱਕ ਹੈ।', 'ਪਿਤਾ ਨੇ ਦੋ ਹਿੱਸੇ ਕੀਤੇ — ਤੂੰ ਤਿੰਨ ਚਾਹੁੰਦਾ ਹੈ?', 'ਦਿਲ ਦੁਖ ਰਿਹਾ ਹੈ, ਪਰ ਹਿੰਮਤ ਨਹੀਂ ਹਾਰਾਂਗਾ।', 'ਗੁੱਸਾ ਮੇਰੇ ਉੱਤੇ ਹਾਵੀ ਹੋ ਗਿਆ — ਮਾਫ਼ ਕਰਨਾ।', 'ਸਲਾਮ, ਠੀਕ ਹੋ?', 'ਅੰਦਰ ਆਓ, ਗੱਲਾਂ ਕਰੀਏ।', 'ਉਨ੍ਹਾਂ ਦਿਨਾਂ ਪਹਾੜਾਂ ਵਿਚਕਾਰ ਇੱਕ ਪਿੰਡ ਵਿੱਚ ਬਹਿਸ ਸ਼ੁਰੂ ਹੋਈ।']);
PHRASE_BANKS.fr = generic(['Cette terre était celle de notre père — et ses deux fils se disputent !', 'Aujourd\'hui, une vérité sera dite !', 'Frère, j\'ai un droit sur cette terre.', 'Père l\'a divisée en deux — tu en veux trois ?', 'Mon cœur fait mal, mais je ne plierai pas.', 'La colère m\'a submergé — pardonne-moi.', 'Salam, ça va ?', 'Entrons, parlons.', 'Ces jours-là, au milieu des montagnes, une dispute commença.']);
PHRASE_BANKS.es = generic(['Esta tierra era de nuestro padre — ¡y ahora sus dos hijos discuten!', '¡Hoy se dirá una verdad!', 'Hermano, tengo un derecho en esta tierra.', 'Padre la dividió en dos — ¿y tú quieres tres?', 'Me duele el corazón, pero no me romperé.', 'La ira me dominó — perdóname.', 'Salam, ¿estás bien?', 'Pasemos y hablemos.', 'Aquellos días, entre las montañas, comenzó una discusión.']);
PHRASE_BANKS.de = generic(['Dieses Land gehörte unserem Vater — und jetzt streiten sich seine Söhne!', 'Heute kommt die Wahrheit ans Licht!', 'Bruder, ich habe einen Anteil an diesem Land.', 'Vater teilte es in zwei — du willst drei?', 'Mein Herz tut weich, aber ich breche nicht.', 'Der Zorn hat mich erobert — verzeih mir.', 'Salam, geht\'s dir?', 'Komm rein, wir reden.', 'Jene Tage, zwischen den Bergen, begann ein Streit.']);
PHRASE_BANKS.zh = generic(['这片地是父亲的——如今两个儿子却为此争吵！', '今天，一个真相将被公开！', '兄弟，这片地有我的份额。', '父亲分成了两份——你想要三份？', '心很痛，但我不会垮。', '怒火控制了我——请原谅。', '你好吗？', '进来，我们谈谈。', '那些日子，在群山之间，一个小村庄里争吵开始了。']);
PHRASE_BANKS.ja = generic(['この土地は父のものだった — 今や二人の息子が争っている！', '今日、真実が語られる！', '兄さん、この土地には私の份がある。', '父は二つに分けた — 君は三つ欲しいのか？', '心が痛むが、負けない。', '怒りに飲まれた — 許してくれ。', 'こんにちは、元気？', '中へ入って話そう。', 'あの頃、山あいの小さな村で言い争いが始まった。']);
PHRASE_BANKS.ko = generic(['이 땅은 아버지의 것이었는데 — 지금 두 아들이 다투고 있다!', '오늘 진실이 드러난다!', '형, 이 땅에는 내 몫이 있다.', '아버지가 둘로 나눴는데 — 넌 셋을 원하니?', '가슴이 아프지만 굽히지 않겠다.', '화가 나를 삼켰다 — 용서해 줘.', '안녕, 잘 지내?', '들어와서 얘기하자.', '그 시절, 산 사이 작은 마을에서 다툼이 시작됐다.']);
PHRASE_BANKS.pt = generic(['Esta terra era do nosso pai — e agora seus dois filhos discutem!', 'Hoje uma verdade vai à tona!', 'Irmão, tenho um direito nesta terra.', 'Pai dividiu em dois — e você quer três?', 'Meu coração dói, mas não vou quebrar.', 'A raiva me dominou — perdoe-me.', 'Salam, tudo bem?', 'Entre, vamos conversar.', 'Naqueles dias, entre as montanhas, começou uma discussão.']);
PHRASE_BANKS.ru = generic(['Эта земля была отца — и теперь два сына ссорятся на ней!', 'Сегодня правда выйдет наружу!', 'Брат, у меня есть доля в этой земле.', 'Отец разделил её надвое — а ты хочешь три?', 'Сердце болит, но я не сломаюсь.', 'Гнев взял верх — прости меня.', 'Салам, как ты?', 'Проходи, поговорим.', 'В те дни, среди гор, в маленькой деревне начался спор.']);

export function bankFor(lang, theme) {
  const b = PHRASE_BANKS[lang] || PHRASE_BANKS.en;
  if (theme === 'land_conflict' && b.conflict) return b;
  return b;
}

export const UI_STRINGS = {
  en: { home: 'Home', create: 'Create', projects: 'Projects', settings: 'Settings', quickCreate: 'Quick Create', makeEverything: 'MAKE EVERYTHING' },
  ps: { home: 'کور', create: 'جوړول', projects: 'پروژې', settings: 'تنظیمات', quickCreate: 'چټک جوړول', makeEverything: 'ټول چې جوړ کړئ' },
  ur: { home: 'ہوم', create: 'بنائیں', projects: 'پروجیکٹس', settings: 'ترتیبات', quickCreate: 'کوئیک کرییٹ', makeEverything: 'سب کچھ بناؤ' },
  ar: { home: 'الرئيسية', create: 'إنشاء', projects: 'المشاريع', settings: 'الإعدادات', quickCreate: 'إنشاء سريع', makeEverything: 'اصنع كل شيء' },
  hi: { home: 'होम', create: 'बनाएँ', projects: 'प्रोजेक्ट्स', settings: 'सेटिंग्स', quickCreate: 'क्विक क्रिएट', makeEverything: 'सब कुछ बनाओ' }
};
export function ui(key) { const s = UI_STRINGS[getUiLang()] || UI_STRINGS.en; return s[key] || (UI_STRINGS.en[key] ?? key); }
let _uiLang = 'en';
export function setUiLang(l) { _uiLang = l; }
export function getUiLang() { return _uiLang; }
