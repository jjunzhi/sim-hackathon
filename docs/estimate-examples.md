# Estimate engine: worked examples

Every number here was calculated by hand. `src/lib/estimate/engine.test.ts` asserts the same figures. All amounts are in cents (S$1 = 100). Rates are in basis points (10% = 1000 bps, 9% = 900 bps). Rounding is half-up at each step: service charge, then GST, then the per-guest price.

All prices below are SAMPLE values.

Selections used in several examples:

| Item | Unit | Price |
| --- | --- | --- |
| Floral arch | per piece | 120,000 |
| Table centrepiece | per table | 8,800 |
| Chair sash | per guest | 350 |

## A. Peak, 185 guests, 10% service charge, 9% GST, no minimum spend

Tables = ceil(185 / 10) = **19**.

| Line | Working | Amount |
| --- | --- | --- |
| Room rental (Peak) | | 1,200,000 |
| Floral arch | 120,000 x 1 piece | 120,000 |
| Table centrepiece | 8,800 x 19 tables | 167,200 |
| Chair sash | 350 x 185 guests | 64,750 |
| **Subtotal** | | **1,551,950** |
| Service charge 10% | 1,551,950 x 0.10 = 155,195.0 | 155,195 |
| GST 9% | (1,551,950 + 155,195) x 0.09 = 1,707,145 x 0.09 = 153,643.05 | 153,643 |
| **Total** | 1,707,145 + 153,643 | **1,860,788** |
| Per guest | 1,860,788 / 185 = 10,058.31 | 10,058 |

## B. Same as A, with a Peak minimum spend of 4,500,050

The subtotal of 1,551,950 is below 4,500,050, so a separate shortfall line appears.

| Line | Working | Amount |
| --- | --- | --- |
| Subtotal | as A | 1,551,950 |
| Minimum spend shortfall | 4,500,050 - 1,551,950 | 2,948,100 |
| Amount charged on | | 4,500,050 |
| Service charge 10% | 450,005.0 | 450,005 |
| GST 9% | (4,500,050 + 450,005) x 0.09 = 4,950,055 x 0.09 = 445,504.95 | 445,505 |
| **Total** | 4,950,055 + 445,505 | **5,395,560** |
| Per guest | 5,395,560 / 185 = 29,165.19 | 29,165 |

## C. Off-Peak, same selections as A

| Line | Working | Amount |
| --- | --- | --- |
| Room rental (Off-Peak) | | 650,000 |
| Items | as A: 120,000 + 167,200 + 64,750 | 351,950 |
| **Subtotal** | | **1,001,950** |
| Service charge 10% | 100,195.0 | 100,195 |
| GST 9% | 1,102,145 x 0.09 = 99,193.05 | 99,193 |
| **Total** | | **1,201,338** |
| Per guest | 1,201,338 / 185 = 6,493.72 | 6,494 |

## D. No service charge and not GST-registered, 11 guests, 3 floral arches

Tables = ceil(11 / 10) = **2**.

| Line | Working | Amount |
| --- | --- | --- |
| Room rental | | 650,000 |
| Floral arch | 120,000 x 3 pieces | 360,000 |
| Table centrepiece | 8,800 x 2 tables | 17,600 |
| Chair sash | 350 x 11 guests | 3,850 |
| **Subtotal** | | **1,031,450** |
| Service charge | hidden; note "No service charge" | 0 |
| GST | hidden; note "Prices not subject to GST" | 0 |
| **Total** | | **1,031,450** |
| Per guest | 1,031,450 / 11 = 93,768.18 | 93,768 |

## E. Half-cent rounding at every step (decorator: no rental)

1. One item at 5 per piece. The subtotal is 5. Service charge 10% = 0.5, rounded up to **1**. GST 9% of 6 = 0.54, rounded down to **1**. Total **7**.
2. One item at 1,005 per piece, 4 guests. Service charge = 100.5, rounded up to **101**. GST 9% of 1,106 = 99.54, rounded up to **100**. Total **1,206**. Per guest 1,206 / 4 = 301.5, rounded up to **302**.

## F. Minimum spend exactly met

A rental of 1,000,000, no items, 100 guests, and a minimum spend of 1,000,000. There is **no shortfall line**. Service charge 100,000. GST 9% of 1,100,000 = 99,000. Total **1,199,000**. Per guest **11,990**.

## G. Minimum spend with no service charge but GST

A rental of 500,000, plus 50 guests x 2,000 per guest = 100,000. The subtotal is 600,000 and the minimum spend is 800,000.

- Shortfall: **200,000**. Amount charged on: 800,000.
- Service charge: hidden.
- GST 9% of 800,000 = **72,000**.
- Total **872,000**. Per guest 872,000 / 50 = **17,440**.

## I. Decorator only (no room), 185 guests, same three items

| Line | Working | Amount |
| --- | --- | --- |
| **Subtotal** | 120,000 + 167,200 + 64,750 | **351,950** |
| Service charge 10% | 35,195.0 | 35,195 |
| GST 9% | 387,145 x 0.09 = 34,843.05 | 34,843 |
| **Total** | 387,145 + 34,843 | **421,988** |
| Per guest | 421,988 / 185 = 2,281.02 | 2,281 |

With the Garden package (25,000 per table) instead of the centrepiece: 120,000 + 475,000 + 64,750 = **659,750**. Service charge 65,975. GST: 725,725 x 0.09 = 65,315.25, so **65,315**. Total **791,040**. Per guest 791,040 / 185 = 4,275.89, so **4,276**.

## H. Edge cases

- **0 guests:** per-table and per-guest lines are 0, and there is no per-guest price.
- **Refused:** a package selected together with an item it already includes, the same item selected twice, or a per-piece quantity of 0.
