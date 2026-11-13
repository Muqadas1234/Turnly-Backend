const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

transporter.verify()
    .then(() => console.log('Mail service ready'))
    .catch((err) => console.error('Mail service error:', err.message));

// send simple verification email
const sendOtpEmail = async (toEmail, otpCode, userName) => {
    const mailOptions = {
        from: `"Turnly" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: `${otpCode} is your Turnly verification code`,
        text: `Hello ${userName},\n\nYour Turnly verification code is: ${otpCode}\n\nThis code is valid for 10 minutes. If you did not request this, please ignore this email.\n\nThanks,\nTurnly Team`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 460px; margin: 0 auto; padding: 24px 16px; color: #1e293b; line-height: 1.5;">
                <h3 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Turnly</h3>
                <p style="margin: 0 0 12px 0; font-size: 15px;">Hello ${userName},</p>
                <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">Use the following code to verify your Turnly account:</p>
                
                <div style="font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #0f172a; margin: 16px 0 24px 0;">
                    ${otpCode}
                </div>

                <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">This code expires in 10 minutes.</p>
                <p style="margin: 0; font-size: 13px; color: #94a3b8;">If you did not request this code, you can safely ignore this email.</p>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
};

module.exports = { sendOtpEmail };
