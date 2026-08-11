import gallagherCache from '../../utils/gallagherCache.js';

class GallagherAdapter {
    /**
     * @param {string} [apiKeyOverride] - Operator-supplied Gallagher REST Client API key.
     * When provided, calls made through this adapter instance attribute to that Gallagher
     * identity instead of the shared server-configured GALLAGHER_API_KEY.
     */
    constructor(apiKeyOverride) {
        this.gallagherCache = gallagherCache;
        this.apiKeyOverride = apiKeyOverride;
    }

    async findDivisionHrefByName(divisionName) {
        return this.gallagherCache.findDivisionHrefByName(divisionName, this.apiKeyOverride);
    }

    async createCardholder(cardholderData) {
        // The cardholderData already contains the baseUrl and cardTypes from CardholderService
        // so we just pass it directly to the gallagherCache.
        return this.gallagherCache.createCardholder(cardholderData, this.apiKeyOverride);
    }

    async updateCardholder(cardholderHref, cardholderData) {
        return this.gallagherCache.updateCardholder(cardholderHref, cardholderData, this.apiKeyOverride);
    }

    async deleteCardholder(cardholderHref) {
        return this.gallagherCache.deleteCardholder(cardholderHref, this.apiKeyOverride);
    }

    async findCardholderHrefByFirstName(firstName) {
        return this.gallagherCache.findCardholderHrefByFirstName(firstName, this.apiKeyOverride);
    }
    async findCardNumberHref(cardholderHref, cardNumber) {
        return this.gallagherCache.findCardNumberHref(cardholderHref, cardNumber, this.apiKeyOverride);
    }
}

export default GallagherAdapter;