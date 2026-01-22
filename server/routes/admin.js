import express from 'express';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import { adminAuth, adminProtect } from '../middleware/admin.js';

const router = express.Router();

// Helper function to fill missing days in activity data
const fillMissingDays = (data, days = 7) => {
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const existingData = data.find(d => d._id === dateStr);
        result.push({
            _id: dateStr,
            count: existingData ? existingData.count : 0
        });
    }

    return result;
};

// @route   POST /api/admin/verify
// @desc    Verify admin password
// @access  Public (but requires password)
router.post('/verify', adminAuth, (req, res) => {
    res.json({ success: true, message: 'Admin verified' });
});

// @route   GET /api/admin/public-stats
// @desc    Get public statistics for About page (no auth required)
// @access  Public
router.get('/public-stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalMessages = await Message.countDocuments();

        // Calculate average rating (simulated - could be real reviews in future)
        // For now, return a base rating that increases slightly with users
        const avgRating = Math.min(4.9, 4.5 + (totalUsers * 0.001)).toFixed(1);

        res.json({
            totalUsers,
            totalMessages,
            avgRating
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/admin/stats
// @desc    Get admin statistics
// @access  Admin
router.get('/stats', adminProtect, async (req, res) => {
    try {
        // Total users
        const totalUsers = await User.countDocuments();

        // New users this week
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const newUsersThisWeek = await User.countDocuments({
            createdAt: { $gte: oneWeekAgo }
        });

        // Total chats
        const totalChats = await Chat.countDocuments();

        // Total messages
        const totalMessages = await Message.countDocuments();

        // Average messages per chat
        const avgMessagesPerChat = totalChats > 0
            ? Math.round(totalMessages / totalChats)
            : 0;

        // User activity over the last 7 days
        const userActivityRaw = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: oneWeekAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Chat activity over the last 7 days
        const chatActivityRaw = await Chat.aggregate([
            {
                $match: {
                    createdAt: { $gte: oneWeekAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Fill missing days for charts
        const userActivityByDay = fillMissingDays(userActivityRaw);
        const chatActivityByDay = fillMissingDays(chatActivityRaw);

        // Top active users
        const topUsers = await Chat.aggregate([
            {
                $group: {
                    _id: '$userId',
                    chatCount: { $sum: 1 }
                }
            },
            { $sort: { chatCount: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $project: {
                    _id: 1,
                    chatCount: 1,
                    name: { $arrayElemAt: ['$user.name', 0] },
                    email: { $arrayElemAt: ['$user.email', 0] }
                }
            }
        ]);

        res.json({
            overview: {
                totalUsers,
                newUsersThisWeek,
                totalChats,
                totalMessages,
                avgMessagesPerChat
            },
            charts: {
                userActivityByDay,
                chatActivityByDay
            },
            topUsers
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination
// @access  Admin
router.get('/users', adminProtect, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        // Build search query
        const searchQuery = search
            ? {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            }
            : {};

        const users = await User.find(searchQuery)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments(searchQuery);

        // Get chat counts for each user
        const userIds = users.map(u => u._id);
        const chatCounts = await Chat.aggregate([
            { $match: { userId: { $in: userIds } } },
            { $group: { _id: '$userId', count: { $sum: 1 } } }
        ]);

        const usersWithStats = users.map(user => {
            const chatData = chatCounts.find(c => c._id.toString() === user._id.toString());
            return {
                ...user.toObject(),
                chatCount: chatData ? chatData.count : 0
            };
        });

        res.json({
            users: usersWithStats,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/admin/users/:id
// @desc    Get single user details
// @access  Admin
router.get('/users/:id', adminProtect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get user's chat count and message count
        const chatCount = await Chat.countDocuments({ userId: user._id });
        const chats = await Chat.find({ userId: user._id });
        const chatIds = chats.map(c => c._id);
        const messageCount = await Message.countDocuments({ chatId: { $in: chatIds } });

        res.json({
            ...user.toObject(),
            chatCount,
            messageCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user
// @access  Admin
router.put('/users/:id', adminProtect, async (req, res) => {
    try {
        const { name, email, interests, persona } = req.body;

        const user = await User.findById(req.params.id);

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

        if (name !== undefined) user.name = name;
        if (interests !== undefined) user.interests = interests;
        if (persona !== undefined) user.persona = persona;

        await user.save();

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
        res.status(500).json({ message: error.message || 'Server error' });
    }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user and all their data
// @access  Admin
router.delete('/users/:id', adminProtect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get all user's chats
        const chats = await Chat.find({ userId: user._id });
        const chatIds = chats.map(chat => chat._id);

        // Delete all messages in user's chats
        await Message.deleteMany({ chatId: { $in: chatIds } });

        // Delete all user's chats
        await Chat.deleteMany({ userId: user._id });

        // Delete the user
        await User.findByIdAndDelete(req.params.id);

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
