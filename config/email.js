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
        subject: `Your hospital registration has been approved - Turnly`,
        text: `Hello ${managerName},\n\nYour hospital registration for ${hospitalName} has been reviewed and approved by the Turnly team.\n\nYou can now log in to the Turnly mobile app using your manager account to set up departments, add doctors, and start managing queues.\n\nIf you have any questions or need assistance getting started, contact us at support@turnly.pk.\n\nThanks,\nTurnly Team`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px; color: #1e293b; line-height: 1.55;">
                <h3 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Turnly</h3>
                <p style="margin: 0 0 14px 0; font-size: 15px;">Hello ${managerName},</p>
                <p style="margin: 0 0 16px 0; font-size: 14.5px; color: #334155; line-height: 1.6;">
                    Your hospital registration for <strong>${hospitalName}</strong> has been reviewed and approved by the Turnly team.
                </p>

                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0 0 6px 0; font-size: 13.5px; font-weight: 600; color: #0f172a;">Next steps</p>
                    <p style="margin: 0; font-size: 13.5px; color: #475569; line-height: 1.5;">
                        You can now log in to the Turnly app using your manager account to set up departments, add doctors, and start managing queues.
                    </p>
                </div>

                <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">
                    If you have any questions or need assistance getting started, reach out to <a href="mailto:support@turnly.pk" style="color: #475569; text-decoration: underline;">support@turnly.pk</a>.
                </p>
                <p style="margin: 20px 0 0 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                    Turnly · Hospital Queue Management
                </p>
            </div>
        `,
    });
};

// Send hospital rejection email to manager with reason
const sendRejectionEmail = async (toEmail, hospitalName, managerName, reason) => {
    const reasonText = reason && reason.trim().length > 0
        ? reason.trim()
        : 'Please review and re-upload clear full-page hospital license documents and ensure all details are accurate.';

    return transporter.sendMail({
        from: `"Turnly" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: `Update regarding your hospital registration - Turnly`,
        text: `Hello ${managerName},\n\nThank you for submitting a registration for ${hospitalName}. Following our review, we were unable to approve your application in its current state.\n\nReview notes:\n${reasonText}\n\nHow to update and resubmit:\n1. Open the Turnly app and log in to your account.\n2. Tap "Edit application" on the status screen.\n3. Correct the requested details or re-upload documents, then resubmit for review.\n\nIf you have questions regarding this review, contact us at support@turnly.pk.\n\nThanks,\nTurnly Team`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px; color: #1e293b; line-height: 1.55;">
                <h3 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Turnly</h3>
                <p style="margin: 0 0 14px 0; font-size: 15px;">Hello ${managerName},</p>
                <p style="margin: 0 0 16px 0; font-size: 14.5px; color: #334155; line-height: 1.6;">
                    Thank you for submitting a registration for <strong>${hospitalName}</strong>. Following our review, we were unable to approve your application in its current state.
                </p>

                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Review notes</p>
                    <p style="margin: 0; font-size: 13.5px; color: #1e293b; line-height: 1.5;">
                        ${reasonText}
                    </p>
                </div>

                <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0 0 6px 0; font-size: 13.5px; font-weight: 600; color: #0f172a;">How to update and resubmit</p>
                    <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.55;">
                        1. Open the Turnly app and log in to your account.<br />
                        2. Tap <strong>Edit application</strong> on the status screen.<br />
                        3. Correct the requested details or re-upload documents, then resubmit for review.
                    </p>
                </div>

                <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">
                    If you have questions regarding this review, contact us at <a href="mailto:support@turnly.pk" style="color: #475569; text-decoration: underline;">support@turnly.pk</a>.
                </p>
                <p style="margin: 20px 0 0 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                    Turnly · Hospital Queue Management
                </p>
            </div>
        `,
    });
};

// Send hospital suspension email to manager
const sendSuspensionEmail = async (toEmail, hospitalName, managerName, reason) => {
    const reasonText = reason && reason.trim().length > 0
        ? reason.trim()
        : 'Temporary operational suspension pending administrative and policy compliance review.';

    return transporter.sendMail({
        from: `"Turnly" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: `Notice: Hospital account status update - ${hospitalName}`,
        text: `Hello ${managerName},\n\nThis is an official notice that platform access for ${hospitalName} has been temporarily suspended by the Turnly administration team.\n\nAdministrative note:\n${reasonText}\n\nWhat this means:\n• Your hospital is temporarily not visible to patients in the app.\n• New token bookings and active queues are paused.\n• All existing patient records and history remain preserved.\n\nTo discuss this notice or request account reactivation, please contact our administrative team at support@turnly.pk.\n\nThanks,\nTurnly Team`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px; color: #1e293b; line-height: 1.55;">
                <h3 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Turnly</h3>
                <p style="margin: 0 0 14px 0; font-size: 15px;">Hello ${managerName},</p>
                <p style="margin: 0 0 16px 0; font-size: 14.5px; color: #334155; line-height: 1.6;">
                    This is an official notice that platform access for <strong>${hospitalName}</strong> has been temporarily suspended by the Turnly administration team.
                </p>

                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Administrative note</p>
                    <p style="margin: 0; font-size: 13.5px; color: #1e293b; line-height: 1.5;">
                        ${reasonText}
                    </p>
                </div>

                <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0 0 6px 0; font-size: 13.5px; font-weight: 600; color: #0f172a;">What this means</p>
                    <ul style="margin: 6px 0 0 0; padding-left: 18px; font-size: 13px; color: #475569; line-height: 1.55;">
                        <li>Your hospital is temporarily not visible to patients in the app.</li>
                        <li>New token bookings and active queues are paused.</li>
                        <li>All existing patient records and history remain preserved.</li>
                    </ul>
                </div>

                <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">
                    To discuss this notice or request account reactivation, please contact our administrative team at <a href="mailto:support@turnly.pk" style="color: #475569; text-decoration: underline;">support@turnly.pk</a>.
                </p>
                <p style="margin: 20px 0 0 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                    Turnly · Hospital Queue Management
                </p>
            </div>
        `,
    });
};

module.exports = { sendOtpEmail, sendResetEmail, sendApprovalEmail, sendRejectionEmail, sendSuspensionEmail };
