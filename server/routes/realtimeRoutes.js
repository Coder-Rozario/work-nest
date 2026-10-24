const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { registerClient } = require('../utils/realtimeHub');

const router = express.Router();
const HEARTBEAT_MS = 25000;

// Server-Sent Events stream. EventSource cannot send headers, so the JWT is passed as a query param.
router.get('/stream', async (req, res) => {
  let payload;

  try {
    payload = jwt.verify(String(req.query.token || '').trim(), process.env.JWT_SECRET);
  } catch {
    res.status(401).json({ success: false, message: 'Invalid realtime token.' });
    return;
  }

  try {
    const [rows] = await db.query(
      'SELECT id, company_id, is_active FROM users WHERE id = ? LIMIT 1',
      [Number(payload?.id)]
    );

    const user = rows[0];
    if (!user || Number(user.is_active) !== 1) {
      res.status(401).json({ success: false, message: 'Realtime session is not active.' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write('retry: 3000\n\n');

    const unregister = registerClient({
      res,
      userId: Number(user.id),
      companyId: Number(user.company_id),
    });

    res.write(`data: ${JSON.stringify({ resource: 'system', action: 'connected', at: Date.now() })}\n\n`);

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, HEARTBEAT_MS);

    req.on('close', () => {
      clearInterval(heartbeat);
      unregister();
    });
  } catch (error) {
    console.error('Realtime stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Could not open realtime stream.' });
    }
  }
});

module.exports = router;
