import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import adminRoutes from './routes/admin.js';
import contactRoutes from './routes/contact.js';

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the correct path
dotenv.config({ path: join(__dirname, '.env') });

// Verify MongoDB URI is loaded
if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI is not set in .env file');
    process.exit(1);
}

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
// Configure CORS
const clientUrl = process.env.CLIENT_URL || (process.env.NODE_ENV === 'production'
    ? 'https://www.bitbrainic.dev/' // replace with your real frontend URL in production
    : 'https://mern-stack-bi-git-674e5c-umar-ahad-uddin-ahmed-usmanis-projects.vercel.app/');

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (origin === clientUrl) return callback(null, true);
        return callback(new Error('CORS policy: Origin not allowed'));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
// Enable pre-flight across the board
app.options('*', cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);

// Health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Bit Brainic API is running!' });
});

// --- Error Handling Middleware ---
// 404 Not Found Handler
app.use((req, res, next) => {
    res.status(404).json({ message: `Not Found - ${req.originalUrl}` });
});

// General Error Handler
app.use((err, req, res, next) => {
    // Default to 500 server error
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Something went wrong!';

    // Mongoose Bad ObjectId
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
        statusCode = 404;
        message = 'Resource not found';
    }

    // Mongoose Validation Error
    if (err.name === 'ValidationError') {
        statusCode = 400;
        const messages = Object.values(err.errors).map(val => val.message);
        message = `Invalid input data: ${messages.join('. ')}`;
    }

    // Mongoose Duplicate Key Error
    if (err.code === 11000) {
        statusCode = 400;
        const field = Object.keys(err.keyValue)[0];
        message = `Duplicate field value entered: '${field}' already exists.`;
    }

    // Log the error in development for debugging
    if (process.env.NODE_ENV !== 'production') {
        console.error('--- ERROR ---');
        console.error(`Status: ${statusCode}`);
        console.error(`Message: ${message}`);
        console.error('Stack:', err.stack);
        console.error('--- END ERROR ---');
    }

    res.status(statusCode).json({
        message,
        // Optionally include stack trace in development
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
