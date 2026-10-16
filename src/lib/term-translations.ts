/**
 * Turkish / Turkmen / Russian names for the catalogue's shared terms (colours, sizes,
 * materials, weaves, origins, care lines). Used by the seed scripts and by the
 * admin form to pre-fill translations when a known term is entered.
 */
import type { L10n, NameL10n } from "@/types";

type T = { tr: string; tk: string; ru: string };

export const colours: Record<string, T> = {
  Chalk: { tr: "Tebeşir", tk: "Hek", ru: "Меловой" },
  Oat: { tr: "Yulaf", tk: "Süle", ru: "Овсяный" },
  Sand: { tr: "Kum", tk: "Gum", ru: "Песочный" },
  Stone: { tr: "Taş", tk: "Daş", ru: "Каменный" },
  Slate: { tr: "Arduvaz", tk: "Şifer", ru: "Сланцевый" },
  Charcoal: { tr: "Kömür", tk: "Kömür", ru: "Угольный" },
  Midnight: { tr: "Gece", tk: "Ýary gije", ru: "Полночный синий" },
  Sage: { tr: "Adaçayı", tk: "Şalfeý", ru: "Шалфей" },
  Olive: { tr: "Zeytin", tk: "Zeýtun", ru: "Оливковый" },
  Lagoon: { tr: "Lagün", tk: "Laguna", ru: "Лагуна" },
  Mist: { tr: "Sis", tk: "Duman", ru: "Туманный" },
  Ink: { tr: "Mürekkep", tk: "Syýa", ru: "Чернильный" },
  Blush: { tr: "Pudra", tk: "Açyk gülgüne", ru: "Пудровый" },
  Rose: { tr: "Gül", tk: "Gülgüne", ru: "Розовый" },
  Clay: { tr: "Kil", tk: "Toýun", ru: "Глиняный" },
  Rust: { tr: "Pas", tk: "Pos", ru: "Ржавый" },
};

export const sizes: Record<string, T> = {
  "Face cloth": { tr: "Yüz havlusu", tk: "Ýüz elsüpürgiji", ru: "Полотенце для лица" },
  "Hand towel": { tr: "El havlusu", tk: "El elsüpürgiji", ru: "Полотенце для рук" },
  "Bath towel": { tr: "Banyo havlusu", tk: "Hammam elsüpürgiji", ru: "Банное полотенце" },
  "Bath sheet": { tr: "Büyük banyo havlusu", tk: "Uly hammam elsüpürgiji", ru: "Большое банное полотенце" },
  "One size": { tr: "Tek ebat", tk: "Ýeke ölçeg", ru: "Единый размер" },
  "4-piece": { tr: "4 parça set", tk: "4 bölekli toplum", ru: "Набор из 4 предметов" },
  "6-piece": { tr: "6 parça set", tk: "6 bölekli toplum", ru: "Набор из 6 предметов" },
  "8-piece": { tr: "8 parça set", tk: "8 bölekli toplum", ru: "Набор из 8 предметов" },
};

export const materials: Record<string, T> = {
  "Bamboo-cotton blend": { tr: "Bambu-pamuk karışımı", tk: "Bambuk-pagta garyndysy", ru: "Смесь бамбукового волокна и хлопка" },
  "Organic cotton": { tr: "Organik pamuk", tk: "Organiki pagta", ru: "Органический хлопок" },
  "Turkish cotton": { tr: "Türk pamuğu", tk: "Türk pagtasy", ru: "Турецкий хлопок" },
  "Egyptian cotton": { tr: "Mısır pamuğu", tk: "Müsür pagtasy", ru: "Египетский хлопок" },
  "Cotton velour": { tr: "Pamuklu kadife", tk: "Pagta welýur", ru: "Хлопковый велюр" },
  "Recycled microfibre": { tr: "Geri dönüştürülmüş mikrofiber", tk: "Gaýtadan işlenen mikrofiber", ru: "Переработанная микрофибра" },
  "Organic cotton muslin": { tr: "Organik pamuk müslin", tk: "Organiki pagta muslin", ru: "Муслин из органического хлопка" },
  "Washed linen": { tr: "Yıkanmış keten", tk: "Ýuwlan zygyr", ru: "Стираный лён" },
  "Cotton waffle": { tr: "Pamuklu petek dokuma", tk: "Pagta wafli matasy", ru: "Хлопковое вафельное полотно" },
  "Combed cotton": { tr: "Penye pamuk", tk: "Daralan pagta", ru: "Чёсаный хлопок" },
  "Cotton chenille": { tr: "Pamuklu şönil", tk: "Pagta şenil", ru: "Хлопковая синель" },
  "Turkish cotton waffle": { tr: "Türk pamuğu petek dokuma", tk: "Türk pagtasy wafli matasy", ru: "Вафельное полотно из турецкого хлопка" },
  "Egyptian cotton terry": { tr: "Mısır pamuğu havlu kumaş", tk: "Müsür pagtasy tüýli mata", ru: "Махра из египетского хлопка" },
};

export const weaves: Record<string, T> = {
  "Honeycomb waffle weave": { tr: "Petek dokuma", tk: "Bal öýjükli wafli dokma", ru: "Вафельное плетение «соты»" },
  "Ribbed terry": { tr: "Fitilli havlu dokuma", tk: "Zolakly tüýli dokma", ru: "Рубчатая махра" },
  "Flat-woven peshtemal": { tr: "Düz dokuma peştemal", tk: "Tekiz dokalan peştemal", ru: "Гладкотканый пештемаль" },
  "Double-gauze muslin": { tr: "Çift katlı müslin", tk: "Iki gatly muslin", ru: "Двухслойный муслин" },
  "Plain-weave linen": { tr: "Düz dokuma keten", tk: "Ýönekeý dokalan zygyr", ru: "Лён полотняного переплетения" },
  "Microfibre knit": { tr: "Mikrofiber örme", tk: "Mikrofiber örme", ru: "Трикотажная микрофибра" },
  "Velour-sheared terry": { tr: "Kadife traşlı havlu", tk: "Welýur kesimli tüýli mata", ru: "Махра со стриженым велюром" },
  "Hand-tufted pile": { tr: "El tafting hav", tk: "El bilen tüýlenen haly", ru: "Ручной тафтинговый ворс" },
  "Chenille pile": { tr: "Şönil hav", tk: "Şenil tüýi", ru: "Ворс синель" },
  "Long-loop terry": { tr: "Uzun ilmekli havlu", tk: "Uzyn ilmekli tüýli mata", ru: "Махра с длинной петлёй" },
  "Zero-twist terry loop": { tr: "Sıfır bükümlü havlu ilmek", tk: "Towlanmadyk ilmekli tüýli mata", ru: "Махровая петля без кручения" },
};

export const origins: Record<string, T> = {
  "Woven in Denizli, Türkiye": { tr: "Denizli, Türkiye'de dokundu", tk: "Denizlide (Türkiýe) dokaldy", ru: "Соткано в Денизли (Турция)" },
  "Egyptian Giza cotton, woven in Portugal": { tr: "Mısır Giza pamuğu, Portekiz'de dokundu", tk: "Müsüriň Giza pagtasy, Portugaliýada dokaldy", ru: "Египетский хлопок гиза, соткано в Португалии" },
  "Woven in Lithuania": { tr: "Litvanya'da dokundu", tk: "Litwada dokaldy", ru: "Соткано в Литве" },
  "Made in Tamil Nadu, India": { tr: "Tamil Nadu, Hindistan'da üretildi", tk: "Tamilnadda (Hindistan) öndürildi", ru: "Произведено в Тамилнаде (Индия)" },
  "Made from recycled bottles in Portugal": { tr: "Portekiz'de geri dönüştürülmüş şişelerden üretildi", tk: "Portugaliýada gaýtadan işlenen çüýşelerden öndürildi", ru: "Сделано из переработанных бутылок в Португалии" },
  "Woven in Guimarães, Portugal": { tr: "Guimarães, Portekiz'de dokundu", tk: "Gimaraýşda (Portugaliýa) dokaldy", ru: "Соткано в Гимарайнше (Португалия)" },
};

export const care: Record<string, T> = {
  "Machine wash at 30°C. Skip fabric softener so fibres stay thirsty.": {
    tr: "30°C'de makinede yıkayın. Lifler emiciliğini korusun diye yumuşatıcı kullanmayın.",
    tk: "30°C-de maşynda ýuwuň. Süýümler suwy gowy siňdirer ýaly ýumşadyjy ulanmaň.",
    ru: "Машинная стирка при 30 °C. Не используйте кондиционер, чтобы волокна хорошо впитывали влагу.",
  },
  "Machine wash at 40°C with similar colours. Skip fabric softener so loops stay absorbent.": {
    tr: "Benzer renklerle 40°C'de makinede yıkayın. İlmekler emici kalsın diye yumuşatıcı kullanmayın.",
    tk: "Meňzeş reňkler bilen 40°C-de maşynda ýuwuň. Ilmekler suwy gowy siňdirer ýaly ýumşadyjy ulanmaň.",
    ru: "Машинная стирка при 40 °C с вещами похожих цветов. Не используйте кондиционер, чтобы петли хорошо впитывали влагу.",
  },
  "Do not bleach.": { tr: "Ağartıcı kullanmayın.", tk: "Agardyjy ulanmaň.", ru: "Не отбеливать." },
  "Line dry, or tumble dry low and remove while slightly damp.": {
    tr: "Askıda kurutun ya da düşük ısıda kurutup hafif nemliyken çıkarın.",
    tk: "Asyp guradyň ýa-da pes temperaturada guradyp, birneme çygly wagty çykaryň.",
    ru: "Сушите на верёвке или в сушильной машине при низкой температуре и доставайте слегка влажным.",
  },
  "Tumble dry on low, or line dry and shake out for extra fluff.": {
    tr: "Düşük ısıda kurutun ya da askıda kurutup kabarması için silkeleyin.",
    tk: "Pes temperaturada guradyň ýa-da asyp guradyp, ýumşar ýaly silkäň.",
    ru: "Сушите в сушильной машине при низкой температуре или на верёвке, затем встряхните для пышности.",
  },
  "Warm iron while damp if you like a crisp finish.": {
    tr: "Daha diri bir görünüm isterseniz nemliyken ılık ütüleyin.",
    tk: "Has tekiz görnüş isleseňiz, çygly wagty ýyly ütük bilen ütükläň.",
    ru: "Для гладкости гладьте тёплым утюгом, пока ткань влажная.",
  },
  "Do not iron — it flattens the loops.": { tr: "Ütülemeyin — ilmekleri yassılaştırır.", tk: "Ütüklemäň — ilmekleri ýasyldýar.", ru: "Не гладить — это приминает петли." },
  "Do not dry clean.": { tr: "Kuru temizleme yapmayın.", tk: "Gury arassalamaň.", ru: "Не подвергать химчистке." },
  "Machine wash at 40°C with similar colours. Skip fabric softener so the fabric stays absorbent.": {
    tr: "Benzer renklerle 40°C'de makinede yıkayın. Kumaş emici kalsın diye yumuşatıcı kullanmayın.",
    tk: "Meňzeş reňkler bilen 40°C-de maşynda ýuwuň. Mata suwy gowy siňdirer ýaly ýumşadyjy ulanmaň.",
    ru: "Машинная стирка при 40 °C с вещами похожих цветов. Не используйте кондиционер, чтобы ткань хорошо впитывала влагу.",
  },
  "Tumble dry on low, or line dry.": {
    tr: "Düşük ısıda kurutun ya da askıda kurutun.",
    tk: "Pes temperaturada guradyň ýa-da asyp guradyň.",
    ru: "Сушите в сушильной машине при низкой температуре или на верёвке.",
  },
  "Cool iron if needed.": { tr: "Gerekirse düşük ısıda ütüleyin.", tk: "Gerek bolsa pes gyzgynlykda ütükläň.", ru: "При необходимости гладьте при низкой температуре." },
  "Do not iron.": { tr: "Ütülemeyin.", tk: "Ütüklemäň.", ru: "Не гладить." },
};

/** Known translation of an English term, if any: suggest("Sand", colours) → { tr: "Kum", tk: "Gum" } */
export const suggestName = (en: string, dict: Record<string, T>): NameL10n | undefined => (dict[en.trim()] ? { ...dict[en.trim()] } : undefined);
export const suggestText = (en: string, dict: Record<string, T>): L10n => ({ en, ...(dict[en.trim()] ?? {}) });
