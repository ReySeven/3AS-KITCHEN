import pool from '../config/db.js';
import crypto from 'crypto';

const sha = c => crypto.createHash('sha256').update(String(c)).digest('hex');

// delete existing then insert new token
export const save = async (email, code, expiresAt) => {
    await pool.query('DELETE FROM otp_tokens WHERE email = ?', [email]);
    await pool.query(
        `INSERT INTO otp_tokens (email, code_hash, expires_at, attempts)
         VALUES (?, ?, ?, 3)`,
        [email, sha(code), expiresAt]
    );
};

// find token by email
export const findByEmail = async (email) => {
    const [rows] = await pool.query(
        `SELECT * FROM otp_tokens WHERE email = ?
         ORDER BY created_at DESC LIMIT 1`,
        [email]
    );
    return rows[0] || null;
};

// decrement attempts by 1
export const decrementAttempts = async (email) => {
    await pool.query(
        `UPDATE otp_tokens SET attempts = attempts - 1 WHERE email = ?`,
        [email]
    );
};

// remove token after successful verification
export const remove = async (email) => {
    await pool.query('DELETE FROM otp_tokens WHERE email = ?', [email]);
};

export { sha };
