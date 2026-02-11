import { hashPassword, comparePassword, isValidEmail, isValidPhone, isValidPassword, generateOTP } from '../utils/authUtils.js';
import { generateToken } from '../utils/jwtUtils.js';
import { sendOTPEmail } from '../config/emailConfig.js';
import prisma from '../config/prisma.js';

export const register = async (req, res) => {
  try {
    const { email, name, phone, password, confirmPassword, role } = req.body;

    // Validation
    if (!email || !name || !phone || !password || !confirmPassword || !role) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters with uppercase, lowercase, and numbers'
      });
    }

    const validRoles = ['TRAVELLER', 'ANNOTATOR'];
    if (!validRoles.includes(role.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    // Explicitly block admin registration - admin accounts are system-only
    if (role.toUpperCase() === 'ADMIN') {
      console.warn('[SECURITY] Attempted admin registration blocked for email:', email);
      return res.status(403).json({
        success: false,
        message: 'Invalid role. Admin accounts cannot be created through public registration.'
      });
    }

    // Check if user already exists by email
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUserByEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Check if phone number is already used
    const existingUserByPhone = await prisma.user.findFirst({
      where: { phone }
    });

    if (existingUserByPhone) {
      return res.status(409).json({
        success: false,
        message: 'Phone number already registered'
      });
    }

    // Generate OTP for email verification
    const otp = generateOTP();
    const expiryTime = new Date(Date.now() + 90 * 1000); // 90 seconds

    // Save OTP in database
    const otpRecord = await prisma.otp.create({
      data: {
        phone,
        code: otp,
        email,
        expiryAt: expiryTime
      }
    });

    console.log('[register] OTP generated for registration:', otp);

    // Send OTP via email
    try {
      await sendOTPEmail(email, otp);
      console.log('[register] OTP email sent to:', email);
    } catch (emailError) {
      console.error('[register] Failed to send OTP email:', emailError);
      // Continue anyway - OTP is saved in database
    }

    // Store registration data temporarily (will be used after OTP verification)
    // For now, we'll store hashed password and other data to be used when OTP is verified
    const hashedPassword = await hashPassword(password);

    res.status(200).json({
      success: true,
      message: 'Registration credentials verified. Please verify your email with the OTP sent to your inbox.',
      data: {
        email,
        name,
        phone,
        role: role.toUpperCase(),
        requiresOTPVerification: true
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field';
      return res.status(409).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already registered`
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

export const verifyRegistrationOTP = async (req, res) => {
  try {
    const { email, phone, otp, password, name, role } = req.body;

    if (!email || !otp || !password || !name || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, password, name, and role are required'
      });
    }

    // Find valid OTP
    const otpString = otp.toString().trim();
    const cleanEmail = email.toString().trim();
    const currentTime = new Date();

    console.log('[verifyRegistrationOTP] Verifying OTP for registration');
    console.log('[verifyRegistrationOTP] Email:', cleanEmail, 'OTP:', otpString);

    // Find valid OTP
    const validOTP = await prisma.otp.findFirst({
      where: {
        email: cleanEmail,
        code: otpString,
        expiryAt: {
          gt: currentTime
        }
      }
    });

    if (!validOTP) {
      // Check if OTP exists but is expired
      const expiredOTP = await prisma.otp.findFirst({
        where: {
          email: cleanEmail,
          code: otpString
        }
      });

      if (expiredOTP) {
        console.log('[verifyRegistrationOTP] OTP found but expired');
        return res.status(401).json({
          success: false,
          message: 'OTP has expired. Please request a new registration.'
        });
      }

      console.log('[verifyRegistrationOTP] Invalid OTP');
      return res.status(401).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        name,
        phone,
        password: hashedPassword,
        role: role.toUpperCase()
      }
    });

    // Create role-specific records
    if (role.toUpperCase() === 'TRAVELLER') {
      await prisma.traveller.create({
        data: { email: cleanEmail }
      });
    } else if (role.toUpperCase() === 'ANNOTATOR') {
      await prisma.annotator.create({
        data: { email: cleanEmail }
      });
    } else if (role.toUpperCase() === 'ADMIN') {
      await prisma.admin.create({
        data: { email: cleanEmail }
      });
    }

    // Generate token
    const token = generateToken(user.email, user.role);

    console.log('[verifyRegistrationOTP] User created successfully after OTP verification');

    // Set secure httpOnly cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      success: true,
      message: 'Registration completed successfully!',
      data: {
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Verify registration OTP error:', error);

    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field';
      return res.status(409).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already registered`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to complete registration',
      error: error.message
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Normalize email: trim and convert to lowercase for consistency
    const normalizedEmail = email?.trim().toLowerCase();

    console.log('[LOGIN] Attempt with email:', normalizedEmail);

    // Validation
    if (!normalizedEmail || !password) {
      console.log('[LOGIN] Missing email or password');
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by normalized email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      console.log('[LOGIN] User not found:', normalizedEmail);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('[LOGIN] User found:', normalizedEmail, '- Role:', user.role);

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password);

    console.log('[LOGIN] Password validation:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('[LOGIN] Invalid password for user:', normalizedEmail);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken(user.email, user.role);

    console.log('[LOGIN] Token generated for:', normalizedEmail);

    // Set secure httpOnly cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    console.log('[LOGIN] Cookie set, sending response');

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        token: token  // Include token in response body for frontend
      }
    });
  } catch (error) {
    console.error('[LOGIN ERROR]:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    console.log('[forgotPassword] Request received');
    const { email, phone } = req.body;
    console.log('[forgotPassword] Email:', email, 'Phone:', phone);

    if (!email || !phone) {
      console.log('[forgotPassword] Missing email or phone');
      return res.status(400).json({
        success: false,
        message: 'Email and phone are required'
      });
    }

    // Find user
    console.log('[forgotPassword] Finding user...');
    const user = await prisma.user.findUnique({
      where: { email }
    });
    console.log('[forgotPassword] User found:', user ? 'yes' : 'no');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.phone !== phone) {
      console.log('[forgotPassword] Phone mismatch:', user.phone, '!==', phone);
      return res.status(400).json({
        success: false,
        message: 'Phone number does not match'
      });
    }

    // Generate OTP
    console.log('[forgotPassword] Generating OTP...');
    const otp = generateOTP();
    const expiryTime = new Date(Date.now() + 90 * 1000); // 1.5 minutes (90 seconds)
    console.log('[forgotPassword] Generated OTP:', otp);

    // NOTE: Not deleting existing OTPs - keeping all records for audit trail
    // Each forgot password request creates a new OTP, old ones are kept in database

    // Save OTP in database
    console.log('[forgotPassword] Saving OTP to database...');
    console.log('[forgotPassword] Prisma.otp exists?', typeof prisma.otp);
    
    try {
      // Ensure clean data
      const cleanOTP = otp.toString().trim();
      const cleanPhone = phone.toString().trim();
      const cleanEmail = email.toString().trim();
      
      const otpRecord = await prisma.otp.create({
        data: {
          phone: cleanPhone,
          code: cleanOTP,
          email: cleanEmail,
          expiryAt: expiryTime
        }
      });
      console.log('[forgotPassword] OTP saved successfully:', otpRecord.otpID);
      console.log('[forgotPassword] OTP Details - Email:', otpRecord.email, 'Phone:', otpRecord.phone, 'Code:', otpRecord.code, 'Expiry:', otpRecord.expiryAt);
    } catch (dbError) {
      console.error('[forgotPassword] Database error saving OTP:', dbError);
      throw new Error(`Failed to save OTP to database: ${dbError.message}`);
    }

    // Send OTP via Email
    try {
      console.log('[forgotPassword] Sending email to:', email);
      await sendOTPEmail(email, otp);
      console.log('[forgotPassword] OTP email sent successfully');
    } catch (emailError) {
      console.error('[forgotPassword] Failed to send OTP email:', emailError);
      // Continue anyway - OTP is saved in database
    }

    console.log('[forgotPassword] Sending success response');
    res.status(200).json({
      success: true,
      message: 'OTP sent to your email'
    });
  } catch (error) {
    console.error('[forgotPassword] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process forgot password',
      error: error.message
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (!email || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters with uppercase, lowercase, and numbers'
      });
    }

    // Find valid OTP
    const otpString = otp.toString().trim();
    const cleanEmail = email.toString().trim();
    const currentTime = new Date();
    console.log('[resetPassword] Searching for OTP - Email:', cleanEmail, 'OTP Code:', otpString, 'Current Time:', currentTime);
    
    // First, get all OTPs for this email to debug
    const allOTPs = await prisma.otp.findMany({
      where: { email: cleanEmail }
    });
    console.log('[resetPassword] All OTPs for email:', allOTPs.length);
    allOTPs.forEach((o, idx) => {
      console.log(`  [${idx}] Code: "${o.code}", Expiry: ${o.expiryAt}, Expired: ${o.expiryAt < currentTime}`);
    });
    
    const validOTP = await prisma.otp.findFirst({
      where: {
        email: cleanEmail,
        code: otpString,
        expiryAt: {
          gt: currentTime
        }
      }
    });

    console.log('[resetPassword] Valid OTP found:', validOTP ? 'yes' : 'no');
    
    if (!validOTP) {
      // Check if OTP exists but is expired
      const expiredOTP = await prisma.otp.findFirst({
        where: {
          email: cleanEmail,
          code: otpString
        }
      });
      
      if (expiredOTP) {
        console.log('[resetPassword] OTP found but expired. Expiry time:', expiredOTP.expiryAt, 'Current time:', currentTime);
        return res.status(401).json({
          success: false,
          message: 'OTP has expired. Please request a new one.'
        });
      }
      console.log('[resetPassword] OTP not found in database');
      
      return res.status(401).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    });

    // NOTE: OTP is NOT deleted - keeping all OTP records in database for audit trail
    // Previously: await prisma.otp.deleteMany({ where: { email } });

    console.log('[resetPassword] Password reset successful for:', email);
    res.status(200).json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message
    });
  }
};
export const logout = async (req, res) => {
  try {
    // Clear the authentication cookie
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax'
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: error.message
    });
  }
};