import gallagherCache from '../../utils/gallagherCache.js';

class GallagherAdapter {
    constructor() {
        this.gallagherCache = gallagherCache;
    }

    async findDivisionHrefByName(divisionName) {
        return this.gallagherCache.findDivisionHrefByName(divisionName);
    }

    async createCardholder(cardholderData) {
        // The cardholderData already contains the baseUrl and cardTypes from CardholderService
        // so we just pass it directly to the gallagherCache.
        return this.gallagherCache.createCardholder(cardholderData);
    }

    async updateCardholder(cardholderHref, cardholderData) {
        return this.gallagherCache.updateCardholder(cardholderHref, cardholderData);
    }

    async deleteCardholder(cardholderHref) {
        return this.gallagherCache.deleteCardholder(cardholderHref);
    }

    async findCardholderHrefByFirstName(firstName) {
        return this.gallagherCache.findCardholderHrefByFirstName(firstName);
    }
    async findCardNumberHref(cardholderHref, cardNumber) {
        return this.gallagherCache.findCardNumberHref(cardholderHref, cardNumber);
    }
}

export default GallagherAdapter;