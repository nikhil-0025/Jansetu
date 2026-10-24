const express = require('express');
const router = express.Router();
const dataStore = require('../models/dataStore');
const { requireAuth } = require('../middleware/auth');

// GET /api/notifications
router.get('/', requireAuth, (req, res) => {
  const recipientId = req.user.role === 'citizen' ? req.user.familyId : 'ALL_OFFICERS';
  const notifs = dataStore.getNotifications(recipientId);

  res.json({
    success: true,
    notifications: notifs,
    unreadCount: notifs.filter(n => !n.isRead).length
  });
});

// PATCH /api/notifications/:notificationId/read
router.patch('/:notificationId/read', requireAuth, (req, res) => {
  const { notificationId } = req.params;
  const updated = dataStore.markNotificationRead(notificationId);

  res.json({
    success: true,
    notification: updated
  });
});

// POST /api/notifications/read-all
router.post('/read-all', requireAuth, (req, res) => {
  const recipientId = req.user.role === 'citizen' ? req.user.familyId : 'ALL_OFFICERS';
  const updatedList = dataStore.markAllNotificationsRead(recipientId);

  res.json({
    success: true,
    message: 'All notifications marked as read.',
    count: updatedList.length
  });
});

module.exports = router;
