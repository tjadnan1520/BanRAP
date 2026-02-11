import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

export const sendOTPEmail = async (email, otp) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP for Password Reset - BanRAP',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
              .container { max-width: 500px; margin: 20px auto; background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .header { text-align: center; color: #333; margin-bottom: 20px; }
              .otp-box { background-color: #f0f0f0; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
              .otp-code { font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; }
              .message { color: #666; font-size: 14px; margin-top: 15px; }
              .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 15px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Password Reset Request</h1>
              </div>
              
              <p>Hello,</p>
              <p>We received a request to reset your password. Use the OTP below to proceed:</p>
              
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              
              <p class="message">
                <strong>Important:</strong> This OTP is valid for 1.5 minutes only. Do not share it with anyone.
              </p>
              
              <p>If you did not request a password reset, please ignore this email.</p>
              
              <div class="footer">
                <p>&copy; 2026 BanRAP - Road Safety Assessment Program</p>
              </div>
            </div>
          </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw error;
  }
};

export default transporter;
