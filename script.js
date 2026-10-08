/**
 * Application State & Database Simulation
 * using localStorage & Upstash KV Sync
 */

const DB_KEYS = {
    USERS: 'app_users',
    COURSES: 'app_courses',
    CODES: 'app_codes',
    SESSION: 'app_session',
    PAYMENTS: 'app_payments',
    SETTINGS: 'app_settings',
    BOOKS: 'app_books'
};

// API Configuration (Dynamic for local and production)
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : '/api';

const DEFAULT_ADMIN = { email: 'admin@edu.com', password: 'admin', role: 'admin' };

const INITIAL_COURSES = [
    {
        id: 'c1', title: 'أساسيات علم النباتات', price: 150, image: 'https://images.unsplash.com/photo-1530836369250-ef71a3f5e4cb?w=600&h=400&fit=crop',
        desc: 'تعلم أهم القواعد الأساسية في علم النباتات الحديث.', grade: '1', term: '1',
        lessons: [
            { id: 'l1', title: 'الدرس الأول: تصنيف النباتات', type: 'video', price: 50, content: 'https://www.w3schools.com/html/mov_bbb.mp4' },
            { id: 'l2', title: 'ملخص الدرس', type: 'pdf', price: 20, content: 'base64_or_data_url_here' },
            { id: 'e1', title: 'اختبار النباتات', type: 'exam', price: 10, questions: [
                { q: 'ما هو الجزء المسؤول عن البناء الضوئي؟', options: ['الجذر', 'الساق', 'الورقة', 'الزهرة'], answer: 2 }
            ]}
        ]
    },
    {
        id: 'c2', title: 'أساسيات علم الأحياء', price: 200, image: 'https://images.unsplash.com/photo-1530026405186-ed1f496632ce?w=600&h=400&fit=crop',
        desc: 'مدخل شامل لفهم الخلية وتكوين الكائنات الحية.', grade: '2', term: 'full',
        lessons: [
            { id: 'l3', title: 'الدرس الأول: الخلية', type: 'video', price: 100, content: 'https://www.w3schools.com/html/mov_bbb.mp4' }
        ]
    }
];

class Database {
    static init() {
        if (!localStorage.getItem(DB_KEYS.USERS)) {
            this.set(DB_KEYS.USERS, [DEFAULT_ADMIN]);
        }
        if (!localStorage.getItem(DB_KEYS.COURSES)) {
            this.set(DB_KEYS.COURSES, INITIAL_COURSES);
        }
        if (!localStorage.getItem(DB_KEYS.CODES)) {
            this.set(DB_KEYS.CODES, []);
        }
        if (!localStorage.getItem(DB_KEYS.PAYMENTS)) {
            this.set(DB_KEYS.PAYMENTS, []);
        }
        if (!localStorage.getItem(DB_KEYS.SETTINGS)) {
            this.set(DB_KEYS.SETTINGS, { walletNumber: '01000000000' });
        }
        if (!localStorage.getItem(DB_KEYS.BOOKS)) {
            this.set(DB_KEYS.BOOKS, []);
        }
    }

    static get(key) { return JSON.parse(localStorage.getItem(key)) || []; }
    
    static set(key, data) { 
        localStorage.setItem(key, JSON.stringify(data)); 
        if (key !== DB_KEYS.SESSION) {
            fetch(`${API_BASE_URL}/db/${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).catch(err => console.error(`Failed to sync ${key} to server:`, err));
        }
    }

    static async syncFromServer() {
        try {
            const response = await fetch(`${API_BASE_URL}/db`, { cache: 'no-store' });
            const res = await response.json();
            if (res.success && res.data) {
                const keys = Object.keys(res.data);
                let changed = false;
                keys.forEach(key => {
                    if (res.data[key] !== null && res.data[key] !== undefined) {
                        const oldVal = localStorage.getItem(key);
                        const newVal = JSON.stringify(res.data[key]);
                        if (oldVal !== newVal) {
                            localStorage.setItem(key, newVal);
                            changed = true;
                        }
                    }
                });
                return changed;
            }
        } catch (error) {
            console.error('Error syncing database from server:', error);
        }
        return false;
    }
    
    static getActiveGrades() {
        let courses = this.get(DB_KEYS.COURSES) || [];
        let books = this.get(DB_KEYS.BOOKS) || [];
        let grades = new Set();
        courses.forEach(c => { if(c.grade && c.grade !== 'all') grades.add(c.grade); });
        books.forEach(b => { if(b.grade && b.grade !== 'all') grades.add(b.grade); });
        return Array.from(grades);
    }
    
    // Auth
    static login(email, password) {
        let users = this.get(DB_KEYS.USERS);
        let user = users.find(u => u.email === email && u.password === password);
        if (user) {
            if(user.role !== 'admin') {
                if(typeof user.walletBalance === 'undefined') user.walletBalance = 0;
                if(!user.enrolledLessons) user.enrolledLessons = [];
            }
            localStorage.setItem(DB_KEYS.SESSION, JSON.stringify(user));
            return user;
        }
        return null;
    }
    static logout() { localStorage.removeItem(DB_KEYS.SESSION); }
    static getSession() { 
        let raw = localStorage.getItem(DB_KEYS.SESSION);
        let user = raw ? JSON.parse(raw) : null; 
        if(user && user.role !== 'admin') {
            let users = this.get(DB_KEYS.USERS);
            let u = users.find(u => u.email === user.email);
            if(u) {
                if(u.suspended) {
                    this.logout();
                    return null;
                }
                return u;
            }
        }
        return user;
    }
    static updateSession(user) {
        if(user.role !== 'admin') {
            let users = this.get(DB_KEYS.USERS);
            let uIdx = users.findIndex(u => u.email === user.email);
            if(uIdx !== -1) {
                users[uIdx] = user;
                this.set(DB_KEYS.USERS, users);
            }
        }
        localStorage.setItem(DB_KEYS.SESSION, JSON.stringify(user));
    }
    static registerChild(name, phone, email, password, grade = '1') {
        let users = this.get(DB_KEYS.USERS);
        if (users.find(u => u.email === email)) return false;
        users.push({ name, phone, email, password, role: 'student', grade: grade, enrolled: [], enrolledLessons: [], walletBalance: 0 });
        this.set(DB_KEYS.USERS, users);
        return true;
    }

    static registerParent(name, phone, email, password, childEmail) {
        let users = this.get(DB_KEYS.USERS);
        if (users.find(u => u.email === email)) return false;
        let child = users.find(u => u.email === childEmail && u.role === 'student');
        if (!child) return false;

        users.push({ name, phone, email, password, role: 'parent', childEmail: childEmail });
        this.set(DB_KEYS.USERS, users);
        return true;
    }

    static buyBook(bookId, price) {
        let user = this.getSession();
        if(!user || user.role === 'admin' || user.role === 'parent') return { success: false, msg: 'الطالب فقط يمكنه الشراء' };
        
        if(user.walletBalance < price) {
            return { success: false, msg: 'رصيد المحفظة غير كافٍ. يرجى الشحن أولاً.' };
        }
        
        user.walletBalance -= price;
        if(!user.purchasedBooks) user.purchasedBooks = [];
        if(!user.purchasedBooks.includes(bookId)) user.purchasedBooks.push(bookId);
        
        if(typeof user.totalSpent === 'undefined') user.totalSpent = 0;
        user.totalSpent += parseFloat(price);

        this.updateSession(user);
        return { success: true, msg: 'تم شراء المذكرة بنجاح!' };
    }

    // Wallet & Payments (Forced server sync for real-time multi-device sync)
    static async activateWalletCode(email, codeStr) {
        await this.syncFromServer(); // Sync first to get latest codes
        let codes = this.get(DB_KEYS.CODES);
        let idx = codes.findIndex(c => c.code === codeStr && !c.usedBy);
        if (idx === -1) return { success: false, msg: 'كود غير صالح أو مستخدم مسبقاً' };
        
        let value = codes[idx].value || 0;
        codes[idx].usedBy = email;
        this.set(DB_KEYS.CODES, codes);

        let users = this.get(DB_KEYS.USERS);
        let uIdx = users.findIndex(u => u.email === email);
        if(uIdx !== -1) {
            if(typeof users[uIdx].walletBalance === 'undefined') users[uIdx].walletBalance = 0;
            users[uIdx].walletBalance += parseFloat(value);
            this.set(DB_KEYS.USERS, users);
        }
        
        let session = this.getSession();
        if(session && session.email === email) { 
            session.walletBalance = users[uIdx].walletBalance; 
            localStorage.setItem(DB_KEYS.SESSION, JSON.stringify(session)); 
        }
        return { success: true, msg: `تم شحن محفظتك بقيمة ${value} ج.م بنجاح` };
    }

    static async requestWalletRecharge(email, amount, receiptBase64) {
        await this.syncFromServer(); // Sync first to avoid overwriting pending requests
        let reqs = this.get(DB_KEYS.PAYMENTS);
        reqs.push({
            id: 'req_' + Date.now(),
            email: email,
            amount: parseFloat(amount),
            receipt: receiptBase64,
            status: 'pending',
            date: new Date().toISOString()
        });
        this.set(DB_KEYS.PAYMENTS, reqs);
        return { success: true, msg: 'تم إرسال طلب شحن المحفظة، يرجى الانتظار لمراجعته من الإدارة' };
    }
    
    static async approveRequest(reqId) {
        await this.syncFromServer();
        let reqs = this.get(DB_KEYS.PAYMENTS);
        let req = reqs.find(r => r.id === reqId);
        if(req && req.status === 'pending') {
            req.status = 'approved';
            this.set(DB_KEYS.PAYMENTS, reqs);
            let users = this.get(DB_KEYS.USERS);
            let uIdx = users.findIndex(u => u.email === req.email);
            if(uIdx !== -1) {
                if(typeof users[uIdx].walletBalance === 'undefined') users[uIdx].walletBalance = 0;
                users[uIdx].walletBalance += parseFloat(req.amount);
                this.set(DB_KEYS.USERS, users);
            }
            return true;
        }
        return false;
    }
    
    static async rejectRequest(reqId) {
        await this.syncFromServer();
        let reqs = this.get(DB_KEYS.PAYMENTS);
        let req = reqs.find(r => r.id === reqId);
        if(req && req.status === 'pending') {
            req.status = 'rejected';
            this.set(DB_KEYS.PAYMENTS, reqs);
            return true;
        }
        return false;
    }

    static buyCourse(courseId, price) {
        let user = this.getSession();
        if(!user || user.role === 'admin') return { success: false, msg: 'الآدمن لا يمكنه الشراء' };
        
        if(user.walletBalance < price) {
            return { success: false, msg: 'رصيد المحفظة غير كافٍ. يرجى الشحن أولاً.' };
        }
        
        user.walletBalance -= price;
        if(!user.enrolled) user.enrolled = [];
        if(!user.enrolled.includes(courseId)) user.enrolled.push(courseId);
        
        if(typeof user.totalSpent === 'undefined') user.totalSpent = 0;
        user.totalSpent += parseFloat(price);

        this.updateSession(user);
        return { success: true, msg: 'تم شراء الدورة كاملة بنجاح!' };
    }

    static buyLesson(courseId, lessonId, price) {
        let user = this.getSession();
        if(!user || user.role === 'admin') return { success: false, msg: 'الآدمن لا يمكنه الشراء' };
        
        if(user.walletBalance < price) {
            return { success: false, msg: 'رصيد المحفظة غير كافٍ. يرجى الشحن أولاً.' };
        }
        
        user.walletBalance -= price;
        if(!user.enrolledLessons) user.enrolledLessons = [];
        let lessonKey = `${courseId}_${lessonId}`;
        if(!user.enrolledLessons.includes(lessonKey)) user.enrolledLessons.push(lessonKey);
        
        if(typeof user.totalSpent === 'undefined') user.totalSpent = 0;
        user.totalSpent += parseFloat(price);

        this.updateSession(user);
        return { success: true, msg: 'تم شراء الدرس بنجاح!' };
    }

    static isEnrolled(courseId) {
        let user = this.getSession();
        if(!user || user.role === 'admin') return true;
        return user.enrolled && user.enrolled.includes(courseId);
    }
    
    static isLessonEnrolled(courseId, lessonId) {
        if(this.isEnrolled(courseId)) return true;
        let user = this.getSession();
        if(!user || user.role === 'admin') return true;
        return user.enrolledLessons && user.enrolledLessons.includes(`${courseId}_${lessonId}`);
    }

    static getUserTotalSpent(user) {
        if (typeof user.totalSpent !== 'undefined') return user.totalSpent;
        
        let courses = this.get(DB_KEYS.COURSES);
        let books = this.get(DB_KEYS.BOOKS);
        let total = 0;
        
        if (user.enrolled) {
            user.enrolled.forEach(cId => {
                let c = courses.find(x => x.id === cId);
                if (c) total += parseFloat(c.price || 0);
            });
        }
        
        if (user.enrolledLessons) {
            user.enrolledLessons.forEach(lKey => {
                let [cId, lId] = lKey.split('_');
                let c = courses.find(x => x.id === cId);
                if (c) {
                    let l = c.lessons.find(x => x.id === lId);
                    if (l) total += parseFloat(l.price || 0);
                }
            });
        }

        if (user.purchasedBooks) {
            user.purchasedBooks.forEach(bId => {
                let b = books.find(x => x.id === bId);
                if (b) total += parseFloat(b.price || 0);
            });
        }
        
        return total;
    }
}

/**
 * OTP Verification Service
 */
const VerificationService = {
    async sendOTP(email) {
        try {
            const response = await fetch(`${API_BASE_URL}/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            return await response.json();
        } catch (error) {
            console.error('Error sending OTP:', error);
            return { success: false, error: 'تعذر الاتصال بالسيرفر' };
        }
    },

    async verifyOTP(email, otp) {
        try {
            const response = await fetch(`${API_BASE_URL}/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp })
            });
            return await response.json();
        } catch (error) {
            console.error('Error verifying OTP:', error);
            return { success: false, error: 'تعذر الاتصال بالسيرفر' };
        }
    },

    showOTPModal(email, onVerified) {
        const modalRoot = document.getElementById('modal-root');
        modalRoot.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3><i class="fa-solid fa-envelope-circle-check text-accent"></i> تفعيل الحساب</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                    </div>
                    <div class="text-center mb-6">
                        <p>لقد أرسلنا كود التفعيل إلى بريدك الإلكتروني:</p>
                        <strong class="text-accent">${email}</strong>
                        <p class="text-muted mt-2" style="font-size:0.85rem;">يرجى التحقق من صندوق الوارد (أو الرسائل غير المرغوب فيها).</p>
                    </div>
                    <div class="form-group">
                        <label class="form-label text-center">أدخل الكود المكون من 6 أرقام</label>
                        <input type="text" id="otp_input" class="form-control text-center" maxlength="6" placeholder="000000" style="letter-spacing: 10px; font-size: 2rem; font-weight: 800;">
                    </div>
                    <button id="verify_otp_btn" class="btn btn-primary w-100" style="width:100%">تأكيد وتفعيل الحساب <i class="fa-solid fa-check"></i></button>
                    <div class="text-center mt-4">
                        <button class="btn-link text-muted" style="background:none; border:none; text-decoration:underline; cursor:pointer;" onclick="window.resendOTP('${email}')">إعادة إرسال الكود</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('verify_otp_btn').onclick = async () => {
            const otp = document.getElementById('otp_input').value.trim();
            if (otp.length !== 6) return UI.showToast('يرجى إدخال كود صحيح مكون من 6 أرقام', 'error');

            const btn = document.getElementById('verify_otp_btn');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق...';
            btn.disabled = true;

            const res = await this.verifyOTP(email, otp);
            if (res.success) {
                modalRoot.innerHTML = '';
                UI.showToast('تم التحقق بنجاح!');
                onVerified();
            } else {
                UI.showToast(res.error || 'الكود غير صحيح', 'error');
                btn.innerHTML = 'تأكيد وتفعيل الحساب <i class="fa-solid fa-check"></i>';
                btn.disabled = false;
            }
        };

        window.resendOTP = async (email) => {
            UI.showToast('جاري إعادة إرسال الكود...');
            const res = await this.sendOTP(email);
            if (res.success) UI.showToast('تم إرسال كود جديد بنجاح');
            else UI.showToast(res.error || 'فشل إرسال الكود', 'error');
        };
    }
}

/**
 * UI Utilities
 */
const UI = {
    showToast: (msg, type = 'success') => {
        let c = document.getElementById('toast-root');
        let t = document.createElement('div');
        t.className = `toast ${type}`;
        t.innerHTML = `<i class="fa-solid fa-circle-${type === 'success' ? 'check' : 'xmark'}"></i> <span>${msg}</span>`;
        if(!c.querySelector('.toast-container')) {
            let tc = document.createElement('div');
            tc.className = 'toast-container';
            c.appendChild(tc);
        }
        c.querySelector('.toast-container').appendChild(t);
        setTimeout(() => {
            t.classList.add('fade-out');
            setTimeout(() => t.remove(), 300);
        }, 3000);
    },
    renderNav: () => {
        let nav = document.getElementById('navbar');
        let links = document.getElementById('nav-links');
        let session = Database.getSession();
        
        if (!session) {
            nav.classList.add('hidden');
            return;
        }
        nav.classList.remove('hidden');
        
        let html = `<a href="#/" class="${location.hash === '#/' || location.hash === '' ? 'active' : ''}">الرئيسية</a>`;
        if (session.role === 'admin') {
            html += `<a href="#/admin" class="${location.hash.startsWith('#/admin') ? 'active' : ''}">لوحة التحكم</a>`;
        } else if (session.role === 'parent') {
            html += `<a href="#/parent-dashboard" class="${location.hash.startsWith('#/parent-dashboard') ? 'active' : ''}"><i class="fa-solid fa-users"></i> أبنائي</a>`;
        } else {
            html += `<a href="#/dashboard" class="${location.hash.startsWith('#/dashboard') ? 'active' : ''}">دوراتي</a>`;
            html += `<a href="#/books" class="${location.hash.startsWith('#/books') ? 'active' : ''}"><i class="fa-solid fa-book"></i> كتب ومذكرات</a>`;
            html += `<a href="#/wallet" class="${location.hash.startsWith('#/wallet') ? 'active' : ''}"><i class="fa-solid fa-wallet"></i> المحفظة (${session.walletBalance || 0} ج.م)</a>`;
            html += `<a href="#/contact" class="${location.hash.startsWith('#/contact') ? 'active' : ''}"><i class="fa-solid fa-envelope"></i> تواصل معنا</a>`;
        }
        html += `<a href="#" onclick="app.logout(); return false;" class="text-danger"><i class="fa-solid fa-power-off"></i> تسجيل خروج</a>`;
        links.innerHTML = html;
    }
};

/**
 * Router & App Core
 */
const Views = {};

const app = {
    root: document.getElementById('app-root'),
    loader: document.getElementById('app-loader'),
    
    async init() {
        try {
            await Database.syncFromServer();
        } catch (e) {
            console.error('Failed initial db sync:', e);
        }
        Database.init();
        window.addEventListener('hashchange', () => this.route());
        setTimeout(() => {
            this.loader.classList.add('hidden');
            this.route();
        }, 500);
    },

    route(skipSync = false) {
        if(window.lessonTrackerInterval) clearInterval(window.lessonTrackerInterval);
        let hash = window.location.hash.substring(1) || '/';
        
        let session = Database.getSession();
        
        if (!skipSync) {
            Database.syncFromServer().then(changed => {
                if (changed) {
                    let currentHash = window.location.hash.substring(1) || '/';
                    if (currentHash === hash) {
                        this.route(true);
                    }
                }
            }).catch(err => console.error('Background sync failed:', err));
        }

        UI.renderNav();
        this.root.innerHTML = '';
        
        if (!session && hash !== '/login' && hash !== '/register') {
            window.location.hash = '/login';
            return;
        }

        if (session && session.role === 'parent' && hash !== '/parent-dashboard' && hash !== '/login' && hash !== '/register') {
            window.location.hash = '/parent-dashboard';
            return;
        }

        if (hash === '/login') Views.login();
        else if (hash === '/register') Views.register();
        else if (hash === '/') Views.home();
        else if (hash === '/dashboard') Views.dashboard();
        else if (hash === '/parent-dashboard') Views.parentDashboard();
        else if (hash === '/books') Views.books();
        else if (hash.startsWith('/book/')) {
            let id = hash.split('/')[2];
            Views.bookViewer(id);
        }
        else if (hash === '/wallet') Views.wallet();
        else if (hash === '/contact') Views.contact();
        else if (hash.startsWith('/course/')) {
            let id = hash.split('/')[2];
            Views.courseDetail(id);
        }
        else if (hash.startsWith('/lesson/')) {
            let parts = hash.split('/');
            Views.lesson(parts[2], parts[3]);
        }
        else if (hash.startsWith('/admin')) {
            if (session.role !== 'admin') {
                window.location.hash = '/';
                UI.showToast('غير مصرح لك بالوصول', 'error');
                return;
            }
            Views.admin();
        }
        else {
            this.root.innerHTML = `<div class="container mt-8 text-center"><h2>الصفحة غير موجودة</h2></div>`;
        }
    },

    navigate(path) {
        window.location.hash = path;
    },

    logout() {
        Database.logout();
        this.navigate('/login');
    }
};

window.activeAuthForm = null;
window.toggleAuthForm = (tab) => {
    if (window.activeAuthForm === tab) {
        window.activeAuthForm = null;
    } else {
        window.activeAuthForm = tab;
    }
    Views.renderAuthScreen(window.activeAuthForm);
};

Views.renderAuthScreen = (activeTab = window.activeAuthForm) => {
    app.root.innerHTML = `
        <div class="auth-hero-page">
            <div class="auth-content-left">
                <div class="auth-main-btns">
                    <button type="button" class="btn-mockup btn-purple ${activeTab === 'register' ? 'active' : ''}" onclick="window.toggleAuthForm('register')">
                        <i class="fa-solid fa-user-plus"></i>
                        إنشاء حساب
                    </button>
                    <button type="button" class="btn-mockup btn-white ${activeTab === 'login' ? 'active' : ''}" onclick="window.toggleAuthForm('login')">
                        <i class="fa-solid fa-user"></i>
                        تسجيل الدخول
                    </button>
                </div>

                ${activeTab ? `
                    <div id="auth-form-container" class="auth-form-card">
                        ${activeTab === 'login' ? `
                            <form id="loginForm">
                                <div class="form-group">
                                    <label class="form-label"><i class="fa-solid fa-envelope text-accent"></i> البريد الإلكتروني</label>
                                    <input type="email" id="l_email" class="form-control" required placeholder="example@gmail.com">
                                </div>
                                <div class="form-group">
                                    <label class="form-label"><i class="fa-solid fa-lock text-accent"></i> كلمة المرور</label>
                                    <input type="password" id="l_pass" class="form-control" required placeholder="••••••••">
                                </div>
                                <button type="submit" class="btn btn-primary w-100" style="width:100%; padding:0.85rem; font-size:1.1rem; font-weight:800; border-radius:0.75rem; margin-top:0.75rem;">
                                    تسجيل الدخول <i class="fa-solid fa-arrow-left ms-2"></i>
                                </button>
                            </form>
                        ` : `
                            <div class="tabs mb-3 flex justify-center" style="gap:0.5rem; border-bottom:1px solid var(--clr-border); padding-bottom: 0.5rem;">
                                <button type="button" class="tab-btn active w-100" id="tabStudent" onclick="window.switchRegTab('student')" style="flex:1; padding:0.6rem; font-size:1rem; font-weight:700;">طالب</button>
                                <button type="button" class="tab-btn w-100" id="tabParent" onclick="window.switchRegTab('parent')" style="flex:1; padding:0.6rem; font-size:1rem; font-weight:700;">ولي أمر</button>
                            </div>
                            <form id="regForm" onsubmit="event.preventDefault();">
                                <div class="form-group">
                                    <label class="form-label"><i class="fa-solid fa-user text-accent"></i> الاسم بالكامل</label>
                                    <input type="text" id="r_name" class="form-control" required placeholder="الاسم بالكامل">
                                </div>
                                <div class="form-group">
                                    <label class="form-label"><i class="fa-solid fa-phone text-accent"></i> رقم الهاتف</label>
                                    <input type="tel" id="r_phone" class="form-control" required placeholder="01012345678">
                                </div>
                                <div class="form-group">
                                    <label class="form-label"><i class="fa-solid fa-envelope text-accent"></i> البريد الإلكتروني</label>
                                    <input type="email" id="r_email" class="form-control" required placeholder="example@gmail.com">
                                </div>
                                <div class="form-group">
                                    <label class="form-label"><i class="fa-solid fa-lock text-accent"></i> كلمة المرور</label>
                                    <input type="password" id="r_pass" class="form-control" required placeholder="••••••••">
                                </div>
                                <div class="form-group" id="gradeGroup">
                                    <label class="form-label"><i class="fa-solid fa-graduation-cap text-accent"></i> الصف الدراسي</label>
                                    ${(() => {
                                        let grades = Database.getActiveGrades();
                                        if(grades.length === 0) {
                                            return '<input type="text" id="r_grade" class="form-control" required placeholder="لا توجد صفوف مضافة حالياً" disabled>';
                                        }
                                        return `
                                            <select id="r_grade" class="form-control" required style="cursor:pointer;">
                                                <option value="" disabled selected>-- اختر الصف الدراسي --</option>
                                                ${grades.map(g => `<option value="${g}">${g === '1' ? 'الصف الأول الثانوي' : g === '2' ? 'الصف الثاني الثانوي' : g === '3' ? 'الصف الثالث الثانوي' : g}</option>`).join('')}
                                            </select>
                                        `;
                                    })()}
                                </div>
                                <div class="form-group" id="childEmailGroup" style="display:none;">
                                    <label class="form-label text-accent"><i class="fa-solid fa-child"></i> البريد الإلكتروني للطالب (الابن) لربط الحساب</label>
                                    <input type="email" id="r_child" class="form-control" placeholder="example@gmail.com">
                                </div>
                                <button type="submit" id="regBtnText" class="btn btn-primary w-100" style="width:100%; padding:0.85rem; font-size:1.1rem; font-weight:800; border-radius:0.75rem; margin-top:0.75rem;">
                                    متابعة التسجيل <i class="fa-solid fa-arrow-left ms-2"></i>
                                </button>
                            </form>
                        `}
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    if (!activeTab) return;

    if (activeTab === 'login') {
        document.getElementById('loginForm').onsubmit = (e) => {
            e.preventDefault();
            let u = Database.login(document.getElementById('l_email').value, document.getElementById('l_pass').value);
            if(u) {
                if(u.suspended) {
                    UI.showToast('يتعذر الدخول: حسابك معلّق من قبل الإدارة', 'error');
                    Database.logout();
                    return;
                }
                UI.showToast('تم تسجيل الدخول بنجاح');
                app.navigate(u.role === 'admin' ? '/admin' : (u.role === 'parent' ? '/parent-dashboard' : '/'));
            } else {
                UI.showToast('بيانات الدخول غير صحيحة', 'error');
            }
        };
    } else {
        window.regType = 'student';
        window.switchRegTab = (type) => {
            window.regType = type;
            const gradeEl = document.getElementById('r_grade');
            const childEl = document.getElementById('r_child');
            
            if(type === 'parent') {
                document.getElementById('tabParent').classList.add('active');
                document.getElementById('tabStudent').classList.remove('active');
                document.getElementById('childEmailGroup').style.display = 'block';
                if(childEl) childEl.required = true;
                document.getElementById('gradeGroup').style.display = 'none';
                if(gradeEl) gradeEl.required = false;
                document.getElementById('regBtnText').innerHTML = 'متابعة كولي أمر <i class="fa-solid fa-users"></i>';
            } else {
                document.getElementById('tabStudent').classList.add('active');
                document.getElementById('tabParent').classList.remove('active');
                document.getElementById('childEmailGroup').style.display = 'none';
                if(childEl) childEl.required = false;
                document.getElementById('gradeGroup').style.display = 'block';
                if(gradeEl) gradeEl.required = true;
                document.getElementById('regBtnText').innerHTML = 'متابعة التسجيل <i class="fa-solid fa-arrow-left ms-2"></i>';
            }
        };

        document.getElementById('regForm').onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('r_name').value.trim();
            const phone = document.getElementById('r_phone').value.trim();
            const email = document.getElementById('r_email').value.trim();
            const password = document.getElementById('r_pass').value;
            
            if (window.regType === 'parent') {
                const childEmail = document.getElementById('r_child').value.trim();
                let users = Database.get(DB_KEYS.USERS);
                if(users.find(u => u.email === email)) {
                    UI.showToast('البريد الإلكتروني مستخدم بالفعل', 'error');
                    return;
                }
                let child = users.find(u => u.email === childEmail && u.role === 'student');
                if(!child) {
                    UI.showToast('بريد الطالب غير موجود أو غير صحيح', 'error');
                    return;
                }
                VerificationService.showOTPModal(email, () => {
                    let success = Database.registerParent(name, phone, email, password, childEmail);
                    if(success) {
                        UI.showToast('تم إنشاء حساب ولي الأمر بنجاح');
                        let u = Database.login(email, password);
                        app.navigate('/parent-dashboard');
                    } else {
                        UI.showToast('فشل إنشاء الحساب', 'error');
                    }
                });
            } else {
                const grade = document.getElementById('r_grade').value;
                let users = Database.get(DB_KEYS.USERS);
                if(users.find(u => u.email === email)) {
                    UI.showToast('البريد الإلكتروني مستخدم بالفعل', 'error');
                    return;
                }
                VerificationService.showOTPModal(email, () => {
                    let success = Database.registerChild(name, phone, email, password, grade);
                    if(success) {
                        UI.showToast('تم إنشاء الحساب بنجاح');
                        let u = Database.login(email, password);
                        app.navigate('/');
                    } else {
                        UI.showToast('فشل إنشاء الحساب', 'error');
                    }
                });
            }
        };
    }
};

// Start App when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
