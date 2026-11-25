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
        subject: `Registration Approved - ${hospitalName}`,
        text: `Dear ${managerName},\n\nGreat news! Your hospital registration for ${hospitalName} has been reviewed and approved by the Turnly Admin team.\n\nPlease open the Turnly mobile app and log in to your account. You can now access your Hospital Manager Portal, add departments, register doctors, and begin managing patient queues.\n\nIf you have any questions, contact support at support@turnly.pk.\n\nBest regards,\nTurnly Team`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
                <div style="border-bottom: 2px solid #0d9488; padding-bottom: 12px; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #0d9488; font-size: 22px; font-weight: 700;">Turnly</h2>
                </div>
                <div style="display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; background-color: #dcfce7; color: #15803d; margin-bottom: 14px;">
                    STATUS: APPROVED
                </div>
                <h3 style="margin: 0 0 14px 0; color: #0f172a; font-size: 18px;">Registration Approved</h3>
                <p style="margin: 0 0 12px 0; font-size: 14.5px; line-height: 1.6;">Dear <b>${managerName}</b>,</p>
                <p style="margin: 0 0 14px 0; font-size: 14.5px; line-height: 1.6;">
                    Great news! Your registration for <b>${hospitalName}</b> has been reviewed and <b>approved</b> by the Turnly Administration team.
                </p>
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px; margin: 18px 0;">
                    <p style="margin: 0; font-size: 13.5px; font-weight: 600; color: #166534;">
                        Next step: Access your manager portal
                    </p>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: #15803d; line-height: 1.5;">
                        Please open the Turnly mobile app and log in with your registered account. You can now add departments, register doctors, and begin managing live patient queues.
                    </p>
                </div>
                <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">
                    If you have any questions or need onboarding help, please contact our support team at <a href="mailto:support@turnly.pk" style="color: #0d9488; text-decoration: none; font-weight: 600;">support@turnly.pk</a>.
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0 12px 0;" />
                <p style="margin: 0; font-size: 12px; color: #94a3b8;">Team Turnly · Hospital Queue Management System</p>
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
        subject: `Hospital Registration Update - ${hospitalName}`,
        text: `Dear ${managerName},\n\nThank you for submitting your hospital registration for ${hospitalName}.\n\nDuring our initial registration review, our verification team was unable to approve your application at this time.\n\nReason from admin:\n${reasonText}\n\nHow to fix & resubmit:\n1. Open the Turnly app and log in to your account.\n2. On the status screen, tap "Edit application".\n3. Update the necessary details or upload clearer documents, then tap "Resubmit".\n\nIf you need assistance, please contact support at support@turnly.pk.\n\nBest regards,\nTurnly Team`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
                <div style="border-bottom: 2px solid #0d9488; padding-bottom: 12px; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #0d9488; font-size: 22px; font-weight: 700;">Turnly</h2>
                </div>
                <div style="display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; background-color: #fee2e2; color: #991b1b; margin-bottom: 14px;">
                    STATUS: REGISTRATION NOT APPROVED
                </div>
                <h3 style="margin: 0 0 14px 0; color: #0f172a; font-size: 18px;">Registration Review Update</h3>
                <p style="margin: 0 0 12px 0; font-size: 14.5px; line-height: 1.6;">Dear <b>${managerName}</b>,</p>
                <p style="margin: 0 0 14px 0; font-size: 14.5px; line-height: 1.6;">
                    Thank you for submitting your hospital registration for <b>${hospitalName}</b>. During our onboarding review, our verification team was unable to approve the application at this stage.
                </p>
                <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 16px; margin: 18px 0;">
                    <p style="margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; color: #991b1b; text-transform: uppercase;">
                        REASON FROM VERIFICATION TEAM:
                    </p>
                    <p style="margin: 6px 0 0 0; font-size: 13.5px; color: #7f1d1d; line-height: 1.5;">
                        ${reasonText}
                    </p>
                </div>
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 18px 0;">
                    <p style="margin: 0; font-size: 13.5px; font-weight: 600; color: #334155;">
                        How to edit and resubmit:
                    </p>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: #475569; line-height: 1.5;">
                        1. Open the Turnly app and log in with your registered account.<br />
                        2. Tap <b>Edit application</b> on the rejection screen.<br />
                        3. Review or update your information, re-upload clear documents, and tap <b>Resubmit</b>.
                    </p>
                </div>
                <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">
                    Need help with your documents? Contact our support team at <a href="mailto:support@turnly.pk" style="color: #0d9488; text-decoration: none; font-weight: 600;">support@turnly.pk</a>.
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0 12px 0;" />
                <p style="margin: 0; font-size: 12px; color: #94a3b8;">Team Turnly · Hospital Queue Management System</p>
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
        subject: `⚠️ Hospital Account Suspended - ${hospitalName}`,
        text: `Dear ${managerName},\n\nThis is an official notice that the operational status of ${hospitalName} on Turnly has been temporarily suspended by the Turnly Administration team.\n\nCompliance / Administrative Note:\n${reasonText}\n\nWhat this means:\n• Your hospital is temporarily hidden from patients searching on Turnly.\n• Active patient queues and doctor token bookings are paused.\n• Existing patient tokens and records remain preserved safely.\n\nTo resolve this suspension or discuss reactivation, please contact support at support@turnly.pk.\n\nBest regards,\nTurnly Team`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
                <div style="border-bottom: 2px solid #0d9488; padding-bottom: 12px; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #0d9488; font-size: 22px; font-weight: 700;">Turnly</h2>
                </div>
                <div style="display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; background-color: #fef3c7; color: #92400e; margin-bottom: 14px;">
                    STATUS: HOSPITAL SUSPENDED
                </div>
                <h3 style="margin: 0 0 14px 0; color: #0f172a; font-size: 18px;">Notice of Hospital Account Suspension</h3>
                <p style="margin: 0 0 12px 0; font-size: 14.5px; line-height: 1.6;">Dear <b>${managerName}</b>,</p>
                <p style="margin: 0 0 14px 0; font-size: 14.5px; line-height: 1.6;">
                    This is an official notice that the platform access and operational status of <b>${hospitalName}</b> has been <b>temporarily suspended</b> by the Turnly Administration team.
                </p>
                <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 16px; margin: 18px 0;">
                    <p style="margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; color: #92400e; text-transform: uppercase;">
                        ADMINISTRATIVE / COMPLIANCE NOTE:
                    </p>
                    <p style="margin: 6px 0 0 0; font-size: 13.5px; color: #78350f; line-height: 1.5;">
                        ${reasonText}
                    </p>
                </div>
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 18px 0;">
                    <p style="margin: 0; font-size: 13.5px; font-weight: 600; color: #334155;">
                        What this means for your facility:
                    </p>
                    <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
                        <li>Your hospital is temporarily hidden from patients searching in the mobile app.</li>
                        <li>Live patient queues and new doctor token bookings are temporarily paused.</li>
                        <li>Existing patient tokens and records remain preserved safely in the database.</li>
                    </ul>
                </div>
                <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">
                    To appeal this suspension, resolve any policy issues, or request reactivation, please contact our administrative team directly at <a href="mailto:support@turnly.pk" style="color: #0d9488; text-decoration: none; font-weight: 600;">support@turnly.pk</a>.
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0 12px 0;" />
                <p style="margin: 0; font-size: 12px; color: #94a3b8;">Team Turnly · Hospital Queue Management System</p>
            </div>
        `,
    });
};

module.exports = { sendOtpEmail, sendResetEmail, sendApprovalEmail, sendRejectionEmail, sendSuspensionEmail };
