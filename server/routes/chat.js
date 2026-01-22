import express from 'express';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import protect from '../middleware/auth.js';
import { generateResponse } from '../services/gemini.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// @route   GET /api/chat
// @desc    Get all chats for user
// @access  Private
router.get('/', async (req, res) => {
    try {
        const chats = await Chat.find({ userId: req.user._id })
            .sort({ updatedAt: -1 });
        res.json(chats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/chat
// @desc    Create a new chat
// @access  Private
router.post('/', async (req, res) => {
    try {
        const chat = await Chat.create({
            userId: req.user._id,
            title: req.body.title || 'New Chat'
        });
        res.status(201).json(chat);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/chat/:id
// @desc    Get a chat with its messages
// @access  Private
router.get('/:id', async (req, res) => {
    try {
        const chat = await Chat.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!chat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        const messages = await Message.find({ chatId: chat._id })
            .sort({ timestamp: 1 });

        res.json({
            ...chat.toObject(),
            messages
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/chat/:id/message
// @desc    Send a message and get AI response
// @access  Private
router.post('/:id/message', async (req, res) => {
    try {
        const chat = await Chat.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!chat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ message: 'Message content is required' });
        }

        // Save user message
        const userMessage = await Message.create({
            chatId: chat._id,
            role: 'user',
            content
        });

        // Get existing messages for context
        const existingMessages = await Message.find({ chatId: chat._id })
            .sort({ timestamp: 1 });

        // Generate AI response with user's persona and interests
        const aiResponse = await generateResponse(existingMessages, req.user);

        // Save bot message
        const botMessage = await Message.create({
            chatId: chat._id,
            role: 'bot',
            content: aiResponse
        });

        // Update chat title if it's the first message
        if (existingMessages.length <= 1) {
            // Generate a title from the first message (truncated)
            const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
            chat.title = title;
            await chat.save();
        } else {
            // Just update the timestamp
            chat.updatedAt = Date.now();
            await chat.save();
        }

        res.json({
            userMessage,
            botMessage,
            chatTitle: chat.title
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
});

// @route   PUT /api/chat/:id
// @desc    Update chat title
// @access  Private
router.put('/:id', async (req, res) => {
    try {
        const chat = await Chat.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { title: req.body.title },
            { new: true }
        );

        if (!chat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        res.json(chat);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/chat/:id
// @desc    Delete a chat and its messages
// @access  Private
router.delete('/:id', async (req, res) => {
    try {
        const chat = await Chat.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!chat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        // Delete all messages in the chat
        await Message.deleteMany({ chatId: chat._id });

        // Delete the chat
        await chat.deleteOne();

        res.json({ message: 'Chat deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
