/**
 * Turkish, Turkmen and Russian text for the towel catalogue, and toRecord(), which
 * turns a plain (English) product into a stored record with { en, tr, tk, ru } fields.
 *
 * Used by scripts/export-products.ts (seed) and scripts/migrate-i18n.ts (one-off
 * conversion of data/products.json). New products get their translations in /admin.
 */
import type { L10n, L10nList, NameL10n, Product, ProductRecord } from "../src/types";

type T = { tr: string; tk: string; ru: string };

/* ------------------------------ per product ------------------------------ */

export const titles: Record<string, T> = {
  p14: { tr: "Bambu Banyo Havlusu Koleksiyonu", tk: "Bambuk hammam elsüpürgiç kolleksiýasy", ru: "Коллекция банных полотенец из бамбука" },
  p41: { tr: "Organik Pamuk Banyo Havlusu", tk: "Organiki pagta hammam elsüpürgiji", ru: "Банное полотенце из органического хлопка" },
  p42: { tr: "Türk Pamuğu Petek Havlu", tk: "Türk pagtasyndan wafli elsüpürgiç", ru: "Вафельное полотенце из турецкого хлопка" },
  p43: { tr: "Ekstra Yumuşak Otel Havlusu", tk: "Aýratyn ýumşak myhmanhana elsüpürgiji", ru: "Роскошное махровое отельное полотенце" },
  p44: { tr: "Fitilli Spa Havlusu", tk: "Zolakly spa elsüpürgiji", ru: "Рубчатое спа-полотенце" },
  p45: { tr: "Çizgili Peştemal", tk: "Zolakly hammam peştemaly", ru: "Полосатое полотенце для хаммама" },
  p46: { tr: "Büyük Boy Plaj Havlusu", tk: "Uly ölçegli plýaž elsüpürgiji", ru: "Большое пляжное полотенце" },
  p47: { tr: "Kum Tutmayan Mikrofiber Plaj Havlusu", tk: "Gum ýapyşmaýan mikrofiber plýaž elsüpürgiji", ru: "Пляжное полотенце из микрофибры, не собирающее песок" },
  p48: { tr: "Kapüşonlu Bebek Havlusu", tk: "Başlykly çaga elsüpürgiji", ru: "Детское полотенце с капюшоном" },
  p49: { tr: "Müslin Bebek Yıkama Bezleri, 6'lı Set", tk: "Muslin çaga ýuwunma ýaglyklary, 6 sanyly toplum", ru: "Муслиновые детские салфетки, набор из 6 шт." },
  p50: { tr: "Keten Kurulama Bezleri, 3'lü Set", tk: "Zygyr aşhana elsüpürgiçleri, 3 sanyly toplum", ru: "Льняные кухонные полотенца, набор из 3 шт." },
  p51: { tr: "Petek Mutfak Havluları, 4'lü Set", tk: "Wafli aşhana elsüpürgiçleri, 4 sanyly toplum", ru: "Вафельные кухонные полотенца, набор из 4 шт." },
  p52: { tr: "Tafting Pamuk Banyo Paspası", tk: "Tüýli pagta hammam halyçasy", ru: "Тафтинговый хлопковый коврик для ванной" },
  p53: { tr: "Çift Taraflı Banyo Halısı", tk: "Iki taraply hammam halyçasy", ru: "Двусторонний коврик для ванной" },
  p54: { tr: "Petek Bornoz", tk: "Wafli halat", ru: "Вафельный халат" },
  p55: { tr: "Şal Yakalı Peluş Bornoz", tk: "Şal ýakaly ýumşak halat", ru: "Махровый халат с шалевым воротником" },
  p56: { tr: "Temel Havlu Seti", tk: "Esasy elsüpürgiç toplumy", ru: "Базовый набор полотенец" },
  p57: { tr: "Spa Hafta Sonu Seti", tk: "Spa dynç günleri toplumy", ru: "Набор «Спа-выходные»" },
  p58: { tr: "Misafir Banyosu Seti", tk: "Myhman hammamy üçin toplum", ru: "Набор для гостевой ванной" },
};

export const taglines: Record<string, T> = {
  p14: { tr: "Hızlı kuruyan aile favorisi", tk: "Çalt guraýan, maşgalanyň halanýany", ru: "Быстросохнущий любимец всей семьи" },
  p41: { tr: "Her gün yumuşaklık, uzun ömürlü", tk: "Her günki ýumşaklyk, uzak hyzmat edýär", ru: "Мягкость на каждый день, на долгие годы" },
  p42: { tr: "Hızlı kurur, hafif ve havadar", tk: "Çalt guraýar, ýeňil we howaly", ru: "Быстро сохнет, лёгкое и воздушное" },
  p43: { tr: "İçine gömüleceğiniz yumuşaklık", tk: "Içine çümäýmeli ýumşaklyk", ru: "Глубокая, обволакивающая мягкость" },
  p44: { tr: "Dokulu, emici, dinlendirici", tk: "Dokmaly, suwy gowy siňdirýän, dynç berýän", ru: "Фактурное, впитывающее, восстанавливающее" },
  p45: { tr: "Banyo, plaj ya da piknik örtüsü", tk: "Hammam, plýaž ýa-da piknik ýapyny", ru: "Для ванной, пляжа или пикника" },
  p46: { tr: "Güneşte rahatça uzanmak için", tk: "Günüň aşagynda giňden ýatmak üçin", ru: "Можно вольготно растянуться на солнце" },
  p47: { tr: "Silkeleyince temizlenir, az yer kaplar", tk: "Silkeleseň arassalanýar, az ýer tutýar", ru: "Легко стряхивается, компактно складывается" },
  p48: { tr: "Banyo sonrası sıcacık kucaklaşmalar", tk: "Hammamdan soň mylaýym gujaklaşmalar", ru: "Уютные объятия после купания" },
  p49: { tr: "Hassas cilde nazik", tk: "Näzik deri üçin ýumşak", ru: "Бережно к нежной коже" },
  p50: { tr: "Tüy bırakmaz, zamanla güzelleşir", tk: "Tüý galdyrmaýar, wagt geçdigiçe gowulaşýar", ru: "Без ворса, с годами только лучше" },
  p51: { tr: "Yoğun mutfaklar için hızlı kuruyan", tk: "Işjeň aşhanalar üçin çalt guraýan", ru: "Быстро сохнут — для активной кухни" },
  p52: { tr: "Ayağınızın altında yumuşacık, çabuk kurur", tk: "Aýagyňyzyň astynda ýumşajyk, çalt guraýar", ru: "Мягкий под ногами, быстро сохнет" },
  p53: { tr: "İki görünüm, tek halı", tk: "Iki görnüş, bir halyça", ru: "Два образа — один коврик" },
  p54: { tr: "Tüy kadar hafif spa bornozu", tk: "Ýelek ýaly ýeňil spa halaty", ru: "Невесомый халат для спа-дня" },
  p55: { tr: "Sarınıp geçen hafta sonu sabahları", tk: "Dynç günleriniň mylaýym irdenleri", ru: "Уютные утра выходных" },
  p56: { tr: "2 banyo, 2 el, 2 yüz havlusu", tk: "2 hammam, 2 el, 2 ýüz elsüpürgiji", ru: "2 банных, 2 для рук, 2 для лица" },
  p57: { tr: "Bornoz, büyük banyo havlusu ve paspas", tk: "Halat, uly elsüpürgiç we halyça", ru: "Халат, большое полотенце и коврик" },
  p58: { tr: "Misafirler için hızlı kuruyan setler", tk: "Myhmanlar üçin çalt guraýan toplumlar", ru: "Быстросохнущие наборы для гостей" },
};

import { care, colours, materials, origins, sizes, weaves } from "../src/lib/term-translations";
export { care, colours, materials, origins, sizes, weaves };

export const highlights: Record<string, T> = {
  "OEKO-TEX certified, free from harmful substances": { tr: "OEKO-TEX sertifikalı, zararlı madde içermez", tk: "OEKO-TEX şahadatnamaly, zyýanly maddalardan azat", ru: "Сертификат OEKO-TEX, без вредных веществ" },
  "Pre-washed for softness from day one": { tr: "İlk günden yumuşak olması için önceden yıkanmıştır", tk: "Ilkinji günden ýumşak bolar ýaly öňünden ýuwulan", ru: "Предварительно выстирано — мягкое с первого дня" },
  "Absorbent loops that get fluffier with every wash": { tr: "Her yıkamada daha da kabaran emici ilmekler", tk: "Her ýuwulanda has-da ýumşaýan, suwy gowy siňdirýän ilmekler", ru: "Впитывающие петли становятся пышнее с каждой стиркой" },
  "Free personalisation on selected styles": { tr: "Seçili modellerde ücretsiz kişiselleştirme", tk: "Saýlanan görnüşlerde mugt şahsylaşdyrma", ru: "Бесплатная персонализация для отдельных моделей" },
  "Honeycomb weave that dries fast and stays light": { tr: "Hızlı kuruyan ve hafif kalan petek dokuma", tk: "Çalt guraýan we ýeňil galýan öýjükli dokma", ru: "Вафельное плетение быстро сохнет и остаётся лёгким" },
  "Flat weave that dries fast and packs small": { tr: "Hızlı kuruyan ve az yer kaplayan düz dokuma", tk: "Çalt guraýan we az ýer tutýan tekiz dokma", ru: "Гладкое плетение быстро сохнет и компактно складывается" },
  "Breathable double gauze that softens with every wash": { tr: "Her yıkamada yumuşayan, nefes alan çift katlı müslin", tk: "Her ýuwulanda ýumşaýan, howa geçirýän iki gatly muslin", ru: "Дышащий двойной муслин становится мягче с каждой стиркой" },
  "Washed linen that stays lint-free and softens with age": { tr: "Tüy bırakmayan, zamanla yumuşayan yıkanmış keten", tk: "Tüý galdyrmaýan, wagt geçdigiçe ýumşaýan ýuwlan zygyr", ru: "Стираный лён не оставляет ворса и со временем становится мягче" },
  "Sheds sand easily and dries in no time": { tr: "Kumu kolayca bırakır, çok çabuk kurur", tk: "Gumy aňsatlyk bilen goýberýär, gaty çalt guraýar", ru: "Легко стряхивает песок и сохнет в считаные минуты" },
  "Dense pile that dries quickly between baths": { tr: "Banyolar arasında çabuk kuruyan yoğun hav", tk: "Hammamlaryň arasynda çalt guraýan gür tüý", ru: "Плотный ворс быстро сохнет между купаниями" },
};

/** Same words as the texture filter and the quiz (messages → feels), lower-cased for mid-sentence use. */
const feels: Record<string, T> = {
  "Light & airy": { tr: "hafif ve havadar", tk: "ýeňil we howaly", ru: "лёгкая и воздушная" },
  "Soft & cosy": { tr: "yumuşak ve sıcak", tk: "ýumşak we mylaýym", ru: "мягкая и уютная" },
  "Plush & indulgent": { tr: "kabarık ve şımartıcı", tk: "galyň we ýakymly", ru: "пышная и роскошная" },
  "Crisp & structured": { tr: "diri ve dokulu", tk: "berk we dokmaly", ru: "плотная и упругая" },
  "Smooth & sleek": { tr: "pürüzsüz ve zarif", tk: "ýylmanak we owadan", ru: "гладкая и изящная" },
};

/* ------------------------------ generated text ------------------------------ */

/** "Chest 86–91 cm" / "2 bath towels, 2 hand towels" … */
export function noteL10n(note: string): L10n {
  const chest = note.match(/^Chest (.+) cm$/);
  if (chest) return { en: note, tr: `Göğüs ${chest[1]} cm`, tk: `Döş ${chest[1]} sm`, ru: `Обхват груди ${chest[1]} см` };
  const known: Record<string, T> = {
    "2 bath towels, 2 hand towels": { tr: "2 banyo havlusu, 2 el havlusu", tk: "2 hammam elsüpürgiji, 2 el elsüpürgiji", ru: "2 банных полотенца, 2 полотенца для рук" },
    "2 bath towels, 2 hand towels, 2 face cloths": {
      tr: "2 banyo havlusu, 2 el havlusu, 2 yüz havlusu",
      tk: "2 hammam elsüpürgiji, 2 el elsüpürgiji, 2 ýüz elsüpürgiji",
      ru: "2 банных полотенца, 2 полотенца для рук, 2 полотенца для лица",
    },
    "2 bath sheets, 2 bath towels, 2 hand towels, 2 face cloths": {
      tr: "2 büyük banyo havlusu, 2 banyo havlusu, 2 el havlusu, 2 yüz havlusu",
      tk: "2 uly hammam elsüpürgiji, 2 hammam elsüpürgiji, 2 el elsüpürgiji, 2 ýüz elsüpürgiji",
      ru: "2 больших банных полотенца, 2 банных полотенца, 2 полотенца для рук, 2 полотенца для лица",
    },
    "Bathrobe, bath sheet and bath mat": {
      tr: "Bornoz, büyük banyo havlusu ve banyo paspası",
      tk: "Halat, uly hammam elsüpürgiji we hammam halyçasy",
      ru: "Халат, большое банное полотенце и коврик для ванной",
    },
  };
  return { en: note, ...(known[note] ?? {}) };
}

export function featureL10n(f: string): T | undefined {
  const pct = f.match(/^100% (.+)$/);
  if (pct) {
    const m = Object.entries(materials).find(([k]) => k.toLowerCase() === pct[1].toLowerCase());
    if (m) return { tr: `%100 ${m[1].tr.toLocaleLowerCase("tr")}`, tk: `100% ${m[1].tk.toLowerCase()}`, ru: `100% ${m[1].ru.toLocaleLowerCase("ru")}` };
  }
  const gsm = f.match(/^(\d+) GSM – (.+)$/);
  if (gsm) {
    const words: Record<string, T> = {
      "plush & heavy": { tr: "dolgun ve ağır", tk: "galyň we agyr", ru: "пышное и плотное" },
      "soft & absorbent": { tr: "yumuşak ve emici", tk: "ýumşak we suwy gowy siňdirýän", ru: "мягкое и впитывающее" },
      "light & airy": { tr: "hafif ve havadar", tk: "ýeňil we howaly", ru: "лёгкое и воздушное" },
    };
    const w = words[gsm[2]];
    if (w) return { tr: `${gsm[1]} GSM – ${w.tr}`, tk: `${gsm[1]} GSM – ${w.tk}`, ru: `${gsm[1]} GSM – ${w.ru}` };
  }
  const fixed: Record<string, T> = {
    "Recycled microfibre": { tr: "Geri dönüştürülmüş mikrofiber", tk: "Gaýtadan işlenen mikrofiber", ru: "Переработанная микрофибра" },
    "Bamboo-cotton blend": { tr: "Bambu-pamuk karışımı", tk: "Bambuk-pagta garyndysy", ru: "Смесь бамбукового волокна и хлопка" },
    "Quick-drying": { tr: "Hızlı kuruyan", tk: "Çalt guraýar", ru: "Быстро сохнет" },
    "Gets softer with every wash": { tr: "Her yıkamada daha da yumuşar", tk: "Her ýuwulanda has-da ýumşaýar", ru: "Становится мягче с каждой стиркой" },
    "Machine wash 40°C": { tr: "40°C'de makinede yıkanabilir", tk: "40°C-de maşynda ýuwmak bolýar", ru: "Машинная стирка при 40 °C" },
    "Machine wash 30°C": { tr: "30°C'de makinede yıkanabilir", tk: "30°C-de maşynda ýuwmak bolýar", ru: "Машинная стирка при 30 °C" },
    ...highlights,
  };
  return fixed[f];
}

/** Middle sentence by fabric: pre-washed (most), washed linen, knitted microfibre. */
const descriptionBody: Record<"default" | "linen" | "microfibre", T> = {
  default: {
    tr: "Önceden yıkandığı için ilk kullanımdan itibaren yumuşaktır; her gün kullanılmak ve her yıkamada daha da güzelleşmek için üretildi.",
    tk: "Öňünden ýuwulandygy üçin ilkinji ulanyşdan ýumşak; her gün ulanmak we her ýuwulanda has gowulaşmak üçin döredildi.",
    ru: "Изделие предварительно выстирано, поэтому мягкое с первого использования; создано для ежедневного использования и становится лучше с каждой стиркой.",
  },
  linen: {
    tr: "Yıkanmış keten sayesinde ilk günden yumuşaktır; her gün kullanılmak ve zamanla daha da güzelleşmek için üretildi.",
    tk: "Ýuwlan zygyrdan bolany üçin ilkinji günden ýumşak; her gün ulanmak we wagt geçdigiçe has gowulaşmak üçin döredildi.",
    ru: "Стираный лён мягкий с первого дня; изделие создано для ежедневного использования и со временем становится только лучше.",
  },
  microfibre: {
    tr: "Örme mikrofiberden yapılmıştır; her gün kullanılmak ve çok çabuk kurumak için üretildi.",
    tk: "Örülen mikrofiberden ýasaldy; her gün ulanmak we gaty çalt guramak üçin döredildi.",
    ru: "Связано из микрофибры; создано для ежедневного использования и сохнет в считаные минуты.",
  },
};

export function descriptionL10n(p: Pick<Product, "feel" | "weightGsm" | "brand" | "description" | "material">, title: T, tagline: T): L10n {
  const m = p.material.toLowerCase();
  const body = descriptionBody[m.includes("microfibre") ? "microfibre" : m.includes("linen") ? "linen" : "default"];
  const feel = feels[p.feel];
  const gsmRu = p.weightGsm ? `Плотность ${p.weightGsm} GSM, текстура ${feel?.ru ?? ""}. ` : "";
  const lowerFirst = (t: string) => t.charAt(0).toLocaleLowerCase("ru") + t.slice(1);
  const gsmTr = p.weightGsm ? `${p.weightGsm} GSM ağırlığında, ${feel?.tr ?? ""} bir dokuya sahip. ` : "";
  const gsmTk = p.weightGsm ? `${p.weightGsm} GSM agramly, ${feel?.tk ?? ""} dokmasy bar. ` : "";
  return {
    en: p.description,
    tr: `${p.brand} imzalı ${title.tr}: ${tagline.tr.toLocaleLowerCase("tr")}. ${gsmTr}${body.tr}`,
    tk: `${p.brand} brendiniň ${title.tk}: ${tagline.tk.toLocaleLowerCase("tk")}. ${gsmTk}${body.tk}`,
    ru: `${title.ru} от ${p.brand}: ${lowerFirst(tagline.ru)}. ${gsmRu}${body.ru}`,
  };
}

const LANGS = ["tr", "tk", "ru"] as const;

export const l10n = (en: string, t?: T): L10n => ({ en, ...(t ? { tr: t.tr, tk: t.tk, ru: t.ru } : {}) });
export const names = (name: string, dict: Record<string, T>): NameL10n | undefined =>
  dict[name] ? { tr: dict[name].tr, tk: dict[name].tk, ru: dict[name].ru } : undefined;

/** A list is translated only when every line has a translation (otherwise English is shown). */
export function listL10n(list: string[], translate: (s: string) => T | undefined): L10nList {
  const out: L10nList = { en: list };
  for (const l of LANGS) {
    const lines = list.map((x) => translate(x)?.[l]);
    if (lines.every(Boolean)) out[l] = lines as string[];
  }
  return out;
}

/** Plain English product → stored record with Turkish, Turkmen and Russian text. */
export function toRecord(p: Product): ProductRecord {
  const title = titles[p.id];
  const tagline = taglines[p.id];
  return {
    ...p,
    title: l10n(p.title, title),
    tagline: l10n(p.tagline, tagline),
    description: title && tagline ? descriptionL10n(p, title, tagline) : { en: p.description },
    features: listL10n(p.features, featureL10n),
    highlights: listL10n(p.highlights, (h) => highlights[h]),
    material: l10n(p.material, materials[p.material]),
    weave: p.weave ? l10n(p.weave, weaves[p.weave]) : undefined,
    origin: p.origin ? l10n(p.origin, origins[p.origin]) : undefined,
    careInstructions: p.careInstructions.map((c) => ({ kind: c.kind, text: l10n(c.text, care[c.text]) })),
    sizes: p.sizes.map(({ label: _l, note, ...s }) => ({ ...s, labels: names(s.name, sizes), note: note ? noteL10n(note) : undefined })),
    variants: {
      ...p.variants,
      colors: p.variants.colors?.map(({ label: _l, ...c }) => ({ ...c, labels: names(c.name, colours) })),
    },
  } as ProductRecord;
}
