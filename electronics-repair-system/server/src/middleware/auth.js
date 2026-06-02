const jwt = require('jsonwebtoken');

function createAuthMiddleware(jwtSecret) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Немає токена' });
        }

        try {
            req.user = jwt.verify(token, jwtSecret);
            next();
        } catch {
            return res.status(401).json({ error: 'Невірний токен' });
        }
    };
}

module.exports = {
    createAuthMiddleware,
};
