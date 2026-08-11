import express from 'express';
import gallagherCache, { ensureCache } from '../../utils/gallagherCache.js';
import { asyncHandler } from '../../utils/errorHandler.js';
import { requireAuth } from '../../middlewares/auth.js';

const router = express.Router();

// All cache management routes require a valid JWT (see routes/v1/authRoutes.js for /login)
router.use(requireAuth);

// cache_status and cached_hrefs self-warm the cache on a fresh process instead of
// just reporting an empty cache and telling the caller to hit / first.
router.use(['/cache_status', '/cached_hrefs'], ensureCache);

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
  res.json(gallagherCache.getCachedHrefs());
});

export default router;