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
        subject: `Hospital Registration Approved - ${hospitalName}`,
        text: `Dear ${managerName},\n\nYour hospital registration for ${hospitalName} has been approved by the Turnly Admin team.\n\nYou can now open the Turnly app and log in with your registered account to access your Manager Dashboard, add departments, register doctors, and manage patient queues.\n\nIf you have any questions, please contact support at support@turnly.pk.\n\nBest regards,\nTurnly Team`,
        html: `
            <div style="font-family: Arial, sans-serif; font-size: 15px; color: #1e293b; line-height: 1.6; max-width: 550px;">
                <p>Dear <b>${managerName}</b>,</p>
                <p>Your hospital registration for <b>${hospitalName}</b> has been <b>approved</b> by the Turnly Admin team.</p>
                <p>You can now open the Turnly app and log in with your registered account to access your Manager Dashboard, add departments, register doctors, and manage patient queues.</p>
                <p>If you have any questions, feel free to reply to this email or contact support at support@turnly.pk.</p>
                <br>
                <p>Best regards,<br><b>Turnly Team</b></p>
            </div>
        `,
    });
};

// Send hospital rejection email to manager with reason
const sendRejectionEmail = async (toEmail, hospitalName, managerName, reason) => {
    const reasonText = reason ? reason.trim() : 'Please review and update your hospital details and documents.';
    return transporter.sendMail({
        from: `"Turnly" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: `Hospital Registration Update - ${hospitalName}`,
        text: `Dear ${managerName},\n\nThank you for submitting your hospital registration for ${hospitalName}.\n\nAfter reviewing your application, our admin team could not approve the registration at this time.\n\nReason: ${reasonText}\n\nPlease open the Turnly app, log in to your account, update the required details or documents, and resubmit for approval.\n\nIf you need any assistance, contact support at support@turnly.pk.\n\nBest regards,\nTurnly Team`,
        html: `
            <div style="font-family: Arial, sans-serif; font-size: 15px; color: #1e293b; line-height: 1.6; max-width: 550px;">
                <p>Dear <b>${managerName}</b>,</p>
                <p>Thank you for submitting your hospital registration for <b>${hospitalName}</b>.</p>
                <p>After reviewing your application, our admin team could not approve the registration at this time.</p>
                <p><b>Reason:</b><br>${reasonText}</p>
                <p>Please open the Turnly app, log in to your account, update the required details or documents, and resubmit for approval.</p>
                <p>If you need any assistance, contact support at support@turnly.pk.</p>
                <br>
                <p>Best regards,<br><b>Turnly Team</b></p>
            </div>
        `,
    });
};

// Send hospital suspension email to manager
const sendSuspensionEmail = async (toEmail, hospitalName, managerName, reason) => {
    return transporter.sendMail({
        from: `"Turnly" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: `Hospital Account Suspended - ${hospitalName}`,
        text: `Dear ${managerName},\n\nThis is to notify you that ${hospitalName} has been temporarily suspended by the Turnly Admin team.\n\n${reason ? `Reason: ${reason}\n\n` : ''}What this means:\nYour hospital is temporarily hidden from patients and queues are paused. Existing patient tokens remain preserved.\n\nTo resolve this and reactivate your account, please contact support at support@turnly.pk.\n\nBest regards,\nTurnly Team`,
        html: `
            <div style="font-family: Arial, sans-serif; font-size: 15px; color: #1e293b; line-height: 1.6; max-width: 550px;">
                <p>Dear <b>${managerName}</b>,</p>
                <p>This is to notify you that <b>${hospitalName}</b> has been temporarily suspended by the Turnly Admin team.</p>
                ${reason ? `<p><b>Reason:</b><br>${reason}</p>` : ''}
                <p><b>What this means:</b><br>Your hospital is temporarily hidden from patients and queues are paused. Existing patient tokens remain preserved.</p>
                <p>To resolve this and reactivate your account, please contact our support team at support@turnly.pk.</p>
                <br>
                <p>Best regards,<br><b>Turnly Team</b></p>
            </div>
        `,
    });
};

module.exports = { sendOtpEmail, sendResetEmail, sendApprovalEmail, sendRejectionEmail, sendSuspensionEmail };
