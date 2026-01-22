import express from 'express';
import nodemailer from 'nodemailer';

const router = express.Router();

// Create transporter using Gmail (you can change to other providers)
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER || 'umarahadusmani@gmail.com',
            pass: process.env.EMAIL_PASS // Gmail App Password
        }
    });
};

// @route   POST /api/contact
// @desc    Send contact form email
// @access  Public
router.post('/', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // Validate input
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // If EMAIL_PASS is not set, just simulate success
        if (!process.env.EMAIL_PASS) {
            console.log('Contact form submission (email not configured):');
            console.log({ name, email, subject, message });
            return res.json({
                success: true,
                message: 'Thank you for your message! We will get back to you soon.'
            });
        }

        const transporter = createTransporter();

        // Email to site owner
        const mailOptions = {
            from: `"Bit Brainic Contact" <${process.env.EMAIL_USER || 'umarahadusmani@gmail.com'}>`,
            to: 'umarahadusmani@gmail.com',
            replyTo: email,
            subject: `[Bit Brainic Contact] ${subject}`,
            html: `
                <h2>New Contact Form Submission</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <hr>
                <p><strong>Message:</strong></p>
                <p>${message.replace(/\n/g, '<br>')}</p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                    This message was sent from the Bit Brainic contact form.
                </p>
            `
        };

        await transporter.sendMail(mailOptions);

        // Auto-reply to user
        const autoReplyOptions = {
            from: `"Bit Brainic" <${process.env.EMAIL_USER || 'umarahadusmani@gmail.com'}>`,
            to: email,
            subject: 'Thank you for contacting Bit Brainic!',
            html: `
                <h2>Thank you for reaching out, ${name}! 🧠</h2>
                <p>We have received your message and will get back to you as soon as possible.</p>
                <p><strong>Your message:</strong></p>
                <blockquote style="background: #f5f5f5; padding: 15px; border-left: 4px solid #7c3aed;">
                    ${message.replace(/\n/g, '<br>')}
                </blockquote>
                <p>In the meantime, feel free to explore our platform!</p>
                <br>
                <p>Best regards,<br>The Bit Brainic Team</p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                    📍 Riphah International University, Raiwind, Lahore<br>
                    📞 +92 333 4739757<br>
                    📧 umarahadusmani@gmail.com
                </p>
            `
        };

        await transporter.sendMail(autoReplyOptions);

        res.json({
            success: true,
            message: 'Thank you for your message! We will get back to you soon.'
        });

    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({
            message: 'Failed to send message. Please try again later.'
        });
    }
});

export default router;
