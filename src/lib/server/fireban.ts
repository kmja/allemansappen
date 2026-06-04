import type { FireBanLink, FireBanResult } from "../types";
import {
  NATIONAL_FIRE_LINKS,
  countyByCode,
  countyStartPage,
} from "../lanstyrelser";

/**
 * Honest fire-ban resolver.
 *
 * There is no clean, authoritative national feed for *legal* eldningsförbud:
 * it is decided locally (länsstyrelse / kommun) and changes without notice.
 * So v1 deliberately does NOT assert "ban" or "no ban". It returns an
 * `unknown` status that frames the question honestly and links the user to the
 * authoritative source for their county.
 *
 * The return shape (FireBanResult) already supports `ban`/`no-ban`, so a real
 * feed can be wired in here later without changing the UI.
 */
export function getFireBan(countyCode?: string | null): FireBanResult {
  const county = countyByCode(countyCode);

  const links: FireBanLink[] = [];
  if (county) {
    links.push({
      label: `Länsstyrelsen ${county.name}`,
      href: countyStartPage(county.slug),
    });
  }
  for (const l of NATIONAL_FIRE_LINKS) {
    links.push({ label: l.label, href: l.href });
  }

  return {
    status: "unknown",
    headline: county
      ? `Kontrollera eldningsförbud i ${county.name}`
      : "Kontrollera eldningsförbud lokalt",
    detail:
      "Appen kan inte automatiskt bekräfta om det råder eldningsförbud här. " +
      "Eldningsförbud beslutas lokalt och kan ändras snabbt – kontrollera " +
      "alltid hos din länsstyrelse innan du eldar.",
    county: county?.name,
    links,
    checkedAt: new Date().toISOString(),
    source: "Länsstyrelsen / MSB",
  };
}
