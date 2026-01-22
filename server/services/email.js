import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
    // Create transporter
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD
        }
    });

    // Define email options
    const mailOptions = {
        from: `${process.env.FROM_NAME || 'Bit Brainic'} <${process.env.SMTP_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        html: options.html
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ', info.messageId);
    return info;
};

// Password reset email template
export const sendPasswordResetEmail = async (email, resetUrl, userName) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Bit Brainic</h1>
                </td>
            </tr>
            <tr>
                <td style="padding: 40px 30px;">
                    <h2 style="color: #333333; margin: 0 0 20px;">Password Reset Request</h2>
                    <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                        Hi ${userName || 'there'},
                    </p>
                    <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                        We received a request to reset your password. Click the button below to create a new password:
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                            Reset Password
                        </a>
                    </div>
                    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 10px;">
                        Or copy and paste this link into your browser:
                    </p>
                    <p style="color: #667eea; font-size: 14px; word-break: break-all; margin: 0 0 20px;">
                        ${resetUrl}
                    </p>
                    <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 0 0 10px;">
                        <strong>This link will expire in 10 minutes.</strong>
                    </p>
                    <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 0;">
                        If you didn't request a password reset, please ignore this email or contact support if you have concerns.
                    </p>
                </td>
            </tr>
            <tr>
                <td style="padding: 30px; text-align: center; background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
                    <p style="color: #999999; font-size: 12px; margin: 0;">
                        © ${new Date().getFullYear()} Bit Brainic. All rights reserved.
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    await sendEmail({
        email,
        subject: 'Password Reset Request - Bit Brainic',
        html
    });
};

export default sendEmail;
