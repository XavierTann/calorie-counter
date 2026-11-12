// Singapore hawker / kopitiam reference database.
// Values are per typical hawker serving and are approximations based on
// Singapore Health Promotion Board (HPB) energy & nutrient composition data
// where available, otherwise typical-serving estimates. Edit freely.

export type Food = {
  id: string;
  name: string;
  aliases?: string[];
  serving: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const FOODS: Food[] = [
  // ---------- Rice dishes ----------
  { id: "chicken-rice-steamed", name: "Hainanese chicken rice (steamed/white)", aliases: ["chicken rice", "white chicken rice"], serving: "1 plate", kcal: 607, protein: 25, carbs: 75, fat: 23 },
  { id: "chicken-rice-roasted", name: "Roasted chicken rice", aliases: ["roast chicken rice"], serving: "1 plate", kcal: 620, protein: 27, carbs: 75, fat: 24 },
  { id: "chicken-rice-breast-noskin", name: "Chicken rice, breast meat, no skin", serving: "1 plate", kcal: 470, protein: 30, carbs: 72, fat: 8 },
  { id: "char-siew-rice", name: "Char siew rice", aliases: ["char siu rice", "bbq pork rice"], serving: "1 plate", kcal: 605, protein: 24, carbs: 91, fat: 16 },
  { id: "roast-pork-rice", name: "Roast pork (siew yoke) rice", aliases: ["sio bak rice", "siu yuk rice"], serving: "1 plate", kcal: 700, protein: 24, carbs: 80, fat: 31 },
  { id: "duck-rice", name: "Braised/roast duck rice", aliases: ["duck rice"], serving: "1 plate", kcal: 673, protein: 28, carbs: 85, fat: 24 },
  { id: "nasi-lemak", name: "Nasi lemak (basic: rice, egg, ikan bilis, peanuts, sambal)", aliases: ["nasi lemak"], serving: "1 plate", kcal: 494, protein: 14, carbs: 60, fat: 22 },
  { id: "nasi-lemak-chicken-wing", name: "Nasi lemak with fried chicken wing", serving: "1 plate", kcal: 750, protein: 28, carbs: 70, fat: 40 },
  { id: "nasi-briyani-chicken", name: "Nasi briyani, chicken", aliases: ["briyani", "biryani"], serving: "1 plate", kcal: 877, protein: 35, carbs: 105, fat: 35 },
  { id: "nasi-padang", name: "Nasi padang (rice + 2 dishes)", serving: "1 plate", kcal: 750, protein: 28, carbs: 85, fat: 32 },
  { id: "economic-rice-base", name: "Economic rice / cai fan – plain white rice portion", aliases: ["cai fan rice", "economy rice rice"], serving: "1 full portion (~250g)", kcal: 325, protein: 6, carbs: 72, fat: 1 },
  { id: "fried-rice", name: "Yang zhou fried rice", aliases: ["fried rice"], serving: "1 plate", kcal: 508, protein: 15, carbs: 70, fat: 18 },
  { id: "egg-fried-rice", name: "Egg fried rice", serving: "1 plate", kcal: 480, protein: 13, carbs: 72, fat: 15 },
  { id: "nasi-goreng", name: "Nasi goreng", serving: "1 plate", kcal: 742, protein: 22, carbs: 90, fat: 32 },
  { id: "claypot-rice", name: "Claypot chicken rice", serving: "1 claypot", kcal: 720, protein: 30, carbs: 95, fat: 24 },
  { id: "curry-chicken-rice", name: "Curry chicken with rice", serving: "1 plate", kcal: 750, protein: 28, carbs: 80, fat: 34 },
  { id: "hainanese-curry-rice", name: "Hainanese curry rice (pork chop, cabbage, egg)", aliases: ["scissors cut rice", "curry rice"], serving: "1 plate", kcal: 850, protein: 30, carbs: 95, fat: 38 },
  { id: "chicken-cutlet-rice", name: "Chicken cutlet rice (western stall style)", serving: "1 plate", kcal: 780, protein: 35, carbs: 85, fat: 32 },
  { id: "lor-bak-rice", name: "Braised pork (lor bak) rice", aliases: ["lu rou fan"], serving: "1 plate", kcal: 680, protein: 22, carbs: 80, fat: 30 },
  { id: "porridge-fish", name: "Fish porridge / fish slice congee", aliases: ["fish congee", "fish porridge"], serving: "1 bowl", kcal: 340, protein: 22, carbs: 50, fat: 6 },
  { id: "porridge-pork", name: "Pork / century egg porridge", aliases: ["pork congee", "century egg porridge"], serving: "1 bowl", kcal: 380, protein: 18, carbs: 52, fat: 11 },
  { id: "teochew-porridge", name: "Teochew porridge plain (no sides)", serving: "1 bowl", kcal: 150, protein: 3, carbs: 33, fat: 0.5 },

  // ---------- Noodles ----------
  { id: "char-kway-teow", name: "Char kway teow", aliases: ["ckt", "fried kway teow"], serving: "1 plate", kcal: 744, protein: 23, carbs: 76, fat: 38 },
  { id: "hokkien-mee", name: "Fried Hokkien prawn mee", aliases: ["hokkien mee", "hokkien prawn mee"], serving: "1 plate", kcal: 617, protein: 20, carbs: 70, fat: 28 },
  { id: "laksa", name: "Laksa (curry noodle soup)", aliases: ["katong laksa", "curry laksa"], serving: "1 bowl", kcal: 589, protein: 22, carbs: 55, fat: 31 },
  { id: "curry-mee", name: "Curry mee / curry noodles", serving: "1 bowl", kcal: 620, protein: 24, carbs: 58, fat: 33 },
  { id: "mee-rebus", name: "Mee rebus", serving: "1 bowl", kcal: 556, protein: 20, carbs: 82, fat: 16 },
  { id: "mee-siam", name: "Mee siam", serving: "1 plate", kcal: 519, protein: 18, carbs: 80, fat: 14 },
  { id: "mee-goreng", name: "Mee goreng (mamak)", aliases: ["mee goreng"], serving: "1 plate", kcal: 660, protein: 20, carbs: 85, fat: 26 },
  { id: "bak-chor-mee-dry", name: "Bak chor mee, dry (minced meat noodles)", aliases: ["bcm", "minced pork noodles", "mee pok bak chor"], serving: "1 bowl", kcal: 511, protein: 25, carbs: 60, fat: 19 },
  { id: "bak-chor-mee-soup", name: "Bak chor mee, soup", serving: "1 bowl", kcal: 430, protein: 25, carbs: 55, fat: 12 },
  { id: "fishball-noodle-dry", name: "Fishball noodles, dry (mee pok/kway teow)", aliases: ["fishball mee pok", "fishball noodles"], serving: "1 bowl", kcal: 440, protein: 20, carbs: 62, fat: 12 },
  { id: "fishball-noodle-soup", name: "Fishball noodles, soup", serving: "1 bowl", kcal: 360, protein: 20, carbs: 55, fat: 6 },
  { id: "wanton-mee-dry", name: "Wanton mee, dry", aliases: ["wonton noodles", "wanton noodle"], serving: "1 plate", kcal: 409, protein: 18, carbs: 60, fat: 11 },
  { id: "wanton-mee-soup", name: "Wanton mee, soup", serving: "1 bowl", kcal: 340, protein: 17, carbs: 52, fat: 7 },
  { id: "prawn-mee-soup", name: "Prawn noodle soup", aliases: ["har mee", "prawn mee"], serving: "1 bowl", kcal: 293, protein: 20, carbs: 40, fat: 6 },
  { id: "prawn-mee-dry", name: "Prawn noodles, dry", serving: "1 bowl", kcal: 460, protein: 22, carbs: 55, fat: 17 },
  { id: "lor-mee", name: "Lor mee", serving: "1 bowl", kcal: 383, protein: 17, carbs: 55, fat: 11 },
  { id: "ban-mian-soup", name: "Ban mian / mee hoon kway (soup)", aliases: ["ban mian", "mee hoon kueh", "mee hoon kway"], serving: "1 bowl", kcal: 475, protein: 22, carbs: 65, fat: 14 },
  { id: "ban-mian-dry", name: "Ban mian, dry / chilli ban mian", aliases: ["chilli ban mian"], serving: "1 bowl", kcal: 600, protein: 24, carbs: 70, fat: 24 },
  { id: "fish-soup-bee-hoon", name: "Sliced fish bee hoon soup (clear)", aliases: ["fish soup", "fish bee hoon"], serving: "1 bowl", kcal: 350, protein: 28, carbs: 45, fat: 6 },
  { id: "fish-soup-milk", name: "Fish soup with milk / fried fish bee hoon soup", serving: "1 bowl", kcal: 550, protein: 28, carbs: 50, fat: 25 },
  { id: "kway-chap", name: "Kway chap (with innards, egg, tau pok)", serving: "1 set", kcal: 650, protein: 32, carbs: 60, fat: 30 },
  { id: "beef-kway-teow-soup", name: "Beef kway teow soup / beef noodles", aliases: ["beef noodles"], serving: "1 bowl", kcal: 450, protein: 28, carbs: 58, fat: 11 },
  { id: "hor-fun", name: "Beef/seafood hor fun (wet, gravy)", aliases: ["hor fun", "wat dan hor"], serving: "1 plate", kcal: 650, protein: 25, carbs: 75, fat: 27 },
  { id: "mee-hoon-fried", name: "Fried bee hoon (plain, economic style)", aliases: ["fried bee hoon", "fried mee hoon"], serving: "1 plate (no sides)", kcal: 400, protein: 6, carbs: 70, fat: 11 },
  { id: "fried-bee-hoon-breakfast", name: "Fried bee hoon/noodles + egg + luncheon meat breakfast", serving: "1 plate", kcal: 600, protein: 16, carbs: 72, fat: 27 },
  { id: "seafood-white-bee-hoon", name: "White bee hoon (seafood)", serving: "1 plate", kcal: 550, protein: 25, carbs: 65, fat: 20 },
  { id: "zha-jiang-mian", name: "Zha jiang mian", serving: "1 bowl", kcal: 600, protein: 22, carbs: 80, fat: 21 },
  { id: "ramen", name: "Tonkotsu ramen", serving: "1 bowl", kcal: 750, protein: 30, carbs: 80, fat: 33 },
  { id: "mala-xiang-guo", name: "Mala xiang guo (medium bowl, ~S$12-15)", aliases: ["mala", "mala hotpot dry"], serving: "1 bowl, no rice", kcal: 900, protein: 35, carbs: 45, fat: 65 },
  { id: "yong-tau-foo-soup", name: "Yong tau foo, soup (6 pcs, no noodles)", aliases: ["ytf soup", "yong tau foo"], serving: "6 pieces + soup", kcal: 300, protein: 22, carbs: 20, fat: 14 },
  { id: "yong-tau-foo-fried-piece", name: "Yong tau foo fried item", aliases: ["fried ytf"], serving: "1 piece", kcal: 70, protein: 3, carbs: 4, fat: 5 },

  // ---------- Breakfast & bread ----------
  { id: "kaya-toast", name: "Kaya butter toast", aliases: ["kaya toast"], serving: "1 set (2 slices)", kcal: 300, protein: 6, carbs: 38, fat: 14 },
  { id: "soft-boiled-eggs", name: "Soft-boiled eggs (2) with soy sauce", aliases: ["half boiled eggs", "soft boiled eggs"], serving: "2 eggs", kcal: 150, protein: 12, carbs: 1, fat: 10 },
  { id: "roti-prata-plain", name: "Roti prata, plain", aliases: ["prata kosong", "plain prata"], serving: "1 piece", kcal: 209, protein: 4, carbs: 27, fat: 9.5 },
  { id: "roti-prata-egg", name: "Roti prata, egg", aliases: ["egg prata"], serving: "1 piece", kcal: 264, protein: 8, carbs: 27, fat: 14 },
  { id: "curry-gravy-prata", name: "Fish/dhal curry for prata", aliases: ["prata curry"], serving: "1 small bowl", kcal: 80, protein: 3, carbs: 6, fat: 5 },
  { id: "murtabak", name: "Murtabak (chicken/mutton)", serving: "1 whole (medium)", kcal: 1100, protein: 45, carbs: 90, fat: 60 },
  { id: "thosai-plain", name: "Thosai, plain", aliases: ["dosa"], serving: "1 piece", kcal: 200, protein: 5, carbs: 35, fat: 4 },
  { id: "chee-cheong-fun", name: "Chee cheong fun (with sauce)", aliases: ["ccf"], serving: "1 plate", kcal: 300, protein: 6, carbs: 55, fat: 6 },
  { id: "carrot-cake-white", name: "Fried carrot cake (chai tow kway), white", aliases: ["carrot cake", "chai tow kway"], serving: "1 plate", kcal: 568, protein: 12, carbs: 55, fat: 33 },
  { id: "carrot-cake-black", name: "Fried carrot cake, black", serving: "1 plate", kcal: 600, protein: 12, carbs: 65, fat: 32 },
  { id: "chwee-kueh", name: "Chwee kueh", serving: "4 pieces", kcal: 280, protein: 5, carbs: 45, fat: 9 },
  { id: "you-tiao", name: "You tiao (fried dough fritter)", aliases: ["you char kway", "dough stick"], serving: "1 pair", kcal: 300, protein: 5, carbs: 33, fat: 16 },
  { id: "pau-char-siew", name: "Char siew pau", aliases: ["char siew bao"], serving: "1 pau", kcal: 220, protein: 7, carbs: 34, fat: 6 },
  { id: "pau-big", name: "Big pau (tua pau, pork & egg)", aliases: ["tua pau", "big pau"], serving: "1 pau", kcal: 360, protein: 14, carbs: 45, fat: 13 },
  { id: "siew-mai", name: "Siew mai", serving: "1 piece", kcal: 55, protein: 3, carbs: 3, fat: 3.5 },
  { id: "curry-puff", name: "Curry puff (potato/chicken)", serving: "1 piece", kcal: 250, protein: 5, carbs: 27, fat: 14 },
  { id: "popiah", name: "Popiah", serving: "1 roll", kcal: 188, protein: 5, carbs: 28, fat: 6 },
  { id: "rojak", name: "Rojak (fruit & veg with prawn paste sauce)", serving: "1 plate", kcal: 450, protein: 10, carbs: 65, fat: 16 },
  { id: "otah", name: "Otah", serving: "1 piece", kcal: 70, protein: 5, carbs: 3, fat: 4 },
  { id: "satay-chicken", name: "Chicken satay (with peanut sauce)", aliases: ["satay"], serving: "10 sticks", kcal: 450, protein: 40, carbs: 15, fat: 25 },
  { id: "ketupat", name: "Ketupat (rice cake)", serving: "1/4 piece", kcal: 80, protein: 1.5, carbs: 18, fat: 0.2 },
  { id: "oyster-omelette", name: "Oyster omelette (orh luak)", aliases: ["orh luak"], serving: "1 plate", kcal: 620, protein: 20, carbs: 40, fat: 42 },
  { id: "sambal-stingray", name: "Sambal stingray (BBQ)", serving: "1 medium piece", kcal: 400, protein: 45, carbs: 8, fat: 21 },
  { id: "chilli-crab", name: "Chilli crab (share of 1 crab)", serving: "1/2 crab with gravy", kcal: 500, protein: 35, carbs: 25, fat: 28 },
  { id: "mantou-fried", name: "Fried mantou", serving: "1 piece", kcal: 100, protein: 2, carbs: 14, fat: 4 },

  // ---------- Economic rice / cai fan dishes (per scoop) ----------
  { id: "cf-veg", name: "Cai fan: stir-fried vegetable (cabbage/kailan/beansprouts)", serving: "1 scoop", kcal: 70, protein: 2, carbs: 5, fat: 5 },
  { id: "cf-egg", name: "Cai fan: tomato egg / fried egg / omelette", serving: "1 scoop / 1 egg", kcal: 120, protein: 7, carbs: 3, fat: 9 },
  { id: "cf-tofu", name: "Cai fan: braised/egg tofu", serving: "1 scoop", kcal: 120, protein: 7, carbs: 6, fat: 8 },
  { id: "cf-sweet-sour-pork", name: "Cai fan: sweet & sour pork", serving: "1 scoop", kcal: 250, protein: 10, carbs: 20, fat: 14 },
  { id: "cf-fried-chicken", name: "Cai fan: fried chicken / chicken cutlet", serving: "1 scoop/piece", kcal: 250, protein: 15, carbs: 10, fat: 16 },
  { id: "cf-curry-chicken", name: "Cai fan: curry chicken", serving: "1 scoop", kcal: 200, protein: 13, carbs: 5, fat: 14 },
  { id: "cf-steamed-fish", name: "Cai fan: steamed fish", serving: "1 scoop", kcal: 100, protein: 16, carbs: 2, fat: 3 },
  { id: "cf-fried-fish", name: "Cai fan: fried fish fillet", serving: "1 piece", kcal: 230, protein: 14, carbs: 12, fat: 14 },
  { id: "cf-braised-pork", name: "Cai fan: braised pork / pork belly", serving: "1 scoop", kcal: 230, protein: 10, carbs: 5, fat: 19 },
  { id: "cf-mapo-tofu", name: "Cai fan: mapo tofu / minced pork tofu", serving: "1 scoop", kcal: 150, protein: 9, carbs: 5, fat: 10 },
  { id: "cf-luncheon", name: "Cai fan: luncheon meat", serving: "2 slices", kcal: 160, protein: 6, carbs: 2, fat: 14 },
  { id: "cf-curry-gravy", name: "Curry gravy drizzle", serving: "1 ladle", kcal: 60, protein: 1, carbs: 3, fat: 5 },

  // ---------- Drinks (kopitiam lexicon) ----------
  { id: "kopi", name: "Kopi (coffee + condensed milk)", aliases: ["coffee"], serving: "1 cup", kcal: 117, protein: 2, carbs: 20, fat: 3 },
  { id: "kopi-siew-dai", name: "Kopi siew dai (less sweet)", serving: "1 cup", kcal: 85, protein: 2, carbs: 14, fat: 2.5 },
  { id: "kopi-gah-dai", name: "Kopi gah dai (extra sweet)", serving: "1 cup", kcal: 150, protein: 2, carbs: 27, fat: 3 },
  { id: "kopi-o", name: "Kopi-O (coffee + sugar)", serving: "1 cup", kcal: 59, protein: 0.3, carbs: 15, fat: 0 },
  { id: "kopi-o-siew-dai", name: "Kopi-O siew dai", serving: "1 cup", kcal: 35, protein: 0.3, carbs: 9, fat: 0 },
  { id: "kopi-o-kosong", name: "Kopi-O kosong (black, no sugar)", serving: "1 cup", kcal: 5, protein: 0.3, carbs: 0.5, fat: 0 },
  { id: "kopi-c", name: "Kopi-C (evaporated milk + sugar)", serving: "1 cup", kcal: 100, protein: 2, carbs: 16, fat: 3 },
  { id: "kopi-c-kosong", name: "Kopi-C kosong (evaporated milk, no sugar)", serving: "1 cup", kcal: 40, protein: 2, carbs: 3, fat: 2.5 },
  { id: "teh", name: "Teh (tea + condensed milk)", serving: "1 cup", kcal: 117, protein: 2, carbs: 20, fat: 3 },
  { id: "teh-o", name: "Teh-O (tea + sugar)", serving: "1 cup", kcal: 59, protein: 0, carbs: 15, fat: 0 },
  { id: "teh-c", name: "Teh-C (evaporated milk + sugar)", serving: "1 cup", kcal: 100, protein: 2, carbs: 16, fat: 3 },
  { id: "teh-c-kosong", name: "Teh-C kosong (evaporated milk, no sugar)", serving: "1 cup", kcal: 66, protein: 2, carbs: 5, fat: 3 },
  { id: "teh-tarik", name: "Teh tarik", serving: "1 cup", kcal: 140, protein: 3, carbs: 23, fat: 4 },
  { id: "milo", name: "Milo (kopitiam, hot or peng)", aliases: ["milo peng"], serving: "1 cup", kcal: 180, protein: 5, carbs: 30, fat: 4.5 },
  { id: "milo-dinosaur", name: "Milo dinosaur", serving: "1 cup", kcal: 300, protein: 8, carbs: 48, fat: 8 },
  { id: "bandung", name: "Bandung (rose syrup milk)", serving: "1 cup", kcal: 200, protein: 3, carbs: 38, fat: 4 },
  { id: "barley", name: "Barley water (sweetened)", serving: "1 cup", kcal: 120, protein: 0.5, carbs: 30, fat: 0 },
  { id: "sugarcane", name: "Sugarcane juice", serving: "1 cup (~300ml)", kcal: 230, protein: 0, carbs: 57, fat: 0 },
  { id: "lime-juice", name: "Lime juice (kopitiam)", serving: "1 cup", kcal: 120, protein: 0, carbs: 30, fat: 0 },
  { id: "soya-bean", name: "Soya bean milk (sweetened)", aliases: ["soya bean"], serving: "1 cup", kcal: 140, protein: 7, carbs: 20, fat: 3.5 },
  { id: "bubble-tea", name: "Bubble tea / milk tea with pearls (100% sugar, regular)", aliases: ["boba", "bbt"], serving: "1 cup (500ml)", kcal: 350, protein: 3, carbs: 65, fat: 9 },
  { id: "bubble-tea-50", name: "Bubble tea with pearls, 50% sugar", serving: "1 cup (500ml)", kcal: 270, protein: 3, carbs: 48, fat: 9 },

  // ---------- Desserts ----------
  { id: "ice-kachang", name: "Ice kachang", aliases: ["ais kacang", "abc"], serving: "1 bowl", kcal: 260, protein: 4, carbs: 55, fat: 3 },
  { id: "chendol", name: "Chendol", serving: "1 bowl", kcal: 427, protein: 4, carbs: 60, fat: 19 },
  { id: "tau-suan", name: "Tau suan", serving: "1 bowl", kcal: 280, protein: 6, carbs: 55, fat: 4 },
  { id: "bubur-cha-cha", name: "Bubur cha cha", serving: "1 bowl", kcal: 300, protein: 3, carbs: 45, fat: 12 },
  { id: "tau-huay", name: "Tau huay (beancurd, with syrup)", aliases: ["douhua", "beancurd"], serving: "1 bowl", kcal: 180, protein: 7, carbs: 30, fat: 3 },
  { id: "pulut-hitam", name: "Pulut hitam", serving: "1 bowl", kcal: 300, protein: 5, carbs: 52, fat: 8 },
  { id: "min-jiang-kueh", name: "Min jiang kueh (peanut)", serving: "1 piece", kcal: 200, protein: 5, carbs: 30, fat: 7 },
  { id: "ondeh-ondeh", name: "Ondeh ondeh", serving: "1 piece", kcal: 50, protein: 0.5, carbs: 10, fat: 1 },
  { id: "kueh-lapis", name: "Kueh lapis (steamed)", serving: "1 piece", kcal: 120, protein: 1, carbs: 22, fat: 3.5 },
  { id: "egg-tart", name: "Egg tart", serving: "1 piece", kcal: 200, protein: 4, carbs: 20, fat: 12 },
  { id: "goreng-pisang", name: "Goreng pisang (banana fritter)", serving: "1 piece", kcal: 150, protein: 1, carbs: 20, fat: 7.5 },
];

export function foodsAsPromptTable(foods: Food[]): string {
  return foods
    .map(
      (f) =>
        `${f.id} | ${f.name}${f.aliases?.length ? ` (aka ${f.aliases.join(", ")})` : ""} | ${f.serving} | ${f.kcal} kcal | P${f.protein} C${f.carbs} F${f.fat}`,
    )
    .join("\n");
}
