/**
 * Allemansrätten principles, in plain Swedish, framed as principles to apply —
 * NOT a checklist that yields a verdict. We deliberately link out to
 * Naturvårdsverket as the authoritative source rather than presenting our copy
 * as the rule of law.
 */

export interface Principle {
  id: string;
  /** lucide-react icon name, resolved in the UI. */
  icon: string;
  title: string;
  summary: string;
  detail: string;
}

export const ALLEMANSRATTEN_INTRO =
  "Allemansrätten ger dig rätt att vistas i naturen – men den ger inget enkelt " +
  "“ja” eller “nej” för en enskild plats. Om du får tälta beror på var du är, " +
  "hur nära bostäder du är, vad marken används till och hur länge du stannar. " +
  "Appen visar vad som finns runt dig och principerna nedan. Bedömningen gör du.";

export const PRINCIPLES: Principle[] = [
  {
    id: "hemfridszon",
    icon: "House",
    title: "Inte för nära bostäder (hemfridszon)",
    summary: "Håll dig utom synhåll och hörhåll från bostadshus.",
    detail:
      "Tälta inte inom hemfridszonen – den privata zonen runt ett bostadshus. " +
      "Det finns ingen exakt gräns i lagen. Man brukar tala om i storleksordningen " +
      "60–70 meter, men det beror helt på terräng, insyn och hur platsen ser ut. " +
      "Byggnadslagret i appen hjälper dig att hålla avstånd – men det är din " +
      "bedömning som gäller, inte en uppmätt linje.",
  },
  {
    id: "tomtmark",
    icon: "SquareDashed",
    title: "Inte på tomt eller trädgård (tomtmark)",
    summary: "Privat tomtmark ligger utanför allemansrätten.",
    detail:
      "Du får inte tälta på någons tomt eller i en anlagd trädgård. " +
      "Fastighetsgränserna i appen är en ledtråd till var privat mark börjar – " +
      "men en fastighetsgräns är inte samma sak som tomtgränsen.",
  },
  {
    id: "brukad-mark",
    icon: "Wheat",
    title: "Inte på brukad mark",
    summary: "Åker, äng och planteringar kan skadas.",
    detail:
      "Undvik åker, äng, planteringar och annan brukad mark där tält och tramp " +
      "kan skada grödor eller markarbete. Markanvändningslagret flaggar sådan mark. " +
      "På obrukad naturmark är utgångsläget mer tillåtande.",
  },
  {
    id: "naturreservat",
    icon: "TreePine",
    title: "Särskilda regler i skyddad natur",
    summary: "Naturreservat och nationalparker har egna regler.",
    detail:
      "I naturreservat och nationalparker gäller områdets egna föreskrifter – " +
      "tältning kan vara begränsad till särskilda platser eller helt förbjuden. " +
      "Reglerna skiljer sig åt mellan områden och ändras. Tryck på ett " +
      "reservat i appen för att öppna dess officiella sida, och läs alltid " +
      "skyltar och beslut på plats.",
  },
  {
    id: "en-natt",
    icon: "MoonStar",
    title: "Något enstaka dygn, liten grupp",
    summary: "Inte störa, inte förstöra.",
    detail:
      "Allemansrätten gäller kortvarig vistelse – ungefär ett dygn – och en " +
      "liten grupp. Vill du stanna längre, eller är ni många, behöver du " +
      "markägarens tillåtelse. Grundregeln genom allt: inte störa, inte förstöra.",
  },
  {
    id: "eld",
    icon: "Flame",
    title: "Elda bara när det är säkert",
    summary: "Respektera eldningsförbud.",
    detail:
      "Gör bara upp eld om det kan ske utan risk och det inte råder " +
      "eldningsförbud. Vid förbud är öppen eld inte tillåten, och ofta inte " +
      "heller friluftskök – villkoren varierar. Kontrollera alltid aktuellt " +
      "läge (se banner i appen) hos din länsstyrelse.",
  },
  {
    id: "spar",
    icon: "Leaf",
    title: "Lämna inga spår",
    summary: "Ta med skräpet, lämna platsen fin.",
    detail:
      "Ta med allt ditt skräp och lämna platsen minst lika fin som du hittade " +
      "den. Visa hänsyn till djurliv, betesdjur och andra människor i naturen.",
  },
];

export interface OfficialLink {
  label: string;
  href: string;
  note?: string;
}

/** Authoritative sources to link out to instead of restating rules. */
export const OFFICIAL_LINKS: OfficialLink[] = [
  {
    label: "Allemansrätten – Naturvårdsverket",
    href: "https://www.naturvardsverket.se/allemansratten/",
    note: "Den officiella genomgången av vad som gäller.",
  },
  {
    label: "Sveriges nationalparker",
    href: "https://www.sverigesnationalparker.se/",
    note: "Regler skiljer sig per park.",
  },
];
