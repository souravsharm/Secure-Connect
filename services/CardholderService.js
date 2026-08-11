import { cardholderTemplates } from '../utils/cardholderData.js';
import { buildCardPayload, findCard } from '../utils/cardBuilder.js';
import { cardTypes, baseUrl } from '../config/gallagher.js';
import { ca } from 'zod/locales';

class CardholderService {
    constructor(apiAdapter) {
        this.apiAdapter = apiAdapter;
    }

    async createCardholder(person) {
        // Build cards array based on what's actually provided
        const cardPayloads = [];
        
        // Process each card in the input
        for (const card of person.cards) {
            let cardPayload;
            
            if (card.cardType === "Access") {
                cardPayload = buildCardPayload(
                    card,
                    `${baseUrl}/api/card_types/${cardTypes.access}`,
                    2
                );
            } else if (card.cardType === "MSIC") {
                cardPayload = buildCardPayload(
                    card,
                    `${baseUrl}/api/card_types/${cardTypes.msic}`,
                    1
                );
            } else {
                throw new Error(`Unsupported card type: ${card.cardType}`);
            }
            
            cardPayloads.push(cardPayload);
        }

        const firstName = person.firstName;
        const lastName = person.lastName;
        const photo = person.photo;
        const email = person.email;
        const divisionName = person.divisionName;

        if (!firstName && !lastName) {
            throw new Error("At least one of firstName or lastName is required");
        }

        const targetDivision = divisionName || process.env.DEFAULT_DIVISION_NAME || "CreateCardholder";
        const divisionHref = await this.apiAdapter.findDivisionHrefByName(targetDivision);

        const cardholderData = {
            ...cardholderTemplates.ExampleData,
            firstName,
            lastName,
            description: "This is a test description",
            division: { href: divisionHref },
            cards: cardPayloads, // Use dynamically built cards array
            // Access group is mandatory in your environment
            accessGroups: [
                {
                    accessGroup: {
                        href:
                            process.env.DEFAULT_ACCESS_GROUP_HREF
                            || `${baseUrl}/api/access_groups/${process.env.DEFAULT_ACCESS_GROUP_ID || '688'}`
                    },
                    from: process.env.DEFAULT_ACCESS_GROUP_FROM || new Date().toISOString()
                }
            ],
            "@email": email,
            "@photo": photo,
            notes: person.employmentCategory ? `Employment Category: ${person.employmentCategory}` : "",
            authorised: true
        };

        return this.apiAdapter.createCardholder(cardholderData);
    }

    async updateCardholder(cardholder, cardState = null) {
        const cardholderHref = await this.apiAdapter.findCardholderHrefByFirstName(cardholder.firstName);
        console.log("Found cardholderHref: ", cardholderHref);

        const updatePayload = {};

        // If cardState is provided, prepare the card status update
        if (cardState) {
            const accessCard = findCard(cardholder.cards, "Access");
            if (accessCard && accessCard.cardNumber) {
                const updateHref = await this.apiAdapter.findCardNumberHref(cardholderHref, accessCard.cardNumber);
                if (updateHref) {
                    updatePayload.cards = {
                        update: [{
                            href: updateHref,
                            status: { value: cardState }
                        }]
                    };
                }
            }
        }

        // Add other cardholder properties to the payload if they exist
        const fieldsToUpdate = {
            lastName: cardholder.lastName,
            firstName: cardholder.firstName,
            description: cardholder.description,
            "@email": cardholder.email,
            "@photo": cardholder.photo,
            notes: cardholder.notes,
            authorised: cardholder.authorised
        };

        for (const [key, value] of Object.entries(fieldsToUpdate)) {
            if (value !== undefined) {
                updatePayload[key] = value;
            }
        }

        // Only proceed if there is something to update
        if (Object.keys(updatePayload).length > 0) {
            return this.apiAdapter.updateCardholder(cardholderHref, updatePayload);
        } else {
            console.log("No updates to perform.");
            return { message: "No update data provided." };
        }
    }

    async deleteCardholder(firstName) {
        const cardholderHref = await this.apiAdapter.findCardholderHrefByFirstName(firstName);
        return this.apiAdapter.deleteCardholder(cardholderHref);
    }
}

export default CardholderService;