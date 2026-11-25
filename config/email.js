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

// send password reset code
const sendResetEmail = async (toEmail, otpCode, userName) => {
    return transporter.sendMail({
        from: `"Turnly" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: `${otpCode} is your Turnly password reset code`,
        text: `Hello ${userName},\n\nYour Turnly password reset code is: ${otpCode}\n\nThis code is valid for 10 minutes. If you did not request a reset, please ignore this email.\n\nThanks,\nTurnly Team`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 460px; margin: 0 auto; padding: 24px 16px; color: #1e293b; line-height: 1.5;">
                <h3 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Turnly</h3>
                <p style="margin: 0 0 12px 0; font-size: 15px;">Hello ${userName},</p>
                <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">Use this code to reset your Turnly password:</p>
                <div style="font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #0f172a; margin: 16px 0 24px 0;">${otpCode}</div>
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">This code expires in 10 minutes.</p>
                <p style="margin: 0; font-size: 13px; color: #94a3b8;">If you did not request this, you can safely ignore this email.</p>
            </div>
        `,
    });
};


// Send hospital approval email to manager
const sendApprovalEmail = async (toEmail, hospitalName, managerName) => {
    return transporter.sendMail({
        from: `"Turnly" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: `🎉 Hospital Registration Approved - ${hospitalName}`,
        text: `Hello ${managerName},\n\nGreat news! Your registration for ${hospitalName} has been reviewed and approved by the Turnly Admin team.\n\nPlease open the Turnly app and log in to your account to access your Hospital Manager Portal.\n\nThanks,\nTurnly Team`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h2 style="color: #0d9488; margin-top: 0;">Registration Approved! 🎉</h2>
                <p>Hello <b>${managerName}</b>,</p>
                <p>Great news! Your registration for <b>${hospitalName}</b> has been reviewed and <b>approved</b> by the Turnly Admin team.</p>
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 22px 0; text-align: center;">
                    <p style="margin: 0; font-size: 15px; font-weight: 600; color: #166534;">
                        📱 Please open the Turnly app and log in to access your portal.
                    </p>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: #15803d;">
                        You can now add departments, register doctors, and begin managing patient queues.
                    </p>
                </div>
                <p style="color: #64748b; font-size: 13px;">If you have any questions, feel free to reply to this email.</p>
                <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Team Turnly</p>
            </div>
        `,
    });
};

// Send hospital rejection email to manager with reason
const sendRejectionEmail = async (toEmail, hospitalName, managerName, reason) => {
    return transporter.sendMail({
        from: `"Turnly" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: `⚠️ Hospital Registration Update - ${hospitalName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; borderRadius: 12px;">
                <h2 style="color: #dc2626; margin-top: 0;">Registration Review Update</h2>
                <p>Hello <b>${managerName}</b>,</p>
                <p>Thank you for submitting your hospital registration for <b>${hospitalName}</b>.</p>
                <p>After reviewing your submitted documents and details, our team could not approve the registration at this time.</p>
                <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 20px 0;">
                    <p style="margin: 0; font-weight: bold; color: #991b1b;">Reason for rejection:</p>
                    <p style="margin: 6px 0 0 0; color: #7f1d1d;">${reason || 'Please verify license documents and accurate hospital information.'}</p>
                </div>
                <p>You can re-open the Turnly app, review your details, update documents, and <b>resubmit</b> for approval.</p>
                <p style="color: #64748b; font-size: 13px;">Need assistance? Contact us at support@turnly.pk</p>
                <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Team Turnly</p>
            </div>
        `,
    });
};

module.exports = { sendOtpEmail, sendResetEmail, sendApprovalEmail, sendRejectionEmail
 };
