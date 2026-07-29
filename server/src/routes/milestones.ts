import { Router } from 'express';
import { API_ROUTES } from '@streaktrack/shared';
import type { MilestoneResponse } from '@streaktrack/shared';
import { requireAuth } from '../middleware/auth.js';
import { computeMilestones } from '../utils/milestoneCalculator.js';
import { broadcastMilestoneCompleted } from '../index.js';

const router = Router();

// ── GET /api/milestones ──────────────────────────────────────
router.get(API_ROUTES.MILESTONES, requireAuth, (_req, res) => {
  try {
    const { milestones, currentBlock, treatScoreboard, newlyCompleted } = computeMilestones();

    // Broadcast any newly completed milestones to all connected sockets
    for (const milestone of newlyCompleted) {
      broadcastMilestoneCompleted({ milestone });
    }

    const response: MilestoneResponse = {
      milestones,
      currentBlock,
      treatScoreboard,
    };

    res.json(response);
  } catch (err: unknown) {
    console.error('Error computing milestones:', err);
    res.status(500).json({ message: 'Failed to compute milestones' });
  }
});

export default router;
