import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import protect from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../services/email.js';

const router = express.Router();

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                interests: user.interests,
                persona: user.persona,
                token: generateToken(user._id)
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for user email
        const user = await User.findOne({ email }).select('+password');

        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                interests: user.interests,
                persona: user.persona,
                token: generateToken(user._id)
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            interests: user.interests,
            persona: user.persona,
            createdAt: user.createdAt
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Please provide an email address' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            // Don't reveal if user exists or not for security
            return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
        }

        // Get reset token
        const resetToken = user.getResetPasswordToken();
        await user.save({ validateBeforeSave: false });

        // Create reset URL
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

        try {
            await sendPasswordResetEmail(user.email, resetUrl, user.name);
            res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
        } catch (emailError) {
            console.error('Email error:', emailError);
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save({ validateBeforeSave: false });
            return res.status(500).json({ message: 'Email could not be sent. Please try again later.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/auth/reset-password/:token
// @desc    Reset password using token
// @access  Public
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ message: 'Please provide a new password' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        // Get hashed token
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        // Find user with valid token
        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        // Set new password
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.json({ message: 'Password reset successful. You can now sign in with your new password.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile (name, email)
// @access  Private
router.put('/profile', protect, async (req, res) => {
    try {
        const { name, email } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if email is being changed and if it's already taken
        if (email && email !== user.email) {
            const emailExists = await User.findOne({ email });
            if (emailExists) {
                return res.status(400).json({ message: 'Email already in use' });
            }
            user.email = email;
        }

        if (name) {
            user.name = name;
        }

        await user.save();

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            interests: user.interests,
            persona: user.persona
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
});

// @route   PUT /api/auth/password
// @desc    Update user password
// @access  Private
router.put('/password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Please provide current and new password' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.user._id).select('+password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check current password
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/auth/interests
// @desc    Update user interests
// @access  Private
router.put('/interests', protect, async (req, res) => {
    try {
        const { interests } = req.body;

        if (!Array.isArray(interests)) {
            return res.status(400).json({ message: 'Interests must be an array' });
        }

        if (interests.length > 20) {
            return res.status(400).json({ message: 'Cannot have more than 20 interests' });
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { interests },
            { new: true }
        );

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            interests: user.interests,
            persona: user.persona
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/auth/persona
// @desc    Update user persona prompt
// @access  Private
router.put('/persona', protect, async (req, res) => {
    try {
        const { persona } = req.body;

        if (typeof persona !== 'string') {
            return res.status(400).json({ message: 'Persona must be a string' });
        }

        if (persona.length > 500) {
            return res.status(400).json({ message: 'Persona cannot be more than 500 characters' });
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { persona },
            { new: true }
        );

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            interests: user.interests,
            persona: user.persona
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/auth/account
// @desc    Delete user account and all associated data
// @access  Private
router.delete('/account', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        // Get all user's chats
        const chats = await Chat.find({ userId });
        const chatIds = chats.map(chat => chat._id);

        // Delete all messages in user's chats
        await Message.deleteMany({ chatId: { $in: chatIds } });

        // Delete all user's chats
        await Chat.deleteMany({ userId });

        // Delete the user
        await User.findByIdAndDelete(userId);

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
