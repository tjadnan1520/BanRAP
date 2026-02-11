import prisma from '../config/prisma.js';

/**
 * Delete expired OTPs from the database
 * This function should be called periodically to clean up expired OTPs
 */
export const deleteExpiredOTPs = async () => {
  try {
    const result = await prisma.otp.deleteMany({
      where: {
        expiryAt: {
          lt: new Date()
        }
      }
    });
    console.log(`[OTP Cleanup] Deleted ${result.count} expired OTPs`);
    return result;
  } catch (error) {
    console.error('[OTP Cleanup] Error deleting expired OTPs:', error);
    throw error;
  }
};

/**
 * Get all non-expired OTPs for debugging
 */
export const getActiveOTPs = async () => {
  try {
    const otps = await prisma.otp.findMany({
      where: {
        expiryAt: {
          gt: new Date()
        }
      }
    });
    return otps;
  } catch (error) {
    console.error('[OTP Cleanup] Error fetching active OTPs:', error);
    throw error;
  }
};

/**
 * Start periodic cleanup job
 * DISABLED: OTPs are now kept in the database permanently for record-keeping
 * Set ENABLE_OTP_CLEANUP=true in .env to re-enable automatic cleanup
 */
export const startOTPCleanupJob = () => {
  const enableCleanup = process.env.ENABLE_OTP_CLEANUP === 'true';
  
  if (enableCleanup) {
    const intervalId = setInterval(async () => {
      await deleteExpiredOTPs();
    }, 120000); // Run every 2 minutes
    console.log('[OTP Cleanup] Cleanup job enabled');
    return intervalId;
  } else {
    console.log('[OTP Cleanup] Cleanup job DISABLED - OTPs will be kept in database');
    return null;
  }
};

export default {
  deleteExpiredOTPs,
  getActiveOTPs,
  startOTPCleanupJob
};
