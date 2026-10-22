/** Phase 7: the couple's answer to a vendor saying they booked. */
export const booking = {
  "booking.claimed": "{vendor} says you booked with them for {date}.",
  "booking.claimedValue": "{vendor} says you booked with them for {date}, for {amount}.",
  "booking.question": "Is that right?",
  "booking.yes": "Yes, we booked",
  "booking.no": "That's not right",
  "booking.why": "Your answer tells the vendor which bookings came through WeddingVista. Nothing else is shared.",
  "booking.confirmed": "Booked with {vendor} for {date}.",
  "booking.disputed": "You said this booking isn't right. {vendor} can correct it and ask again.",
  "booking.failed": "We couldn't save your answer. Please try again.",
  "booking.thanks": "Thank you. Your answer was sent.",
} as const;
