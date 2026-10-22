/** The family voting page (/s/[shareId]). Anonymous visitors; no account. */
export const vote = {
  "vote.loading": "Opening the link",
  "vote.errorOpen": "We couldn't open this link. Check your connection and try again.",
  "vote.errorVote": "We couldn't send your vote. Please try again.",

  "vote.removedTitle": "This project has been removed",
  "vote.removedBody": "The couple has deleted it. There's nothing to see here any more.",
  "vote.revokedTitle": "This link is no longer active",
  "vote.revokedBody": "The couple has turned it off. Ask them for a new link if you'd like to vote.",

  "vote.invited": "You're invited to help choose",
  "vote.intro": "Tap your favourite. Your vote goes only to the couple. No account needed.",
  "vote.optionsLegend": "Options",
  "vote.option": "Option {letter}",
  "vote.optionAlt": "Option {letter}: AI illustration of {venue} in the {theme} theme",
  "vote.optionMeta": "{venue} · {theme}",

  "vote.thankYou": "Thank you! You chose Option {letter}. The couple will see your vote.",
  "vote.nameLabel": "Your name or relationship (optional)",
  "vote.namePlaceholder": "For example, Auntie Mei",
  "vote.noteLabel": "A note for the couple (optional)",
  "vote.chooseFirst": "Choose an option first",
  "vote.voteFor": "Vote for Option {letter}",
  "vote.privacy": "One vote per person. We don't ask for contact details or store your IP address.",

  "vote.footerSentence": "Planning your own wedding?",
  "vote.footerLink": "See how WeddingVista works",
} as const;
