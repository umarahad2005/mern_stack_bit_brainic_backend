const adminAuth = (req, res, next) => {
    const { password } = req.body;

    if (!password) {
        return res.status(401).json({ message: 'Admin password required' });
    }

    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Invalid admin password' });
    }

    next();
};

// Middleware for protected admin routes (uses header)
const adminProtect = (req, res, next) => {
    const adminPassword = req.headers['x-admin-password'];

    if (!adminPassword) {
        return res.status(401).json({ message: 'Admin password required in header' });
    }

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Invalid admin password' });
    }

    next();
};

export { adminAuth, adminProtect };
