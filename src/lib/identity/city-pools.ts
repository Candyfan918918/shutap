// Curated city pools per ISO country. Cities are written in the native script
// when meaningful (CJK), and Latin otherwise. Fallback pool is used when the
// detected country isn't in the map.

export const CITY_POOLS: Record<string, string[]> = {
  CN: ["北京", "上海", "成都", "杭州", "深圳", "重庆", "广州", "南京", "苏州", "西安"],
  HK: ["香港", "九龍", "新界"],
  TW: ["台北", "高雄", "台中", "台南"],
  JP: ["東京", "大阪", "京都", "横浜", "名古屋", "札幌", "福岡"],
  KR: ["서울", "부산", "인천", "대구", "광주"],
  US: ["New York", "Los Angeles", "Chicago", "Miami", "San Francisco", "Austin", "Seattle", "Boston", "Brooklyn"],
  CA: ["Toronto", "Montréal", "Vancouver", "Calgary"],
  GB: ["London", "Manchester", "Edinburgh", "Brighton", "Bristol"],
  FR: ["Paris", "Lyon", "Marseille", "Bordeaux", "Nice"],
  DE: ["Berlin", "München", "Hamburg", "Köln", "Frankfurt"],
  IT: ["Milano", "Roma", "Napoli", "Firenze", "Torino"],
  ES: ["Madrid", "Barcelona", "Sevilla", "Valencia", "Bilbao"],
  PT: ["Lisboa", "Porto", "Coimbra", "Braga"],
  BR: ["São Paulo", "Rio", "Salvador", "Brasília", "Belo Horizonte"],
  MX: ["CDMX", "Guadalajara", "Monterrey", "Puebla"],
  AR: ["Buenos Aires", "Córdoba", "Rosario"],
  AU: ["Sydney", "Melbourne", "Brisbane", "Perth"],
  NL: ["Amsterdam", "Rotterdam", "Utrecht", "Den Haag"],
  SE: ["Stockholm", "Göteborg", "Malmö"],
  IN: ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Kolkata"],
  SG: ["Singapore"],
  AE: ["Dubai", "Abu Dhabi"],
  TR: ["İstanbul", "Ankara", "İzmir"],
  RU: ["Москва", "Санкт-Петербург", "Казань"],
  ID: ["Jakarta", "Bandung", "Surabaya"],
  TH: ["กรุงเทพ", "เชียงใหม่"],
  VN: ["Hà Nội", "Sài Gòn", "Đà Nẵng"],
  PH: ["Manila", "Cebu", "Davao"],
};

const FALLBACK = ["Atlas", "Avalon", "Marina", "Skyline", "Harbor", "Vista"];

export function pickCity(countryCode: string | null | undefined, seed: number): string {
  const cc = (countryCode ?? "").toUpperCase();
  const pool = CITY_POOLS[cc] ?? FALLBACK;
  return pool[seed % pool.length];
}

// Return a short monogram for an avatar — 2 chars max, native script when possible.
export function cityMonogram(city: string): string {
  const trimmed = city.trim();
  if (!trimmed) return "··";
  // CJK / Hangul → first 1–2 chars
  const first = trimmed.codePointAt(0) ?? 0;
  const isCJK =
    (first >= 0x3400 && first <= 0x9fff) || // CJK ideographs
    (first >= 0xac00 && first <= 0xd7af) || // Hangul syllables
    (first >= 0x3040 && first <= 0x30ff);   // Hiragana / Katakana
  if (isCJK) return Array.from(trimmed).slice(0, 1).join("");
  // Latin → initials of first 1–2 words
  const words = trimmed.split(/[\s·]+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
