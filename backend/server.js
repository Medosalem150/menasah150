require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@vercel/kv');

const app = express();

// Initialize Vercel KV if available (for production)
let kv;
if (process.env.KV_REST_API_URL) {
    kv = createClient({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
    });
}

app.use(cors());
app.use(express.json());

// Helper to get email settings (from KV in production, settings.json in local)
async function getEmailSettings() {
    // If on Vercel and KV is connected
    if (kv) {
        const settings = await kv.get('email_settings');
        if (settings) return settings;
    }

    // Fallback to local file or .env
    const settingsPath = path.join(__dirname, 'settings.json');
    if (fs.existsSync(settingsPath)) {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    return {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    };
}

// Function to create transporter with current settings
function createTransporter(settings) {
    const user = settings.user ? settings.user.trim() : '';
    const pass = settings.pass ? settings.pass.trim() : '';
    
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: user,
            pass: pass
        },
        tls: {
            rejectUnauthorized: false
        }
    });
}

// In-memory store for OTPs
const otpStore = new Map();

app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ success: false, error: 'البريد الإلكتروني مطلوب' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { otp, expires: Date.now() + 600000 });

    const settings = await getEmailSettings();
    const transporter = createTransporter(settings);
    const user = settings.user ? settings.user.trim() : '';

    try {
        const mailOptions = {
            from: `"منصة محمد عبدالسلام" <${user}>`, 
            to: email,
            subject: 'كود التفعيل الخاص بك - منصة محمد عبدالسلام',
            html: `
                <div dir="rtl" style="font-family: Arial, sans-serif; text-align: center; color: #333; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; max-width: 500px; margin: 0 auto;">
                    <h2 style="color: #1f2937;">أهلاً بك في منصة محمد عبدالسلام!</h2>
                    <p style="font-size: 16px;">شكراً لتسجيلك معنا. لإكمال عملية التفعيل، يرجى استخدام الكود التالي:</p>
                    <div style="background-color: #f97316; color: #ffffff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h1 style="margin: 0; letter-spacing: 5px; font-size: 32px;">${otp}</h1>
                    </div>
                    <p style="font-size: 14px; color: #6b7280;">هذا الكود صالح للاستخدام مرة واحدة، يرجى عدم مشاركته مع أي شخص.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'تم إرسال كود التفعيل بنجاح' });
    } catch (error) {
        console.error('Email Sending Error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ أثناء إرسال البريد. يرجى مراجعة إعدادات البريد في لوحة التحكم.' });
    }
});

// Admin Endpoints for Email Settings
app.get('/api/admin/email-settings', async (req, res) => {
    const settings = await getEmailSettings();
    res.json({ 
        user: settings.user || '',
        pass: settings.pass ? '********' : ''
    });
});

app.post('/api/admin/email-settings', async (req, res) => {
    const { user, pass } = req.body;
    
    if (!user) {
        return res.status(400).json({ success: false, error: 'البريد مطلوب' });
    }

    let settings = await getEmailSettings();
    settings.user = user;
    if (pass) settings.pass = pass;
    
    try {
        if (kv) {
            await kv.set('email_settings', settings);
        } else {
            const settingsPath = path.join(__dirname, 'settings.json');
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        }
        res.json({ success: true, message: 'تم تحديث إعدادات البريد بنجاح' });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ success: false, error: 'فشل حفظ الإعدادات' });
    }
});

app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    
    const store = otpStore.get(email);
    if (store && store.otp === otp && Date.now() < store.expires) {
        otpStore.delete(email);
        res.json({ success: true, message: 'تم التحقق بنجاح' });
    } else {
        res.status(400).json({ success: false, error: 'الكود غير صحيح أو منتهي الصلاحية' });
    }
});

const https = require('https');

app.get('/api/proxy-pdf', (req, res) => {
    let url = req.query.url;
    if (!url) return res.status(400).send('URL is required');
    
    let fileId = '';
    if (url.includes('/d/')) fileId = url.split('/d/')[1].split('/')[0];
    else if (url.includes('id=')) fileId = url.split('id=')[1].split('&')[0];
    
    if (!fileId) return res.status(400).send('Invalid Google Drive URL');
    
    let downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    https.get(downloadUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            https.get(response.headers.location, (redirectRes) => {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'inline; filename="document.pdf"'); 
                redirectRes.pipe(res);
            }).on('error', () => res.status(500).send('Proxy error'));
        } else {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
            response.pipe(res);
        }
    }).on('error', () => {
        res.status(500).send('Failed to fetch the file');
    });
});

// Start Server ONLY if not running as a Vercel Function
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Backend server is running on http://localhost:${PORT}`);
    });
}

// Export for Vercel
module.exports = app;
