/**
 * Route barrel — assembles all domain routers into a single parent router.
 */
import { Router } from 'express';
import fsRoutes from './fs.routes';
import aiRoutes from './ai.routes';
import promptsRoutes from './prompts.routes';
import historyRoutes from './history.routes';
import integrationsRoutes from './integrations.routes';

const router = Router();

router.use(fsRoutes);
router.use(aiRoutes);
router.use(promptsRoutes);
router.use(historyRoutes);
router.use(integrationsRoutes);

export default router;
