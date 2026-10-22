import { auth } from "./en/auth";
import { booking } from "./en/booking";
import { catalog } from "./en/catalog";
import { common } from "./en/common";
import { estimate } from "./en/estimate";
import { guests } from "./en/guests";
import { inclusion } from "./en/inclusion";
import { landing } from "./en/landing";
import { plans } from "./en/plans";
import { rituals } from "./en/rituals";
import { sharing } from "./en/sharing";
import { studio } from "./en/studio";
import { ui } from "./en/ui";
import { vote } from "./en/vote";

/**
 * English, the reference dictionary. Keys are "<screen>.<name>"; plural forms
 * are "<key>_one" / "<key>_other" with a {count} placeholder. Each screen keeps
 * its strings in ./en/<screen>.ts; this file only merges them. Vendor-entered
 * text (venue names, item names, descriptions) is never in here.
 */
export const en = {
  ...common,
  ...ui,
  ...landing,
  ...auth,
  ...catalog,
  ...studio,
  ...estimate,
  ...plans,
  ...guests,
  ...sharing,
  ...vote,
  ...rituals,
  ...inclusion,
  ...booking,
} as const;
