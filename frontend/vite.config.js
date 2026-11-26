import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

// Load root .env (one level up from frontend/)
loadEnv({ path: resolve(process.cwd(), '../.env') });

const pending = globalThis.__3a_otp_pending ?? (globalThis.__3a_otp_pending = new Map()); // survives HMR restarts
const sha = c => crypto.createHash('sha256').update(String(c)).digest('hex');
const clean = e => String(e || '').trim().toLowerCase();

function otpPlugin() {
  return {
    name: 'otp-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Only handle /api/* POST requests
        if (!req.url.startsWith('/api/') || req.method !== 'POST') {
          return next();
        }

        // Parse JSON body manually
        const body = await new Promise((ok, fail) => {
          let raw = '';
          req.on('data', c => (raw += c));
          req.on('end', () => {
            try { ok(JSON.parse(raw || '{}')); }
            catch { fail(new Error('Bad JSON')); }
          });
        }).catch(() => ({}));

        const reply = (status, data) => {
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        };

        /* ── POST /api/send-otp ── */
        if (req.url === '/api/send-otp') {
          const email = clean(body.email);
          if (!/^\S+@\S+\.\S+$/.test(email))
            return reply(400, { error: 'Enter a valid email.' });

          const old = pending.get(email);
          if (old && Date.now() - old.lastSent < 60_000)
            return reply(429, { error: 'Please wait a minute before requesting another code.' });

          const code = String(crypto.randomInt(100_000, 1_000_000));
          pending.set(email, {
            hash: sha(code),
            exp: Date.now() + 10 * 60 * 1000,
            tries: 3,
            lastSent: Date.now(),
          });

          try {
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: {
                user: process.env.GMAIL_USER,
                pass: (process.env.GMAIL_APP_PASS || '').replace(/\s/g, ''),
              },
            });
            await transporter.sendMail({
              from: `"3A's Kitchen" <${process.env.GMAIL_USER}>`,
              to: email,
              subject: "Your 3A's Kitchen verification code",
              text: `Your verification code is ${code}. It expires in 10 minutes.`,
            });
            return reply(200, { ok: true });
          } catch (err) {
            console.error('[OTP] Email error:', err.message);
            pending.delete(email);
            return reply(500, { error: 'Could not send the email. Please try again.' });
          }
        }

        /* ── POST /api/verify-otp ── */
        if (req.url === '/api/verify-otp') {
          const email = clean(body.email);
          const code  = String(body.code || '').trim();
          const p     = pending.get(email);

          if (!p)
            return reply(400, { error: 'No code was sent to this email. Resend a new one.' });
          if (Date.now() > p.exp) {
            pending.delete(email);
            return reply(400, { error: 'This code has expired. Resend a new one.' });
          }
          if (p.tries < 1)
            return reply(429, { error: 'Too many attempts. Resend a new code.' });
          if (sha(code) !== p.hash) {
            p.tries--;
            return reply(400, {
              error: p.tries
                ? `Incorrect code. ${p.tries} attempt${p.tries > 1 ? 's' : ''} left.`
                : 'Too many attempts. Resend a new code.',
            });
          }

          pending.delete(email);
          return reply(200, { ok: true });
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), otpPlugin()],
  server: {
    proxy: {
      // forward /api-backend/* → backend Express (port 3000), strip the prefix
      '/api-backend': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api-backend/, ''),
      },
      // forward /users/* → backend Express (port 3000)
      '/users': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
