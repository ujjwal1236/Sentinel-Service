import { Router } from "express";

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check endpoint
 *     responses:
 *       200:
 *         description: Service is running
 */
router.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "sentinel",
    timestamp: new Date().toISOString()
  });
});

export default router;
