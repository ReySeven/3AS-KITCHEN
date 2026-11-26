import * as userService from '../services/userService.js';

export const getAll = async (req, res) => {
    const users = await userService.fetchAllUsers();
    res.status(200).json({ success: true, users });
};

// POST /users/register  — called after OTP is verified
export const createAccount = async (req, res) => {
    const { first_name, last_name, email, password } = req.body;
    try {
        const result = await userService.createAccount(
            { first_name, last_name, email, password }
        );
        res.status(200).json({ success: true, message: result });
    } catch (e) {
        console.error('[register]', e.message);
        res.status(400).json({ error: e.message || 'Internal Server Error' });
    }
};

// POST /users/login
export const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await userService.login({ email, password });
        req.session.user = {
            id:      result.id,
            name:    result.name,
            email:   result.email,
            role:    result.role,
            riderId: result.riderId,
        };
        res.status(200).json({ success: true, user: req.session.user });
    } catch (e) {
        console.error('[login]', e.message);
        res.status(400).json({ error: e.message || 'Internal Server Error' });
    }
};

// POST /users/logout
export const logout = (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'Logout failed.' });
        res.clearCookie('connect.sid');
        res.status(200).json({ success: true, message: 'Logged out.' });
    });
};

// GET /users/me
export const me = (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }
    res.status(200).json(req.session.user);
};
