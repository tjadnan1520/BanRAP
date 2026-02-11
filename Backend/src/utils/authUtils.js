import bcrypt from 'bcryptjs';

export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhone = (phone) => {
  // Accept Bangladeshi format: +880 followed by operator code and 8 digits (total 13 digits)
  // Or 11 digits without country code (01X followed by 8 digits)
  const phoneRegex = /^(?:\+?880|0)1[3-9]\d{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

export const isValidPassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};
