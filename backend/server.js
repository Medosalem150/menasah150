require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, 'settings.json');

const app = express();
app.use(cors());
app.use(express.json());

// Function to get current email settings
function getEmailSettings() {
    if (fs.existsSync(SETTINGS_PATH)) {
        try {
            return JSON.parse(fs.readFileSync(SETTINGS_PATH));
        } catch (e) {
            console.error("Error reading settings.json", e);
        }
    }
    // Fallback to .env if settings.json doesn't exist
    return {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    };
}

// Function to create transporter with current settings
function createTransporter() {
    const settings = getEmailSettings();
    // Trim spaces to avoid EAUTH errors
    const user = settings.user ? settings.user.trim() : '';
    const pass = settings.pass ? settings.pass.trim() : '';
    
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // Use SSL
        auth: {
            user: user,
            pass: pass
        },
        tls: {
            rejectUnauthorized: false // Helps in some hosting environments
        }
    });
}

let transporter = createTransporter();

// Verify connection configuration
transporter.verify(function(error, success) {
    if (error) {
        console.log("Transporter error (check your email settings):", error.message);
    } else {
        console.log("Server is ready to send emails!");
    }
});

// In-memory store for OTPs (For production, consider Redis or Database)
const otpStore = {};

app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ success: false, error: 'البريد الإلكتروني مطلوب' });
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = otp;

    // Re-create transporter to ensure we use latest settings
    transporter = createTransporter();
    const settings = getEmailSettings();
    const user = settings.user ? settings.user.trim() : '';
    const pass = settings.pass ? settings.pass.trim() : '';

    console.log(`[Attempting to send OTP] Using Email: ${user} | Pass starts with: ${pass.substring(0, 3)}...`);

    try {
        const mailOptions = {
            from: `"منصة محمد عبدالسلام" <${settings.user}>`, 
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

        console.log(`[OTP Sent] From: ${settings.user}, To: ${email}, OTP: ${otp}`);
        res.json({ success: true, message: 'تم إرسال كود التفعيل بنجاح' });
    } catch (error) {
        console.error('Email Sending Error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ أثناء إرسال البريد. يرجى مراجعة إعدادات البريد في لوحة التحكم.' });
    }
});

// API to get current email settings (For Admin Panel)
app.get('/api/admin/email-settings', (req, res) => {
    const settings = getEmailSettings();
    // Don't send the real password for security, just masks
    res.json({ 
        user: settings.user,
        pass: settings.pass ? '********' : ''
    });
});

// API to update email settings
app.post('/api/admin/email-settings', (req, res) => {
    const { user, pass } = req.body;
    
    if (!user || !pass) {
        return res.status(400).json({ success: false, error: 'البريد وكلمة المرور مطلوبان' });
    }

    const newSettings = { user, pass };
    
    try {
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(newSettings, null, 2));
        // Refresh transporter with new settings
        transporter = createTransporter();
        console.log(`[Settings Updated] New Admin Email: ${user}`);
        res.json({ success: true, message: 'تم تحديث إعدادات البريد بنجاح' });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ success: false, error: 'فشل حفظ الإعدادات' });
    }
});

app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
        return res.status(400).json({ success: false, error: 'البيانات غير مكتملة' });
    }

    if (otpStore[email] === otp) {
        // OTP verified successfully
        delete otpStore[email]; // clear the OTP so it can't be reused
        res.json({ success: true, message: 'تم التحقق بنجاح' });
    } else {
        // Invalid OTP
        res.status(400).json({ success: false, error: 'الكود غير صحيح' });
    }
});

const PORT = process.env.PORT || 3000;

const https = require('https');

app.get('/api/proxy-pdf', (req, res) => {
    let url = req.query.url;
    if (!url) return res.status(400).send('URL is required');
    
    // Extract ID from Drive URL
    let fileId = '';
    if (url.includes('/d/')) fileId = url.split('/d/')[1].split('/')[0];
    else if (url.includes('id=')) fileId = url.split('id=')[1].split('&')[0];
    
    if (!fileId) return res.status(400).send('Invalid Google Drive URL');
    
    let downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    https.get(downloadUrl, (response) => {
        // Handle Drive redirect
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

app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
});
