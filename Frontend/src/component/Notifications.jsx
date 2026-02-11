import React, { useState, useEffect } from 'react';
import '../styles/Notifications.css';
import { api } from '../utils/api';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/api/annotator/notifications');
      if (response.success) {
        setNotifications(response.data.notifications);
      }
    } catch (err) {
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationID) => {
    try {
      await api.post('/api/annotator/notifications/read', { notificationID });
      setNotifications(notifications.map(n =>
        n.notificationID === notificationID ? { ...n, isRead: true } : n
      ));
    } catch (err) {
      console.error('Failed to mark notification as read');
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'LABEL_APPROVED':
        return '#27ae60';
      case 'LABEL_REJECTED':
        return '#e74c3c';
      case 'LABEL_SUBMITTED':
        return '#3498db';
      case 'ASSIGNMENT':
        return '#f39c12';
      default:
        return '#95a5a6';
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'LABEL_APPROVED':
        return '✓';
      case 'LABEL_REJECTED':
        return '✕';
      case 'LABEL_SUBMITTED':
        return '📋';
      case 'ASSIGNMENT':
        return '📌';
      case 'RESTRICTION':
        return '⚠';
      default:
        return 'ℹ';
    }
  };

  const filteredNotifications = filter === 'all'
    ? notifications
    : filter === 'unread'
    ? notifications.filter(n => !n.isRead)
    : notifications.filter(n => n.type === filter);

  if (loading) {
    return <div className="notifications-container"><p>Loading notifications...</p></div>;
  }

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <h2>Notifications</h2>
        <div className="notification-count">{filteredNotifications.length}</div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="notifications-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({notifications.length})
        </button>
        <button
          className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Unread ({notifications.filter(n => !n.isRead).length})
        </button>
        <button
          className={`filter-btn ${filter === 'LABEL_APPROVED' ? 'active' : ''}`}
          onClick={() => setFilter('LABEL_APPROVED')}
        >
          Approved
        </button>
        <button
          className={`filter-btn ${filter === 'LABEL_REJECTED' ? 'active' : ''}`}
          onClick={() => setFilter('LABEL_REJECTED')}
        >
          Rejected
        </button>
      </div>

      <div className="notifications-list">
        {filteredNotifications.length === 0 ? (
          <div className="no-notifications">
            <p>No notifications</p>
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.notificationID}
              className={`notification-item ${notif.isRead ? 'read' : 'unread'}`}
              onClick={() => !notif.isRead && markAsRead(notif.notificationID)}
            >
              <div
                className="notification-icon"
                style={{ backgroundColor: getNotificationColor(notif.type) }}
              >
                {getNotificationIcon(notif.type)}
              </div>
              <div className="notification-content">
                <p className="notification-message">{notif.message}</p>
                <p className="notification-time">
                  {new Date(notif.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="notification-type">{notif.type.replace(/_/g, ' ')}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
