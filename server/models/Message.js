import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat',
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'bot'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Index for faster queries
messageSchema.index({ chatId: 1, timestamp: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
