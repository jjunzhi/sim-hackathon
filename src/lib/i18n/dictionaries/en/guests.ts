/** Guest list page and the guest helper's tier labels and validation messages. */
export const guests = {
  // Tiers (stored values stay "must" | "close" | "extended" | "casual")
  "guests.tierMust": "Must invite",
  "guests.tierClose": "Close friends",
  "guests.tierExtended": "Extended family",
  "guests.tierCasual": "Casual",

  // Validation (returned as keys by validateParty, translated in the page)
  "guests.errLabelMissing": "Add a label, for example \"Auntie Mei's family\".",
  "guests.errLabelLong": "Keep it under {max} characters.",
  "guests.errSeats": "Enter 1 to {max}.",
  "guests.errPlusOnes": "Enter 0 to {max}.",
  "guests.errTier": "Choose a tier.",

  // Guests page
  "guests.subtitle": "Count seats against your room. Only labels you write and seat numbers are kept: no contact details.",
  "guests.parties": "Parties",
  "guests.addParty": "Add a party",
  "guests.addPartySubmit": "Add party",
  "guests.savePartySubmit": "Save party",
  "guests.loading": "Loading guests",
  "guests.emptyTitle": "No guests yet",
  "guests.addFirst": "Add your first party",
  "guests.emptyBody": "Add families or groups with how many seats they need. You choose each party's tier.",
  "guests.seats_one": "{count} seat",
  "guests.seats_other": "{count} seats",
  "guests.plusOnes_one": "{count} plus-one",
  "guests.plusOnes_other": "{count} plus-ones",
  "guests.seatsWithPlusOnes": "{seats} + {plusOnes}",
  "guests.editAria": "Edit {label}",
  "guests.removeAria": "Remove {label}",
  "guests.removeError": "We couldn't remove that",
  "guests.saveError": "We couldn't save that",

  // Seat summary
  "guests.summaryAria": "Seat summary",
  "guests.compareWithPlan": "Compare with plan",
  "guests.savePlanHint": "Save a plan to compare your guests with a room.",
  "guests.seatsLabel": "Seats",
  "guests.seatsUsed": "Seats used",
  "guests.seatsLeft_one": "{count} seat left in {room}",
  "guests.seatsLeft_other": "{count} seats left in {room}",
  "guests.overMax": "{over} over the room's maximum of {max}",
  "guests.trimItem_one": "{tier} ({count} seat)",
  "guests.trimItem_other": "{tier} ({count} seats)",
  "guests.trimThen": "{first}, then {next}",
  "guests.trimToFit": "Trim {list} first to fit.",
  "guests.trimNotEnough": "Trim {list} first. Even that isn't enough: consider a larger room.",
  "guests.perGuestIn_one": "About {amount} per guest in \"{plan}\" ({count} guest). Estimate.",
  "guests.perGuestIn_other": "About {amount} per guest in \"{plan}\" ({count} guests). Estimate.",

  // Trim order
  "guests.trimTitle": "If you need to trim",
  "guests.trimHint": "Suggestions follow this order. \"Must invite\" is never suggested.",
  "guests.trimOrderItem": "{n}. {tier}",
  "guests.moveEarlier": "Move {tier} earlier",
  "guests.moveLater": "Move {tier} later",

  // Party form
  "guests.partyLabel": "Party",
  "guests.partyPlaceholder": "For example, Auntie Mei's family",
  "guests.tierLabel": "Tier",
  "guests.plusOnesLabel": "Plus-ones",
  "guests.totalForParty_one": "Total for this party: {count} seat",
  "guests.totalForParty_other": "Total for this party: {count} seats",
  "guests.totalForPartyUnknown": "Total for this party: - seats",
} as const;
