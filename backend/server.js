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

// Database storage file path for local fallback
const localDbPath = path.join(__dirname, 'db_storage.json');

// Helper to get all database keys
async function getAllData() {
    const keys = ['app_users', 'app_courses', 'app_codes', 'app_payments', 'app_settings', 'app_books'];
    const data = {};

    if (kv) {
        try {
            const results = await Promise.all(keys.map(key => kv.get(key)));
            keys.forEach((key, index) => {
                data[key] = results[index] || null;
            });
            return data;
        } catch (err) {
            console.error('Failed to get data from KV, falling back to local file:', err);
        }
    }

    // Local fallback
    if (fs.existsSync(localDbPath)) {
        try {
            return JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
        } catch (err) {
            console.error('Failed to read local DB file:', err);
        }
    }
    return {};
}

// Helper to set a specific database key with immediate KV persistence
async function setDataKey(key, value) {
    if (kv) {
        try {
            await kv.set(key, value);
            return true;
        } catch (err) {
            console.error('Failed to set data in KV, falling back to local file:', err);
        }
    }

    // Local fallback
    try {
        let currentData = {};
        if (fs.existsSync(localDbPath)) {
            currentData = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
        }
        currentData[key] = value;
        fs.writeFileSync(localDbPath, JSON.stringify(currentData, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Failed to write local DB file:', err);
        return false;
    }
}

// DB API Endpoints
app.get('/api/db', async (req, res) => {
    try {
        const data = await getAllData();
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in GET /api/db:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/db/:key', async (req, res) => {
    const { key } = req.params;
    const allowedKeys = ['app_users', 'app_courses', 'app_codes', 'app_payments', 'app_settings', 'app_books'];
    
    if (!allowedKeys.includes(key)) {
        return res.status(400).json({ success: false, error: 'غير مسموح بهذا المفتاح' });
    }

    try {
        const success = await setDataKey(key, req.body);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(500).json({ success: false, error: 'فشل حفظ البيانات' });
        }
    } catch (error) {
        console.error(`Error in POST /api/db/${key}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper to get email settings
async function getEmailSettings() {
    if (kv) {
        const settings = await kv.get('email_settings');
        if (settings) return settings;
    }

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

// Helper for persistent OTP store using KV if available, fallback to Map
app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ success: false, error: 'البريد الإلكتروني مطلوب' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpData = { otp, expires: Date.now() + 600000 };

    if (kv) {
        await kv.set(`otp_${email}`, otpData);
    }

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

app.post('/api/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    
    let store = null;
    if (kv) {
        store = await kv.get(`otp_${email}`);
    }

    if (store && store.otp === otp && Date.now() < store.expires) {
        if (kv) await kv.del(`otp_${email}`);
        res.json({ success: true, message: 'تم التحقق بنجاح' });
    } else {
        res.status(400).json({ success: false, error: 'الكود غير صحيح أو منتهي الصلاحية' });
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
            res.Header('Content-Type', 'application/pdf');
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
