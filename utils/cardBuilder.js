//@param cards: the cards array
//@param type: the type of card to find
//@returns the card object
export function findCard(cards, type) {
    const c = cards.find(c=> c.cardType === type);
    if (!c) throw new Error(`Missing ${type} card`);
    return c;
  }

//@param card: the card object
//@param typeHref: the href of the card type
//@param issueLevel: the issue level of the card
//@returns the card payload
export function buildCardPayload(card, typeHref, issueLevel) {
  return {
    type: { href: typeHref },
    number: card.cardNumber,
    from:   card.activationDate,
    until:  card.expiryDate,
    ...(issueLevel !== undefined ? { issueLevel } : {})
  };
}