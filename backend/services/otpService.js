import crypto     from 'crypto';
import nodemailer from 'nodemailer';
import * as otpModel from '../models/otpModel.js';

const sha = c => crypto.createHash('sha256').update(String(c)).digest('hex');

// rate-limit: track last sent time per email in memory
const lastSent = new Map();
const RESEND_COOLDOWN_MS = 60_000; // 1 minute

function makeTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: (process.env.GMAIL_APP_PASS || '').replace(/\s/g, ''),
        },
    });
}

// send OTP — also used for resend
export const sendOtp = async (email) => {
    // rate-limit check
    const last = lastSent.get(email);
    if (last && Date.now() - last < RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - last)) / 1000);
        throw new Error(`Please wait ${wait} seconds before requesting another code.`);
    }

    const code      = String(crypto.randomInt(100_000, 1_000_000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await otpModel.save(email, code, expiresAt);
    lastSent.set(email, Date.now());

    const transporter = makeTransporter();
    await transporter.sendMail({
        from:    `"3A's Kitchen" <${process.env.GMAIL_USER}>`,
        to:      email,
        subject: "Your 3A's Kitchen verification code",
        html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
                <div style="background:#C2410C;padding:20px 28px;border-radius:10px 10px 0 0">
                    <h2 style="color:white;margin:0">3A's Kitchen</h2>
                </div>
                <div style="background:#fff;padding:28px;border:1px solid #E7E2DC;
                            border-top:none;border-radius:0 0 10px 10px">
                    <p style="margin:0 0 16px">Hi! Here is your verification code:</p>
                    <div style="font-size:36px;font-weight:800;letter-spacing:8px;
                                color:#C2410C;background:#FFF1E8;padding:18px;
                                text-align:center;border-radius:8px;
                                margin-bottom:16px">${code}</div>
                    <p style="color:#57534E;font-size:13px;margin:0">
                        This code expires in <strong>10 minutes</strong>.<br>
                        You have <strong>3 attempts</strong> before the code is locked.<br>
                        If you did not request this, ignore this email.
                    </p>
                </div>
            </div>`,
        text: `Your 3A's Kitchen verification code is ${code}. It expires in 10 minutes.`,
    });

    return 'Code sent.';
};

// verify OTP — checks expiry, attempts, and correct code
export const verifyOtp = async (email, code) => {
    const token = await otpModel.findByEmail(email);

    // no token found
    if (!token) {
        throw new Error('No code was sent to this email. Request a new one.');
    }

    // code expired
    if (new Date() > new Date(token.expires_at)) {
        await otpModel.remove(email);
        throw new Error('This code has expired. Request a new one.');
    }

    // attempts used up
    if (token.attempts < 1) {
        throw new Error('Too many incorrect attempts. Request a new code.');
    }

    // wrong code
    if (sha(code) !== token.code_hash) {
        await otpModel.decrementAttempts(email);
        const left = token.attempts - 1;
        if (left < 1) {
            throw new Error('Too many incorrect attempts. Request a new code.');
        }
        throw new Error(
            `Incorrect code. ${left} attempt${left > 1 ? 's' : ''} left.`
        );
    }

    // correct — remove token
    await otpModel.remove(email);
    return true;
};
