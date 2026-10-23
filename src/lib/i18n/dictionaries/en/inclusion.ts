/** Phase 6 additions: dietary and access filters, the venue map, calendar and blocked dates. */
export const inclusion = {
  // Catalog filters and venue page
  "filters.access": "Access",
  "filters.menus": "Menus",
  "filters.menusHint": "Venues that say their menus can cover all of these.",
  "venue.accessHeading": "Access",
  "venue.menusHeading": "Menus",
  "venue.menusNone": "No dietary options listed",
  "venue.checkMuis": "Check halal certificates on the MUIS halal search",
  "venue.notListed": "{item}: not listed",

  // Map
  "map.heading": "Where it is",
  "map.title": "Map of {name}",
  "map.open": "Open in Google Maps",
  "map.directions": "Directions",

  // Wedding date and calendar
  "date.label": "Wedding date (optional)",
  "date.hint": "Used for the calendar file and to check the venue's booked dates.",
  "date.addToCalendar": "Add to calendar",
  "date.icsHelp": "Downloads a calendar file (.ics) that opens in Google, Apple or Outlook calendars.",
  "date.eventTitle": "Wedding: {plan}",
  "date.set": "Wedding date: {date}",
  "date.none": "No date set yet",
  "date.blockedHeading": "Dates already booked at this venue",
  "date.blockedNone": "The venue hasn't listed any booked dates.",
  "date.blockedNote": "Listed by the vendor. Check directly with them before you commit.",
  "date.clash": "The venue says {date} is already booked.",

  // Studio dietary filter
  "studio.dietaryFilter": "Show food that is",
  "studio.dietaryAll": "Everything",
  "studio.dietaryHidden_one": "{count} food item hidden by your filter.",
  "studio.dietaryHidden_other": "{count} food items hidden by your filter.",
} as const;
