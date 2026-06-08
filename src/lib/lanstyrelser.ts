/**
 * Swedish counties (län) and links to their official pages, used for the
 * honest fire-ban ("eldningsförbud") link-out. We do NOT assert a ban; we send
 * the user to the authoritative source for their county.
 *
 * County start-page URLs follow the stable https://www.lansstyrelsen.se/<slug>.html
 * pattern. Deep links to the eldningsförbud sub-page change over time, so we
 * intentionally link the county start page. Verify against the live site if you
 * later want to deep-link.
 */

export interface County {
  /** ISO-ish county code (length-2 letter code commonly used in Sweden). */
  code: string;
  name: string;
  slug: string;
}

export const COUNTIES: County[] = [
  { code: "AB", name: "Stockholm", slug: "stockholm" },
  { code: "C", name: "Uppsala", slug: "uppsala" },
  { code: "D", name: "Södermanland", slug: "sodermanland" },
  { code: "E", name: "Östergötland", slug: "ostergotland" },
  { code: "F", name: "Jönköping", slug: "jonkoping" },
  { code: "G", name: "Kronoberg", slug: "kronoberg" },
  { code: "H", name: "Kalmar", slug: "kalmar" },
  { code: "I", name: "Gotland", slug: "gotland" },
  { code: "K", name: "Blekinge", slug: "blekinge" },
  { code: "M", name: "Skåne", slug: "skane" },
  { code: "N", name: "Halland", slug: "halland" },
  { code: "O", name: "Västra Götaland", slug: "vastra-gotaland" },
  { code: "S", name: "Värmland", slug: "varmland" },
  { code: "T", name: "Örebro", slug: "orebro" },
  { code: "U", name: "Västmanland", slug: "vastmanland" },
  { code: "W", name: "Dalarna", slug: "dalarna" },
  { code: "X", name: "Gävleborg", slug: "gavleborg" },
  { code: "Y", name: "Västernorrland", slug: "vasternorrland" },
  { code: "Z", name: "Jämtland", slug: "jamtland" },
  { code: "AC", name: "Västerbotten", slug: "vasterbotten" },
  { code: "BD", name: "Norrbotten", slug: "norrbotten" },
];

export function countyByCode(code: string | null | undefined): County | undefined {
  if (!code) return undefined;
  return COUNTIES.find((c) => c.code === code);
}

function normalizeCounty(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*län\s*$/, "")
    .trim()
    .replace(/s$/, ""); // drop the genitive -s ("Stockholms" -> "stockholm")
}

/** Match an admin name like "Stockholms län" (e.g. from Overpass) to a county. */
export function countyByName(
  name: string | null | undefined,
): County | undefined {
  if (!name) return undefined;
  const n = normalizeCounty(name);
  return COUNTIES.find((c) => normalizeCounty(c.name) === n);
}

export function countyStartPage(slug: string): string {
  return `https://www.lansstyrelsen.se/${slug}.html`;
}

/** National resources that aggregate fire-risk / eldningsförbud information. */
export const NATIONAL_FIRE_LINKS = [
  {
    label: "Krisinformation.se",
    href: "https://www.krisinformation.se/",
    note: "Samlar varningar och eldningsförbud nationellt.",
  },
  {
    label: "MSB – brandrisk",
    href: "https://www.msb.se/",
    note: "Brandriskprognoser och appen Brandrisk Ute.",
  },
];
