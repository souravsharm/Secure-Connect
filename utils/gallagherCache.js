import { createGallagherAxiosInstance } from './certificateLoader.js';
import logger, { maskCardNumber, redactPII } from './logger.js';

class GallagherCache {
  constructor() {
    this.cache = {
      cardholders: null,
      divisions: null,
      accessGroups: null,
      operatorGroups: null
    };
    this.api = createGallagherAxiosInstance();
    this.initialized = false;
  }

  /**
   * Cache the basic hrefs from the main API endpoint
   */
  async cacheBasicHrefs() {
    try {
      const response = await this.api.get("/api/");
      
      // Cache the main feature endpoints
      if (response.data.features) {
        this.cache.cardholders = response.data.features.cardholders?.cardholders?.href;
        this.cache.divisions = response.data.features.divisions?.divisions?.href;
        this.cache.accessGroups = response.data.features.accessGroups?.accessGroups?.href;
        this.cache.operatorGroups = response.data.features.operatorGroups?.operatorGroups?.href;
      }
      
      this.initialized = true;
      logger.info('Basic hrefs cached', { cachedHrefs: this.cache });
      // console.log('Basic hrefs cached:', this.cache);
      return this.cache;
    } catch (error) {
      logger.error('Failed to cache basic hrefs', { error });
      // console.error('Failed to cache basic hrefs:', error);
      throw error;
    }
  }

  /**
   * Find division href by name
   * @returns {string} The specific href of the division with the given name
   */
  async findDivisionHrefByName(divisionName) {
    if (!this.cache.divisions) {
      throw new Error('Divisions href not cached. Call cacheBasicHrefs() first.');
    }

    try {
      logger.debug('Finding division href by name', { name: (process.env.LOG_SHOW_PII === 'true' ? divisionName : '[REDACTED_NAME]') });
      const divisions = await this.api.get(this.cache.divisions);
      const division = divisions.data.results.find(div => div.name === divisionName);
      
      if (!division) {
        throw new Error(`Division with name "${divisionName}" not found`);
      }
      
      logger.info('Division href found');
      return division.href;
    } catch (error) {
      logger.error('Failed to find division', { error, name: '[REDACTED_NAME]' });
      // console.error(`Failed to find division "${divisionName}":`, error);
      throw error;
    }
  }

  /**
   * Find operator group href by name
   */
  async findOperatorGroupByName(groupName) {
    if (!this.cache.operatorGroups) {
      throw new Error('Operator groups href not cached. Call cacheBasicHrefs() first.');
    }

    try {
      logger.debug('Finding operator group by name', { name: (process.env.LOG_SHOW_PII === 'true' ? groupName : '[REDACTED_NAME]') });
      const operatorGroups = await this.api.get(this.cache.operatorGroups);
      const group = operatorGroups.data.results.find(og => og.name === groupName);
      
      if (!group) {
        throw new Error(`Operator group with name "${groupName}" not found`);
      }
      
      logger.info('Operator group href found');
      return group.href;
    } catch (error) {
      logger.error('Failed to find operator group', { error, name: '[REDACTED_NAME]' });
      // console.error(`Failed to find operator group "${groupName}":`, error);
      throw error;
    }
  }

  /**
   * Create a cardholder
   */
  async createCardholder(cardholderData) {
    if (!this.cache.cardholders) {
      throw new Error('Cardholders href not cached. Call cacheBasicHrefs() first.');
    }

    try {
      // Enhanced logging for card numbers
      const cardNumbers = cardholderData.cards?.map(card => maskCardNumber(card.number)) || [];
      logger.info('Creating cardholder', { 
        payload: redactPII(cardholderData),
        cardNumbers: cardNumbers,
        cardTypes: cardholderData.cards?.map(card => card.type?.href?.split('/').pop()) || [],
        totalCards: cardholderData.cards?.length || 0
      });
      
      const response = await this.api.post(this.cache.cardholders, cardholderData);
      logger.info('Cardholder created successfully', { 
        href: response.data?.href,
        cardNumbers: cardNumbers
      });
      return response.data;
    } catch (error) {
      // Enhanced error logging
      const errorDetails = {
        error: error.message,
        status: error?.response?.status,
        gallagherError: error?.response?.data,
        requestCards: cardholderData.cards?.map(card => ({
          type: card.type?.href?.split('/').pop(),
          number: maskCardNumber(card.number),
          from: card.from,
          until: card.until
        })) || [],
        firstName: process.env.LOG_SHOW_PII === 'true' ? cardholderData.firstName : '[REDACTED]',
        divisionHref: cardholderData.division?.href
      };
      
      logger.error('Failed to create cardholder', errorDetails);
      
      // Add specific error handling for common Gallagher API errors
      if (error?.response?.status === 400) {
        const gallagherMessage = error?.response?.data?.message || 'Unknown validation error';
        const gallagherCode = error?.response?.data?.code || 'Unknown';
        
        logger.warn('Handled 4xx error', {
          error: error.message,
          origin: 'POST /api/v1/create_cardholder',
          status: 400,
          upstream: {
            message: gallagherMessage,
            code: gallagherCode,
            hexCode: error?.response?.data?.hexCode
          },
          correlationId: error.config?.headers?.['x-correlation-id']
        });
      }
      
      throw error;
    }
  }

  async deleteCardholder(cardholderHref) {
    try {
      logger.warn('Deleting cardholder', { href: cardholderHref });
      const response = await this.api.delete(cardholderHref);
      logger.info('Cardholder deleted successfully', { href: cardholderHref });
      // console.log('Cardholder deleted successfully');
      return response.data;
    } catch (error) {
      logger.error('Failed to delete cardholder', { error, href: cardholderHref });
      // console.error('Failed to delete cardholder:', error);
      throw error;
    }
  }

  /**
   * Find cardholder href by first name
   * @returns {string} The specific href of the cardholder with the given first name
   */
  async findCardholderHrefByFirstName(cardholderNameFirstName) {
    if (!this.cache.cardholders) {
      throw new Error('Cardholders href not cached. Call cacheBasicHrefs() first.');
    }
    try {
      logger.debug('Finding cardholder by first name', { name: (process.env.LOG_SHOW_PII === 'true' ? cardholderNameFirstName : '[REDACTED_NAME]') });
      const cardholders = await this.api.get(`${this.cache.cardholders}?name=${encodeURIComponent(cardholderNameFirstName)}`);
      const cardholderhref = cardholders.data.results[0];
      
      if (!cardholderhref) {
        throw new Error(`Cardholder with name "${cardholderNameFirstName}" not found`);
      }
      
      logger.info('Cardholder href found');
      return cardholderhref.href;
    } catch (error) {
      logger.error('Failed to find cardholder', { error, name: '[REDACTED_NAME]' });
      // console.error(`Failed to find cardholder "${cardholderNameFirstName}":`, error);
      throw error;
    }
  }
  
  //@param {string} cardholderHref - The href of the cardholder to find the card number for
  //@param {string} cardNumber - The card number to find
  /**
   * Find card number href by cardholder href and card number
   * @param {string} cardholderHref - The href of the cardholder to find the card number for
   * @param {string} cardNumber - The card number to find
   * @returns {Object} The card data containing the href
   */
  async findCardNumberHref(cardholderHref, cardNumber) {
    if (!this.cache.cardholders) {
      throw new Error('Cardholders href not cached. Call cacheBasicHrefs() first.');
    }
    try {
      logger.debug('Fetching cards for cardholder', { cardholderHref, cardNumber: maskCardNumber(cardNumber) });
      const cardholderCards = await this.api.get(`${cardholderHref}`, {
        params: {
          fields: 'cards'
        }
      });
      const cardholderCard = cardholderCards.data.cards.find(card => card.number === cardNumber);

      logger.info('Card href resolved', { cardNumber: maskCardNumber(cardNumber), found: !!cardholderCard });
      return cardholderCard?.href;
    } catch (error) {
      logger.error('Failed to find card number href', { error, cardholderHref, cardNumber: maskCardNumber(cardNumber) });
      // console.error(`Failed to find card number href for cardholder ${cardholderHref} and card number ${cardNumber}:`, error);
      throw error;
    }
  }

  /**
   * Update a cardholder
   * @param {string} cardholderHref - The href of the cardholder to update
   * @param {Object} cardholderData - The data to update the cardholder with
   * @returns {Object} The updated cardholder data
   */
  async updateCardholder(cardholderHref, cardholderData) {
    if (!this.cache.cardholders) {
        throw new Error('Cardholders href not cached. Call cacheBasicHrefs() first.');
      }
    try {
      logger.info('Updating cardholder', { href: cardholderHref, payload: redactPII(cardholderData) });
      const response = await this.api.patch(cardholderHref, cardholderData);
      logger.info('Cardholder updated successfully', { href: cardholderHref });
      // console.log('Cardholder updated successfully');
      return response.data;
    } catch (error) {
      logger.error('Failed to update cardholder', { error, href: cardholderHref });
      // console.error('Failed to update cardholder:', error);
      throw error;
    }
  }


  /**
   * Get all cached hrefs
   */
  getCachedHrefs() {
    return { ...this.cache };
  }

  /**
   * Check if cache is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache = {
      cardholders: null,
      divisions: null,
      accessGroups: null,
      operatorGroups: null
    };
    this.initialized = false;
    logger.warn('Cache cleared');
    // console.log('Cache cleared');
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus() {
    const status = {
      initialized: this.initialized,
      cachedHrefs: this.cache,
      hasCardholders: !!this.cache.cardholders,
      hasDivisions: !!this.cache.divisions,
      hasAccessGroups: !!this.cache.accessGroups,
      hasOperatorGroups: !!this.cache.operatorGroups
    };
    logger.debug('Cache status', status);
    return status;
  }
  
}

// Create a singleton instance
const gallagherCache = new GallagherCache();

export default gallagherCache;
export async function ensureCache(req, res, next) {
  try {
    if (!gallagherCache.isInitialized()) {
      logger.info('Ensuring Gallagher cache initialization');
      await gallagherCache.cacheBasicHrefs();
    }
    next();
  } catch (err) {
    logger.error('ensureCache middleware failed', { error: err });
    next(err);
  }
}