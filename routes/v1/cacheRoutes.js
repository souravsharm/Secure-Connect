import express from 'express';
import gallagherCache, { ensureCache } from '../../utils/gallagherCache.js';
import { asyncHandler } from '../../utils/errorHandler.js';
import { requireAuth } from '../../middlewares/auth.js';

const router = express.Router();

// All cache management routes require a valid JWT (see routes/v1/authRoutes.js for /login)
router.use(requireAuth);

// Middleware to ensure cache is initialized for certain routes
router.use(['/create_cardholder', '/update_cardholder', '/delete_cardholder'], ensureCache);

// Utility routes for cache management
router.get("/cache_status", (req, res) => {
  res.json({
    initialized: gallagherCache.isInitialized(),
    status: gallagherCache.getCacheStatus()
  });
});

router.post("/clear_cache", (req, res) => {
  gallagherCache.clearCache();
  res.json({ message: "Cache cleared successfully" });
});

router.get("/cached_hrefs", (req, res) => {
  if (!gallagherCache.isInitialized()) {
    return res.status(400).json({ message: "Cache not initialized. Call / first." });
  }
  res.json(gallagherCache.getCachedHrefs());
});

export default router;