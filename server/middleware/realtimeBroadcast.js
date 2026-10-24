const { broadcastToCompany } = require('../utils/realtimeHub');

// Maps an API path to the resource channel the client subscribes to.
const resolveResource = (originalUrl = '') => {
  const path = String(originalUrl).split('?')[0].replace(/^\/api\/?/, '').toLowerCase();

  if (path.startsWith('messages')) return 'messages';
  if (path.includes('tasks')) return 'tasks';
  if (path.includes('teams')) return 'teams';
  if (path.includes('projects')) return 'projects';
  if (path.includes('employees')) return 'employees';
  if (path.includes('meetings')) return 'meetings';
  if (path.includes('attendance') || path.includes('time-log')) return 'attendance';
  if (path.includes('reports')) return 'reports';
  if (path.includes('settings')) return 'settings';
  if (path.includes('profile')) return 'profile';

  return 'general';
};

const resolveAction = (method) => {
  if (method === 'POST') return 'create';
  if (method === 'DELETE') return 'delete';
  if (method === 'PUT' || method === 'PATCH') return 'update';
  return 'change';
};

// Emits a realtime event after any successful write request.
const realtimeBroadcast = (req, res, next) => {
  const method = String(req.method || '').toUpperCase();

  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    next();
    return;
  }

  res.on('finish', () => {
    if (res.statusCode >= 400 || !req.user?.company_id) return;

    const resource = resolveResource(req.originalUrl || req.url);
    console.log(`[Realtime] Broadcasting ${resource} for company ${req.user.company_id}`);

    broadcastToCompany(req.user.company_id, {
      resource,
      action: resolveAction(method),
      at: Date.now(),
    });
  });

  next();
};

module.exports = realtimeBroadcast;
