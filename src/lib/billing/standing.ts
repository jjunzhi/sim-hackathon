/**
 * The same good-standing rules the server uses, imported rather than copied
 * so the vendor's billing page can never disagree with the catalog.
 */
export {
  EMPTY_BILLING,
  PAST_DUE_GRACE_DAYS,
  inGoodStanding,
  readBilling,
  standingOf,
  type BillingDoc,
  type Standing,
  type SubscriptionStatus,
} from "../../../functions/src/billing/standing";
