import crypto     from 'crypto';
import nodemailer from 'nodemailer';
import * as otpModel from '../models/otpModel.js';

const sha = c => crypto.createHash('sha256').update(String(c)).digest('hex');

function makeTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: (process.env.GMAIL_APP_PASS || '').replace(/\s/g, ''),
        },
    });
}

// send OTP to email
export const sendOtp = async (email) => {
    const code      = String(crypto.randomInt(100_000, 1_000_000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await otpModel.save(email, code, expiresAt);

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

// verify OTP
export const verifyOtp = async (email, code) => {
    const token = await otpModel.findByEmail(email);

    if (!token) {
        throw new Error('No code was sent to this email. Request a new one.');
    }
    if (new Date() > new Date(token.expires_at)) {
        await otpModel.remove(email);
        throw new Error('This code has expired. Request a new one.');
    }
    if (sha(code) !== token.code_hash) {
        throw new Error('Incorrect code.');
    }

    await otpModel.remove(email);
    return true;
};
