/**
 * Security Utility for Admin Data Protection
 * Ensures admin information is never exposed to non-admin users
 */

/**
 * Removes admin data from response objects
 * @param {*} data - Data to sanitize
 * @returns {*} Sanitized data without admin information
 */
export const sanitizeAdminData = (data) => {
  if (!data) return data;

  // If it's an array, sanitize each item
  if (Array.isArray(data)) {
    return data.map(item => sanitizeAdminData(item));
  }

  // If it's an object
  if (typeof data === 'object') {
    const sanitized = { ...data };
    
    // Remove admin field completely
    if ('admin' in sanitized) {
      delete sanitized.admin;
    }
    
    // Remove adminID if present
    if ('adminID' in sanitized) {
      delete sanitized.adminID;
    }
    
    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (sanitized[key] && typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizeAdminData(sanitized[key]);
      }
    }
    
    return sanitized;
  }

  return data;
};

/**
 * Checks if a user can view admin data
 * @param {Object} user - User object from JWT
 * @returns {boolean} True if user is admin
 */
export const isAdminUser = (user) => {
  return user && user.role === 'ADMIN';
};

/**
 * Removes sensitive user fields from responses
 * @param {Object} user - User object
 * @param {Array} fieldsToRemove - Fields to remove
 * @returns {Object} Sanitized user object
 */
export const sanitizeUserData = (user, fieldsToRemove = ['password']) => {
  if (!user) return user;
  
  const sanitized = { ...user };
  fieldsToRemove.forEach(field => {
    delete sanitized[field];
  });
  
  return sanitized;
};

/**
 * Filter admin users from a list
 * @param {Array} users - Array of user objects
 * @returns {Array} Array without admin users
 */
export const filterOutAdmins = (users) => {
  if (!Array.isArray(users)) return users;
  
  return users.filter(user => {
    // Filter out by role if available
    if (user.role && user.role === 'ADMIN') {
      return false;
    }
    
    // Filter out by email if available
    if (user.email && user.email === 'tarekadnan67@gmail.com') {
      return false;
    }
    
    // Filter out admin relations
    if (user.admin) {
      return false;
    }
    
    return true;
  });
};
