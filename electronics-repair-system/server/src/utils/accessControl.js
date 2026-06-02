function legacyUtf8Text(text) {
    return Buffer.from(text, 'utf8').toString('latin1');
}

function normalizeRole(role = '') {
    return String(role).trim().toLowerCase();
}

function hasRole(user, roles) {
    const currentRole = normalizeRole(user?.role);
    return roles.some((role) => currentRole === normalizeRole(role) || currentRole === normalizeRole(legacyUtf8Text(role)));
}

function isAdmin(user) {
    return hasRole(user, ['адмін', 'admin', 'administrator']);
}

function isManager(user) {
    return hasRole(user, ['менеджер', 'manager']);
}

function isMaster(user) {
    return hasRole(user, ['майстер', 'master']);
}

function canSeeAllOrders(user) {
    return isAdmin(user) || isManager(user);
}

function requireAnyRole(...roles) {
    return (req, res, next) => {
        if (hasRole(req.user, roles)) {
            return next();
        }

        return res.status(403).json({ error: 'Недостатньо прав доступу' });
    };
}

module.exports = {
    hasRole,
    isAdmin,
    isManager,
    isMaster,
    canSeeAllOrders,
    requireAnyRole,
};
