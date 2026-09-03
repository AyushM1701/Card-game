# Mind F*ck

Most card games built around memory fail because they give players an easy way out. In *Cabo* or six-card *Golf*, you repeatedly peek at your layout, swap cards into verified positions, and reduce the table to basic arithmetic. Mind F*ck is built on the opposite premise: certainty is an expensive mistake. You look at your three cards once for eight seconds when the hand is dealt. From that second forward, every play is blind.

The core rule set enforces this pressure directly.

### The Objective

Each player sits behind three face-down cards. When the draw pile runs out of cards, every player turns their hand face-up and sums the values. The lowest score takes the round.

### Card Values

A standard 52-card deck is used for games of two to four players. A double deck (104 cards) is shuffled in whenever five or more players join.

* Ace counts as 1 point.
* Cards 2 through 6, 8, 9, and 10 count at face value.
* Action cards carry high penalties if left sitting in your hand at round end: 7 is worth 7 points, Jack is 11, Queen is 12, and King is 13.

### Setup and the Opening Peek

Three cards are dealt face-down to each player. A single eight-second countdown begins, during which you privately look at your cards and memorize their positions from left to right. Once the timer reaches zero, the cards turn face-down. You cannot look at them again for the rest of the round unless you trigger a King.

### Turn Sequence

Turns move clockwise around the table. On your turn, draw the top card from the center pile. What happens next depends on what you drew.

If you draw a plain number card:

1. You may swap it into any of your three slots. You do this without checking what card was already there. You might replace a 10 with a 2, or you might replace an Ace with a 9 because your recollection slipped. The software does not check whether your swap is an improvement.
2. You may discard the drawn card to the dead pile and leave your slots untouched.

If you draw an action card (7, Jack, Queen, or King):

1. Play it immediately. Its effect resolves on the spot, and the card goes straight to the discard pile without entering your hand.
2. Bank it. Swap the action card into one of your three slots, replacing whatever card was sitting there. Its special ability remains dormant until another card displaces it later.

### Triggering Banked Actions

Holding an action card in your hand is dangerous because of its face value, but it is also how you set traps. When a card in your slot is replaced by a subsequent swap, that displaced card is discarded. If the displaced card is an unplayed action card, its power triggers on its way to the discard pile.

### The Four Actions

* King (Peek Own): Look privately at all three of your cards, then return them face-down. It is the only mechanism in the game that lets you inspect your own hand after the opening deal.
* Queen (Peek Opponent): Choose one opponent and view all three of their face-down cards.
* Jack (Blind Trade): Pick one of your three card slots and one slot belonging to an opponent. Swap those two cards across the table. Neither player looks at what was traded.
* Seven (Scramble): Select an opponent. Their three cards are randomly shuffled among their three slot positions. Anything that player memorized about their layout is wiped out.

### Why the Blind Swap Matters

Early builds of this game included a safety check: the server rejected any plain-card swap where the drawn card was higher than the card being replaced. That guardrail ruined the table dynamic. It turned the game into a spreadsheet because players could click their slots to probe which one held their lowest card without taking any risk.

On September 2, 2026, we stripped that restriction out. Any card can now overwrite any slot. If you panic and drop an 8 over an Ace, you live with the damage.

The only evidence that would change my mind about keeping the game this harsh is sustained player abandonment. If testing had shown players leaving rooms out of sheer frustration, the rule would have had to soften. During our testing runs, the opposite happened. Tables fell apart when the game moved slowly under safe calculations; tables stayed full when a player confidently traded away their middle card only to realize they handed their opponent a winning hand.
