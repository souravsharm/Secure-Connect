import express from 'express';
import { ensureCache } from '../../utils/gallagherCache.js';
import { asyncHandler } from '../../utils/errorHandler.js';
import CardholderService from '../../services/CardholderService.js';
import GallagherAdapter from '../../api/gallagher/GallagherAdapter.js';
import { validatePersonBody, validateDeletePersonBody } from '../../middlewares/validation.js';
import { requireAuth } from '../../middlewares/auth.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// All cardholder routes require a valid JWT (see routes/v1/authRoutes.js for /login)
router.use(requireAuth);

// Middleware to ensure cache is initialized for certain routes
router.use(ensureCache);

// Route to create cardholder with dynamic data (with Zod validation for { person })
router.post(
  "/create_cardholder",
  validatePersonBody,
  asyncHandler(async (req, res) => {
    const log = req?.log || logger;
    
    try {
      const gallagherAdapter = new GallagherAdapter();
      const cardholderService = new CardholderService(gallagherAdapter);

      // Use validated payload from middleware (already unwrapped to person)
      const person = req.validated;
      
      // Log the validated request for debugging
      log.info('Processing create cardholder request', { 
        firstName: process.env.LOG_SHOW_PII === 'true' ? person.firstName : '[REDACTED]',
        cardCount: person.cards?.length || 0,
        cardTypes: person.cards?.map(c => c.cardType) || [],
        divisionName: process.env.LOG_SHOW_PII === 'true' ? person.divisionName : '[REDACTED]'
      });

      const result = await cardholderService.createCardholder(person);
      
      log.info('Cardholder creation completed successfully');
      res.status(200).json({
        message: "Cardholder created successfully!!!!",
        data: result,
      });
    } catch (error) {
      // Enhanced error context for route-level errors
      log.error('Route-level error in create_cardholder', {
        error: error.message,
        stack: error.stack,
        correlationId: req.correlationId
      });
      throw error; // Re-throw to let asyncHandler handle it
    }
  })
);

router.patch(
  "/update_cardholder",
  validatePersonBody,
  asyncHandler(async (req, res) => {
    const gallagherAdapter = new GallagherAdapter();
    const cardholderService = new CardholderService(gallagherAdapter);
    const { person, type } = req.body;
    await cardholderService.updateCardholder(person, type);
    res.status(200).json({ message: "Cardholder updated successfully" });
  })
);

router.delete(
  "/delete_cardholder",
  validateDeletePersonBody,
  asyncHandler(async (req, res) => {
    const log = req?.log || logger;
    const gallagherAdapter = new GallagherAdapter();
    const cardholderService = new CardholderService(gallagherAdapter);
    const { firstName } = req.validated; // from delete validator

    log.info('Deleting cardholder by firstName', {
      firstName: process.env.LOG_SHOW_PII === 'true' ? firstName : '[REDACTED]'
    });

    await cardholderService.deleteCardholder(firstName);
    res.status(200).json({ message: "Cardholder deleted successfully" });
  })
);

export default router;