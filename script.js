/**
 * Application State & Database Simulation
 * using localStorage
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
            localStorage.setItem(DB_KEYS.USERS, JSON.stringify([DEFAULT_ADMIN]));
        }
        if (!localStorage.getItem(DB_KEYS.COURSES)) {
            localStorage.setItem(DB_KEYS.COURSES, JSON.stringify(INITIAL_COURSES));
        }
        if (!localStorage.getItem(DB_KEYS.CODES)) {
            localStorage.setItem(DB_KEYS.CODES, JSON.stringify([]));
        }
        if (!localStorage.getItem(DB_KEYS.PAYMENTS)) {
            localStorage.setItem(DB_KEYS.PAYMENTS, JSON.stringify([]));
        }
        if (!localStorage.getItem(DB_KEYS.SETTINGS)) {
            localStorage.setItem(DB_KEYS.SETTINGS, JSON.stringify({ walletNumber: '01000000000' }));
        }
        if (!localStorage.getItem(DB_KEYS.BOOKS)) {
            localStorage.setItem(DB_KEYS.BOOKS, JSON.stringify([]));
        }
    }

    static get(key) { return JSON.parse(localStorage.getItem(key)) || []; }
    static set(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
    
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
        if (users.find(u => u.email === email)) return false; // Exists
        users.push({ name, phone, email, password, role: 'student', grade: grade, enrolled: [], enrolledLessons: [], walletBalance: 0 });
        this.set(DB_KEYS.USERS, users);
        return true;
    }

    static registerParent(name, phone, email, password, childEmail) {
        let users = this.get(DB_KEYS.USERS);
        if (users.find(u => u.email === email)) return false; // Exists
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
        
        this.updateSession(user);
        return { success: true, msg: 'تم شراء المذكرة بنجاح!' };
    }

    // Wallet & Payments
    static activateWalletCode(email, codeStr) {
        let codes = this.get(DB_KEYS.CODES);
        let idx = codes.findIndex(c => c.code === codeStr && !c.usedBy);
        if (idx === -1) return { success: false, msg: 'كود غير صالح أو مستخدم مسبقاً' };
        
        let value = codes[idx].value || 0;
        codes[idx].usedBy = email;
        this.set(DB_KEYS.CODES, codes);

        let users = this.get(DB_KEYS.USERS);
        let uIdx = users.findIndex(u => u.email === email);
        if(typeof users[uIdx].walletBalance === 'undefined') users[uIdx].walletBalance = 0;
        users[uIdx].walletBalance += parseFloat(value);
        this.set(DB_KEYS.USERS, users);
        
        let session = this.getSession();
        if(session.email === email) { 
            session.walletBalance = users[uIdx].walletBalance; 
            localStorage.setItem(DB_KEYS.SESSION, JSON.stringify(session)); 
        }
        return { success: true, msg: `تم شحن محفظتك بقيمة ${value} ج.م بنجاح` };
    }

    static requestWalletRecharge(email, amount, receiptBase64) {
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
    
    static approveRequest(reqId) {
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
    
    static rejectRequest(reqId) {
        let reqs = this.get(DB_KEYS.PAYMENTS);
        let req = reqs.find(r => r.id === reqId);
        if(req && req.status === 'pending') {
            req.status = 'rejected';
            this.set(DB_KEYS.PAYMENTS, reqs);
            return true;
        }
        return false;
    }

    // Buying logic
    static buyCourse(courseId, price) {
        let user = this.getSession();
        if(!user || user.role === 'admin') return { success: false, msg: 'الآدمن لا يمكنه الشراء' };
        
        if(user.walletBalance < price) {
            return { success: false, msg: 'رصيد المحفظة غير كافٍ. يرجى الشحن أولاً.' };
        }
        
        user.walletBalance -= price;
        if(!user.enrolled) user.enrolled = [];
        if(!user.enrolled.includes(courseId)) user.enrolled.push(courseId);
        
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
    
    init() {
        Database.init();
        window.addEventListener('hashchange', this.route.bind(this));
        setTimeout(() => {
            this.loader.classList.add('hidden');
            this.route();
        }, 500); // Fake load
    },

    route() {
        if(window.lessonTrackerInterval) clearInterval(window.lessonTrackerInterval);
        let hash = window.location.hash.substring(1) || '/';
        UI.renderNav();
        this.root.innerHTML = ''; // basic clear

        let session = Database.getSession();
        
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

/**
 * Views Implementation
 */

Views.login = () => {
    app.root.innerHTML = `
        <div class="auth-container">
            <div class="auth-box">
                <div class="auth-header">
                    <i class="fa-solid fa-user-lock"></i>
                    <h2>تسجيل الدخول</h2>
                    <p class="text-muted">مرحباً بك في منصة محمد عبدالسلام</p>
                </div>
                <form id="loginForm">
                    <div class="form-group">
                        <label class="form-label">البريد الإلكتروني</label>
                        <input type="email" id="l_email" class="form-control" required placeholder="example@gmail.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">كلمة المرور</label>
                        <input type="password" id="l_pass" class="form-control" required placeholder="••••••••">
                    </div>
                    <button type="submit" class="btn btn-primary w-100" style="width:100%">دخول <i class="fa-solid fa-arrow-left"></i></button>
                    <div class="text-center mt-4">
                        <span class="text-muted">ليس لديك حساب؟</span>
                        <a href="#/register" class="text-accent font-weight-bold">إنشاء حساب كطالب</a>
                    </div>
                </form>
            </div>
        </div>
    `;
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
    }
};

Views.register = () => {
    app.root.innerHTML = `
        <div class="auth-container" style="padding-top:4rem;">
            <div class="auth-box">
                <div class="auth-header">
                    <i class="fa-solid fa-user-graduate"></i>
                    <h2>إنشاء حساب جديد</h2>
                    <p class="text-muted">انضم لآلاف الطلاب وابدأ رحلة التفوق</p>
                </div>
                <div class="tabs mb-4 flex justify-center" style="gap:1rem; border-bottom:1px solid var(--clr-border);">
                    <button type="button" class="tab-btn active w-100" id="tabStudent" onclick="window.switchRegTab('student')" style="flex:1;">طالب</button>
                    <button type="button" class="tab-btn w-100" id="tabParent" onclick="window.switchRegTab('parent')" style="flex:1;">ولي أمر</button>
                </div>
                <form id="regForm" onsubmit="event.preventDefault();">
                    <div class="form-group">
                        <label class="form-label">الاسم بالكامل</label>
                        <input type="text" id="r_name" class="form-control" required placeholder="الاسم يظهر في الحساب والشهادات">
                    </div>
                    <div class="form-group">
                        <label class="form-label">رقم الهاتف</label>
                        <input type="tel" id="r_phone" class="form-control" required placeholder="01012345678">
                    </div>
                    <div class="form-group">
                        <label class="form-label">البريد الإلكتروني</label>
                        <input type="email" id="r_email" class="form-control" required placeholder="البريد يجب أن يكون حقيقياً وتستطيع الوصول إليه">
                    </div>
                    <div class="form-group">
                        <label class="form-label">كلمة المرور</label>
                        <input type="password" id="r_pass" class="form-control" required placeholder="••••••••">
                    </div>
                    <div class="form-group" id="gradeGroup">
                        <label class="form-label">الصف الدراسي</label>
                        ${(() => {
                            let grades = Database.getActiveGrades();
                            if(grades.length === 0) {
                                return '<input type="text" id="r_grade" class="form-control" required placeholder="لا توجد صفوف مضافة حالياً (يجب على الإدارة إضافة دورات أولاً)" disabled>';
                            }
                            return `
                                <select id="r_grade" class="form-control" required style="cursor:pointer; background-color: var(--clr-bg);">
                                    <option value="" disabled selected>-- اختر الصف الدراسي الخاص بك --</option>
                                    ${grades.map(g => `<option value="${g}">${g === '1' ? 'الصف الأول الثانوي' : g === '2' ? 'الصف الثاني الثانوي' : g === '3' ? 'الصف الثالث الثانوي' : g}</option>`).join('')}
                                </select>
                            `;
                        })()}
                    </div>
                    <div class="form-group" id="childEmailGroup" style="display:none;">
                        <label class="form-label text-accent">البريد الإلكتروني للطالب (الابن) لربط الحساب</label>
                        <input type="email" id="r_child" class="form-control" placeholder="example@gmail.com">
                    </div>
                    <button type="submit" id="regBtnText" class="btn btn-primary w-100" style="width:100%">تسجيل حساب جديد <i class="fa-solid fa-arrow-left"></i></button>
                    <div class="text-center mt-4">
                        <a href="#/login" class="text-muted">العودة لتسجيل الدخول</a>
                    </div>
                </form>
            </div>
        </div>
    `;

    window.regType = 'student';
    window.switchRegTab = (type) => {
        window.regType = type;
        if(type === 'parent') {
            document.getElementById('tabParent').classList.add('active');
            document.getElementById('tabStudent').classList.remove('active');
            document.getElementById('childEmailGroup').style.display = 'block';
            document.getElementById('r_child').required = true;
            document.getElementById('gradeGroup').style.display = 'none';
            document.getElementById('regBtnText').innerHTML = 'متابعة كولي أمر <i class="fa-solid fa-users"></i>';
        } else {
            document.getElementById('tabStudent').classList.add('active');
            document.getElementById('tabParent').classList.remove('active');
            document.getElementById('childEmailGroup').style.display = 'none';
            document.getElementById('r_child').required = false;
            document.getElementById('gradeGroup').style.display = 'block';
            document.getElementById('regBtnText').innerHTML = 'متابعة كطالب <i class="fa-solid fa-arrow-left"></i>';
        }
    };

    document.getElementById('regForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        let email = document.getElementById('r_email').value.trim();
        let users = Database.get(DB_KEYS.USERS);
        
        if(users.find(u => u.email === email)) {
            return UI.showToast('البريد الإلكتروني مسجل مسبقاً، يرجى تسجيل الدخول', 'error');
        }

        let submitBtn = document.getElementById('regBtnText');
        let originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التسجيل...';
        submitBtn.disabled = true;

        setTimeout(() => {
            let res;
            if(window.regType === 'parent') {
                res = Database.registerParent(
                    document.getElementById('r_name').value.trim(), 
                    document.getElementById('r_phone').value.trim(), 
                    email, 
                    document.getElementById('r_pass').value, 
                    document.getElementById('r_child').value.trim()
                );
            } else {
                let grade = document.getElementById('r_grade') ? document.getElementById('r_grade').value : '1';
                res = Database.registerChild(
                    document.getElementById('r_name').value.trim(), 
                    document.getElementById('r_phone').value.trim(), 
                    email, 
                    document.getElementById('r_pass').value, 
                    grade
                );
            }

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

            if(res) {
                UI.showToast('تم التسجيل بنجاح، يمكنك تسجيل الدخول الآن!');
                app.navigate('/login');
            } else {
                UI.showToast('حدث خطأ أثناء حفظ الحساب', 'error');
            }
        }, 500); // Simulate network delay
    });
};

Views.home = () => {
    let courses = Database.get(DB_KEYS.COURSES);
    let session = Database.getSession();
    let isStudent = session && session.role === 'student';

    if (isStudent && !window.currentTermFilter) {
        window.currentTermFilter = '1';
    }

    let filteredCourses = courses;
    let termTabsHtml = '';
    
    if (isStudent) {
        filteredCourses = filteredCourses.filter(c => (c.grade === session.grade || c.grade === 'all') && c.term === window.currentTermFilter);
        
        termTabsHtml = `
            <div class="tabs mb-6" style="justify-content:center; gap:1rem; border-bottom:1px solid var(--clr-border); padding-bottom: 1rem;">
                <button class="tab-btn ${window.currentTermFilter === '1' ? 'active' : ''}" style="flex:1; max-width:200px;" onclick="window.currentTermFilter='1'; app.route()">الفصل الدراسي الأول</button>
                <button class="tab-btn ${window.currentTermFilter === '2' ? 'active' : ''}" style="flex:1; max-width:200px;" onclick="window.currentTermFilter='2'; app.route()">الفصل الدراسي الثاني</button>
                <button class="tab-btn ${window.currentTermFilter === 'full' ? 'active' : ''}" style="flex:1; max-width:200px;" onclick="window.currentTermFilter='full'; app.route()">عام دراسي كامل</button>
            </div>
        `;
    }

    let html = `
        <section class="container mt-6 mb-8" style="padding:0 1rem;">
            <div style="position:relative; display:block; overflow:hidden; border-radius: var(--radius-xl); box-shadow: 0 15px 40px rgba(0,0,0,0.3); transition: transform 0.3s ease, box-shadow 0.3s ease;" 
                 onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 20px 50px rgba(0,0,0,0.4)';" 
                 onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 15px 40px rgba(0,0,0,0.3)';">
                <img src="hero.jpg" alt="منصة الأستاذ محمد عبدالسلام - تعلّم البيولوجيا بطريقة احترافية" style="width: 100%; height: auto; display: block; object-fit: cover;">
                
                ${session && session.role !== 'admin' ? `
                <a href="${session.role === 'parent' ? '#/parent-dashboard' : '#/dashboard'}" style="
                    position: absolute; 
                    top: 60%; 
                    left: 26%; 
                    transform: translate(-50%, -50%); 
                    background: linear-gradient(90deg, #f97316, #ea580c); 
                    color: white; 
                    padding: clamp(0.6rem, 1.2vw, 1rem) clamp(1.5rem, 3.5vw, 3rem); 
                    border-radius: 50px; 
                    font-size: clamp(0.9rem, 1.8vw, 1.8rem); 
                    font-weight: 900; 
                    text-decoration: none; 
                    box-shadow: 0 8px 20px rgba(234, 88, 12, 0.4); 
                    transition: all 0.3s ease; 
                    z-index: 10;
                    display: flex;
                    align-items: center;
                    gap: 8px;"
                    onmouseover="this.style.transform='translate(-50%, -50%) scale(1.1)'; this.style.boxShadow='0 15px 35px rgba(234, 88, 12, 0.6)';"
                    onmouseout="this.style.transform='translate(-50%, -50%) scale(1)'; this.style.boxShadow='0 8px 20px rgba(234, 88, 12, 0.4)';">
                    ابدأ الآن <i class="fa-solid fa-arrow-left"></i>
                </a>
                ` : ''}
            </div>
        </section>
        
        <section class="container mt-8 mb-8">
            <div class="flex justify-between items-center mb-6">
                <h2>${isStudent ? `دورات ${session.grade}` : 'أحدث الكورسات'}</h2>
            </div>
            ${termTabsHtml}
            <div class="grid grid-3 gap-6">
                ${filteredCourses.length === 0 ? '<div style="grid-column: 1 / -1;" class="text-center text-muted p-8 card">لا توجد كورسات متاحة في هذا الفصل الدراسي حالياً. يرجى مراجعة إدارة المنصة.</div>' : ''}
                ${filteredCourses.map(c => `
                    <div class="card cursor-pointer" onclick="app.navigate('/course/${c.id}')">
                        <div class="card-img-wrapper" style="position:relative;">
                            <span style="position:absolute; top:10px; right:10px; background:var(--clr-primary); color:white; padding:4px 10px; border-radius:30px; font-size:0.8rem; font-weight:bold; z-index:11;">
                                ${c.term === '1' ? 'الفصل الأول' : c.term === '2' ? 'الفصل الثاني' : 'عام كامل'}
                            </span>
                            <img src="${c.image}" class="card-img" alt="${c.title}">
                        </div>
                        <div class="card-body">
                            <h3 class="card-title">${c.title}</h3>
                            <p class="card-desc">${c.desc}</p>
                            <div class="card-footer mt-auto pt-4 flex justify-between items-center">
                                <span class="font-bold text-accent" style="font-size:1.2rem;">${c.price} ج.م</span>
                                <button class="btn btn-outline" style="padding:0.25rem 1rem">التفاصيل</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    `;
    app.root.innerHTML = html;
};

Views.courseDetail = (id) => {
    let courses = Database.get(DB_KEYS.COURSES);
    let course = courses.find(c => c.id === id);
    if(!course) return;
    
    let isEnrolled = Database.isEnrolled(id);
    let session = Database.getSession();
    
    let discount = 0;
    if (session && session.enrolledLessons && !isEnrolled) {
        course.lessons.forEach(l => {
            if (session.enrolledLessons.includes(`${course.id}_${l.id}`)) {
                discount += (l.price || 0);
            }
        });
    }
    let remainingPrice = Math.max(0, course.price - discount);

    let html = `
        <div class="container mt-8 mb-8">
            <div class="course-header" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 0; background: linear-gradient(145deg, var(--clr-surface), var(--clr-surface-light)); border: 1px solid var(--clr-border); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-lg); margin-bottom: 3rem;">
                <div style="padding: 3rem; display:flex; flex-direction:column; justify-content:center;">
                    <span style="background:rgba(249,115,22,0.1); color:var(--clr-accent); padding:0.5rem 1.2rem; border-radius:20px; font-weight:bold; font-size:0.9rem; margin-bottom:1.5rem; align-self:flex-start; display:inline-flex; align-items:center; gap:0.5rem;"><i class="fa-solid fa-star"></i> دورة متميزة</span>
                    <h1 class="text-accent mb-4" style="font-size: 2.5rem; line-height: 1.3;">${course.title}</h1>
                    <p class="text-muted mb-0" style="line-height:1.8; font-size: 1.15rem; max-width: 600px;">${course.desc}</p>
                </div>
                
                <div style="position:relative; background: var(--clr-bg); display:flex; align-items:center; justify-content:center; padding: 2rem;">
                    <img src="${course.image}" style="width:100%; height:auto; max-height:400px; object-fit:contain; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); transition: transform 0.3s ease;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
                    <div style="position:absolute; bottom:2rem; right:2rem; background:var(--clr-accent); color:white; padding:0.6rem 2rem; border-radius:30px; font-weight:900; font-size:1.3rem; box-shadow:0 10px 25px rgba(249,115,22,0.4); z-index:10; border: 2px solid rgba(255,255,255,0.2);">
                        ${course.price} ج.م
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 4rem;">
                ${isEnrolled || session.role === 'admin' ? `
                    <div style="background:linear-gradient(90deg, rgba(16, 185, 129, 0.1), transparent); border-right: 4px solid var(--clr-success); padding: 1.5rem; border-radius: 8px; color:var(--clr-success); font-size:1.1rem; font-weight:bold;">
                        <i class="fa-solid fa-check-circle" style="font-size:1.5rem; vertical-align:middle; margin-left:0.5rem;"></i> تهانينا! أنت مشترك بالفعل في هذا الكورس وتستطيع بدء التعلم.
                    </div>
                ` : `
                    <div style="background:var(--clr-surface); border: 1px solid var(--clr-border); border-radius:var(--radius-xl); padding:2.5rem; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
                        <div class="flex justify-between items-center gap-4" style="flex-wrap:wrap;">
                            <div>
                                <h3 class="flex items-center gap-3"><i class="fa-solid fa-cart-shopping text-accent"></i> شراء الدورة كاملة</h3>
                                ${discount > 0 ? `<p class="text-success mt-2 font-bold"><i class="fa-solid fa-tags"></i> تم خصم ${discount} ج.م قيمة الدروس التي اشتريتها مسبقاً.</p>` : ''}
                                <p class="text-muted mt-2" style="font-size:1.1rem;">رصيد محفظتك الحالي: <b class="text-white" style="background:rgba(255,255,255,0.1); padding:0.2rem 0.6rem; border-radius:6px; margin-right:5px;">${session.walletBalance || 0} ج.م</b></p>
                                ${session.walletBalance < remainingPrice ? `<p class="text-danger mt-2 font-bold"><i class="fa-solid fa-triangle-exclamation"></i> رصيدك غير كافٍ. <a href="#/wallet" style="color:var(--clr-accent); text-decoration:underline;">اشحن محفظتك الآن</a></p>` : ''}
                            </div>
                            <button onclick="window.buyFullCourse('${course.id}', ${remainingPrice})" class="btn btn-primary" style="padding: 1.2rem 2.5rem; font-size: 1.2rem; border-radius: 30px; box-shadow: 0 5px 20px rgba(249,115,22,0.4);" ${session.walletBalance < remainingPrice ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}>
                                تأكيد الشراء (${remainingPrice} ج.م)
                            </button>
                        </div>
                    </div>
                `}
            </div>

            <h2 class="mt-8 mb-4">محتوى الكورس</h2>
            <div class="card" style="padding:1rem;">
                ${course.lessons.map((l, i) => {
                    let icon = l.type === 'video' ? 'fa-play-circle' : l.type === 'pdf' ? 'fa-file-pdf' : 'fa-list-check';
                    let lessonAccessible = Database.isLessonEnrolled(course.id, l.id);
                    
                    return `
                    <div class="lesson-list-item flex justify-between items-center p-4 mb-3" style="background: var(--clr-bg); border-radius: var(--radius-md); border: 1px solid var(--clr-border); transition: transform 0.2s;" onmouseover="this.style.transform='translateX(-5px)'" onmouseout="this.style.transform='translateX(0)'">
                        <div class="flex items-center gap-3">
                            <i class="fa-solid ${icon} ${lessonAccessible?'text-accent':'text-muted'}" style="font-size:1.5rem;"></i>
                            <h4 class="mb-0 ${lessonAccessible?'text-white':'text-muted'}">${l.title}</h4>
                        </div>
                        <div class="lesson-action flex items-center gap-4">
                            ${lessonAccessible ? 
                                `<button class="btn btn-outline" style="padding: 0.4rem 1rem; border-radius:20px;" onclick="app.navigate('/lesson/${course.id}/${l.id}')"><i class="fa-solid fa-play"></i> عرض المحتوى</button>` 
                                : 
                                `<span class="text-danger font-bold mr-3" style="background:rgba(239, 68, 68, 0.1); padding:0.3rem 0.8rem; border-radius:8px;">${l.price || 0} ج.م</span>
                                <button class="btn btn-secondary" style="padding: 0.4rem 1rem; border-color:var(--clr-accent); color:var(--clr-accent); border-radius:20px;" onclick="window.buySingleLesson('${course.id}', '${l.id}', ${l.price || 0})"><i class="fa-solid fa-cart-shopping"></i> شراء الدرس فقط</button>`
                            }
                        </div>
                    </div>
                `}).join('')}
            </div>
        </div>
    `;

    app.root.innerHTML = html;

    window.buyFullCourse = (cid, price) => {
        if(confirm(`هل أنت متأكد من شراء الدورة كاملة بمبلغ ${price} ج.م ؟\nسيتم خصم المبلغ مباشرة من محفظتك.`)) {
            let res = Database.buyCourse(cid, price);
            if(res.success) {
                UI.showToast(res.msg);
                app.route(); // refresh
            } else {
                UI.showToast(res.msg, 'error');
            }
        }
    };
    
    window.buySingleLesson = (cid, lid, price) => {
        if(confirm(`هل أنت متأكد من شراء هذا الدرس بمبلغ ${price} ج.م ؟\nسيتم خصم المبلغ من محفظتك.`)) {
            let res = Database.buyLesson(cid, lid, price);
            if(res.success) {
                UI.showToast(res.msg);
                app.route(); // refresh
            } else {
                UI.showToast(res.msg, 'error');
            }
        }
    };
};

Views.wallet = () => {
    let session = Database.getSession();
    
    let html = `
        <div class="container mt-8 mb-8">
            <h1 class="mb-6"><i class="fa-solid fa-wallet text-accent"></i> محفظتي</h1>
            
            <div class="card p-6 mb-8 text-center" style="background: linear-gradient(135deg, var(--clr-surface), var(--clr-bg)); border: 2px solid var(--clr-accent); box-shadow: 0 10px 30px rgba(249,115,22,0.15);">
                <p class="text-muted mb-2 font-bold" style="font-size:1.2rem;">الرصيد المتاح حالياً</p>
                <div style="font-size: 4rem; font-weight: 900; color: #fff; text-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    ${session.walletBalance || 0} <span style="font-size: 1.5rem; color: var(--clr-accent);">ج.م</span>
                </div>
            </div>

            <h3 class="mb-6 flex items-center gap-2"><i class="fa-solid fa-plus-circle text-accent"></i> طرق شحن المحفظة المختلفة</h3>
            <div class="grid grid-2 gap-6">
                <!-- Option 1 -->
                <div class="card p-6 relative overflow-hidden" style="border-top: 4px solid #fcd34d">
                    <h4 class="mb-4"><i class="fa-solid fa-key" style="color:#fcd34d"></i> الشحن بكود التفعيل</h4>
                    <p class="text-muted mb-6">احصل على كود شحن من السنتر أو المكاتب المعتمدة والمكتبات.</p>
                    <div class="flex flex-col gap-3">
                        <input type="text" id="walletCode" class="form-control text-center font-bold" placeholder="أدخل كود الشحن" style="letter-spacing:2px; font-size:1.1rem; padding:1rem; background:rgba(255,255,255,0.03);">
                        <button onclick="window.rechargeByCode()" class="btn btn-primary w-100" style="padding:1rem; font-size:1.1rem;">تفعيل الكود وإضافة الرصيد <i class="fa-solid fa-check"></i></button>
                    </div>
                </div>
                
                <!-- Option 2 -->
                <div class="card p-6 relative" style="border-top: 4px solid #60a5fa">
                    <h4 class="mb-4"><i class="fa-solid fa-mobile-screen" style="color:#60a5fa"></i> الشحن من المحافظ الإلكترونية</h4>
                    <p class="text-muted mb-4">قم بتحويل المبلغ المطلوب للشحن للرقم: <br>
                        <span style="font-size:1.6rem; letter-spacing:2px; color:white; display:block; margin: 1rem 0; background:rgba(255,255,255,0.05); padding:1rem; text-align:center; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">${Database.get(DB_KEYS.SETTINGS).walletNumber || 'غير محدد'}</span>
                    </p>
                    <div class="form-group mb-4">
                        <input type="number" id="rechargeAmount" class="form-control text-center" placeholder="قيمة المبلغ المحول (ج.م)" style="font-size:1.1rem; padding:1rem;">
                    </div>
                    <label for="receiptUpload" class="btn btn-outline w-100 text-center flex items-center justify-center gap-2" style="cursor:pointer; border-style:dashed; padding:1rem;">
                        <i class="fa-solid fa-cloud-upload"></i> رفع صورة الإيصال أو التحويل
                    </label>
                    <input type="file" id="receiptUpload" accept="image/*" class="hidden" style="display:none;" onchange="window.uploadReceipt(this)">
                    <div id="receiptPreview" class="mt-3 text-success text-center font-bold" style="display:none; background:rgba(16,185,129,0.1); padding:0.5rem; border-radius:6px;"><i class="fa-solid fa-check-double"></i> تم تحديد الصورة بنجاح</div>
                    <button id="submitReceiptBtn" onclick="window.submitWalletReq()" class="btn btn-success w-100 mt-3" style="display:none; background:var(--clr-success); padding:1rem; font-size:1.1rem; border:none; box-shadow:0 4px 15px rgba(16,185,129,0.3);">إرسال طلب لمدير المنصة <i class="fa-solid fa-paper-plane"></i></button>
                </div>
            </div>
        </div>
    `;
    app.root.innerHTML = html;

    window.rechargeByCode = () => {
        let code = document.getElementById('walletCode').value;
        if(!code) return UI.showToast('الرجاء إدخال الكود', 'error');
        let res = Database.activateWalletCode(session.email, code);
        if(res.success) {
            UI.showToast(res.msg);
            app.route(); // refresh
        } else {
            UI.showToast(res.msg, 'error');
        }
    };

    let uploadedBase64 = null;
    window.uploadReceipt = (input) => {
        if(input.files && input.files[0]) {
            let reader = new FileReader();
            reader.onload = (e) => {
                uploadedBase64 = e.target.result;
                document.getElementById('receiptPreview').style.display = 'block';
                document.getElementById('submitReceiptBtn').style.display = 'block';
            };
            reader.readAsDataURL(input.files[0]);
        }
    };
    
    window.submitWalletReq = () => {
        let amount = document.getElementById('rechargeAmount').value;
        if(!amount || amount <= 0) return UI.showToast('يجب إدخال مبلغ صحيح', 'error');
        if(!uploadedBase64) return UI.showToast('يجب رفع صورة الإيصال أولاً', 'error');
        
        let res = Database.requestWalletRecharge(session.email, amount, uploadedBase64);
        UI.showToast(res.msg);
        app.route();
    };
};

Views.lesson = (courseId, lessonId) => {
    let courses = Database.get(DB_KEYS.COURSES);
    let course = courses.find(c => c.id === courseId);
    if (!course || !Database.isLessonEnrolled(courseId, lessonId)) {
        app.navigate('/'); return;
    }
    
    let lIdx = course.lessons.findIndex(l => l.id === lessonId);
    let lesson = course.lessons[lIdx];
    let prev = course.lessons[lIdx - 1];
    let next = course.lessons[lIdx + 1];

    let sessionObj = Database.getSession();
    if(sessionObj && sessionObj.role === 'student') {
        let lKey = `${courseId}_${lessonId}`;
        if(!sessionObj.viewedLessons) sessionObj.viewedLessons = [];
        if(!sessionObj.viewedLessons.includes(lKey)) {
            sessionObj.viewedLessons.push(lKey);
            Database.updateSession(sessionObj);
        }

        window.lessonTrackerInterval = setInterval(() => {
            let u = Database.getSession();
            if(!u) return;
            if(!u.totalTimeSpent) u.totalTimeSpent = 0;
            u.totalTimeSpent += 10;
            
            let today = new Date().toISOString().split('T')[0];
            if(!u.dailyActivity) u.dailyActivity = {};
            if(!u.dailyActivity[today]) u.dailyActivity[today] = 0;
            u.dailyActivity[today] += 10;

            Database.updateSession(u);
        }, 10000);
    }

    let contentHtml = '';

    // PROTECTIONS:
    // Right click disable, Context menu disable
    let protectHTML = `oncontextmenu="return false;" ondragstart="return false;" onselectstart="return false;"`;

    if (lesson.type === 'video') {
        let isYoutube = lesson.content.includes('youtube.com') || lesson.content.includes('youtu.be');
        let videoHtml = '';
        if (isYoutube) {
            let match = lesson.content.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})/);
            let videoId = (match && match[1]) ? match[1] : '';
            videoHtml = `
                <div style="position:relative; width:100%; height:500px;">
                    <iframe width="100%" height="100%" src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&controls=1&fs=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                    <div style="position:absolute; top:0; left:0; width:100%; height:80px; background:transparent; z-index:10;" title="محمي"></div>
                    <div style="position:absolute; bottom:0; right:0; width:100px; height:60px; background:transparent; z-index:10;" title="محمي"></div>
                </div>
            `;
        } else {
            videoHtml = `<video id="player" controls controlsList="nodownload" disablePictureInPicture style="width:100%; height:500px; object-fit:contain; background:#000;">
                    <source src="${lesson.content}" type="video/mp4">
                    متصفحك لا يدعم تشغيل الفيديو.
                </video>`;
        }

        contentHtml = `
            <div class="protected-content-wrapper" ${protectHTML}>
                <div class="watermark">${Database.getSession().email}</div>
                ${videoHtml}
            </div>
        `;
    } 
    else if (lesson.type === 'pdf') {
        let isDrive = lesson.content.includes('drive.google.com');
        let pdfUrl = lesson.content;
        if(isDrive && pdfUrl.includes('/view')) {
            pdfUrl = pdfUrl.replace('/view', '/preview');
        }

        contentHtml = `
            <div class="protected-content-wrapper" style="height:80vh; overflow:hidden; position:relative;" ${protectHTML}>
                <div class="watermark" style="pointer-events:none; z-index:10;">${Database.getSession().email}</div>
                
                ${isDrive ? `
                    <!-- Blocking overlay for Google Drive UI buttons -->
                    <div class="drive-ui-blocker" style="position:absolute; top:0; right:0; width:150px; height:60px; z-index:20; cursor:not-allowed;" title="أدوات التحميل معطلة للحماية"></div>
                ` : ''}
                
                <div class="protection-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:5; pointer-events:none;"></div>
                <iframe src="${pdfUrl}" width="100%" height="100%" frameborder="0"></iframe>
            </div>
        `;
    }
    else if (lesson.type === 'exam') {
        let user = Database.getSession();
        let previousResult = user && user.examResults ? user.examResults.find(r => r.courseId === courseId && r.lessonId === lessonId) : null;

        window.startExam = () => {
            window.examState = {
                current: 0,
                answers: new Array(lesson.questions.length).fill(-1),
                questions: lesson.questions
            };
            window.renderExam();
        };

        window.selectAnswer = (qIndex, oIndex) => {
            window.examState.answers[qIndex] = oIndex;
            window.renderExam();
        };

        window.goToQuestion = (index) => {
            window.examState.current = index;
            window.renderExam();
        };

        window.nextQuestion = () => {
            if (window.examState.current < window.examState.questions.length - 1) {
                window.examState.current++;
                window.renderExam();
            }
        };

        window.prevQuestion = () => {
            if (window.examState.current > 0) {
                window.examState.current--;
                window.renderExam();
            }
        };

        window.submitExam = () => {
            let score = 0;
            window.examState.questions.forEach((q, i) => {
                if (window.examState.answers[i] === q.answer) score++;
            });
            
            let scorePerc = (score / window.examState.questions.length) * 100;
            let isPerfect = score === window.examState.questions.length;
            let rewardMsg = "";

            let user = Database.getSession();
            if(user && user.role === 'student') {
                if(!user.examResults) user.examResults = [];
                user.examResults = user.examResults.filter(e => !(e.courseId === courseId && e.lessonId === lessonId));
                user.examResults.push({ courseId, lessonId, score, total: window.examState.questions.length, perc: scorePerc });
                
                // Check for reward
                if (isPerfect && lesson.reward > 0) {
                    if (!user.claimedRewards) user.claimedRewards = [];
                    if (!user.claimedRewards.includes(lessonId)) {
                        user.walletBalance = (user.walletBalance || 0) + parseFloat(lesson.reward);
                        user.claimedRewards.push(lessonId);
                        rewardMsg = `<div class="mt-4 p-4" style="background:rgba(34,197,94,0.1); border:1px solid var(--clr-success); border-radius:10px;">
                            <i class="fa-solid fa-gift text-success" style="font-size:1.5rem;"></i>
                            <p class="text-success font-bold mt-2">تهانينا! حصلت على جائزة ${lesson.reward} ج.م لتفوقك في الاختبار!</p>
                        </div>`;
                        UI.showToast(`مبروك! تمت إضافة ${lesson.reward} ج.م لمحفظتك`, 'success');
                    }
                }
                Database.updateSession(user);
            }

            let resultHtml = `
                <div class="text-center p-8">
                    <i class="fa-solid ${isPerfect ? 'fa-crown' : 'fa-trophy'} mb-4" style="font-size:4rem; color:${isPerfect ? '#fcd34d' : 'var(--clr-accent)'};"></i>
                    <h2 class="mb-4">${isPerfect ? 'إنجاز رائع! درجة نهائية' : 'اكتمل الاختبار!'}</h2>
                    <div style="font-size:3rem; font-weight:bold; color:var(--clr-success); margin-bottom:1rem;">${scorePerc.toFixed(0)}%</div>
                    <p class="text-muted" style="font-size:1.2rem;">إجاباتك الصحيحة: ${score} من ${window.examState.questions.length}</p>
                    ${rewardMsg}
                    <div class="flex gap-4 justify-center mt-8">
                        <button class="btn btn-outline" onclick="window.startExam()">إعادة الاختبار <i class="fa-solid fa-rotate-right"></i></button>
                        <button class="btn btn-primary" onclick="app.navigate('/course/${courseId}')">العودة للفهرس</button>
                    </div>
                </div>
            `;
            document.getElementById('exam-wrapper').innerHTML = resultHtml;
        };

        window.renderExamResult = (res) => {
            let isPerfect = res.perc === 100;
            return `
                <div class="text-center p-8">
                    <i class="fa-solid ${isPerfect ? 'fa-crown' : 'fa-check-circle'} mb-4" style="font-size:4rem; color:${isPerfect ? '#fcd34d' : 'var(--clr-success)'};"></i>
                    <h2 class="mb-2">لقد أتممت هذا الاختبار مسبقاً</h2>
                    <div style="font-size:3.5rem; font-weight:900; color:var(--clr-accent); margin-bottom:1rem;">${res.perc.toFixed(0)}%</div>
                    <p class="text-muted mb-8" style="font-size:1.1rem;">أفضل نتيجة لك: ${res.score} من ${res.total}</p>
                    <div class="flex gap-4 justify-center">
                        <button class="btn btn-primary" onclick="window.startExam()"><i class="fa-solid fa-play"></i> بدء الاختبار مرة أخرى</button>
                        <button class="btn btn-outline" onclick="app.navigate('/course/${courseId}')">العودة للفهرس</button>
                    </div>
                </div>
            `;
        };

        window.renderExam = () => {
            let state = window.examState;
            let q = state.questions[state.current];
            let answeredCount = state.answers.filter(a => a !== -1).length;
            let progress = (answeredCount / state.questions.length) * 100;
            
            let html = `
                <div class="exam-header mb-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="mb-0">السؤال ${state.current + 1} من ${state.questions.length}</h3>
                        <span class="text-accent font-bold" style="background:rgba(249,115,22,0.1); padding:0.5rem 1rem; border-radius:30px;">
                            <i class="fa-solid fa-list-check"></i> ${progress.toFixed(0)}% مكتمل
                        </span>
                    </div>
                    <div class="progress-bar-bg" style="width:100%; height:10px; background:var(--clr-surface-light); border-radius:5px; overflow:hidden;">
                        <div class="progress-bar-fill" style="width:${progress}%; height:100%; background:linear-gradient(90deg, var(--clr-accent), #fcd34d); transition:width 0.4s ease-out;"></div>
                    </div>
                    
                    <div class="question-nav mt-8 flex flex-wrap gap-2 justify-center">
                        ${state.questions.map((_, i) => `
                            <button class="q-nav-btn ${state.current === i ? 'active' : ''} ${state.answers[i] !== -1 ? 'answered' : ''}" 
                                onclick="window.goToQuestion(${i})"
                                style="width:40px; height:40px; border-radius:50%; border:2px solid ${state.current === i ? 'var(--clr-accent)' : (state.answers[i] !== -1 ? 'var(--clr-success)' : 'var(--clr-border)')}; 
                                background:${state.answers[i] !== -1 && state.current !== i ? 'var(--clr-success)' : (state.current === i ? 'var(--clr-accent)' : 'transparent')};
                                color:${state.answers[i] !== -1 || state.current === i ? '#fff' : 'var(--clr-text-muted)'};
                                cursor:pointer; font-weight:bold; outline:none; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                                display:flex; align-items:center; justify-content:center; box-shadow:${state.current === i ? '0 0 10px rgba(249,115,22,0.5)' : 'none'};">
                                ${i + 1}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="question-content bg-surface mb-6 fade-in" style="background:var(--clr-surface-light); border-radius:var(--radius-lg); padding:2rem; animation:fadeIn 0.3s ease;">
                    <h4 class="mb-6" style="font-size:1.3rem; line-height:1.8; color:#fff;">
                        ${q.q}
                    </h4>
                    <div class="options-grid flex flex-col gap-4">
                        ${q.options.map((opt, oIdx) => `
                            <label class="option-label ${state.answers[state.current] === oIdx ? 'selected' : ''}" 
                                onclick="window.selectAnswer(${state.current}, ${oIdx})"
                                style="position:relative; overflow:hidden; padding:1.25rem; border:2px solid ${state.answers[state.current] === oIdx ? 'var(--clr-accent)' : 'var(--clr-border)'}; border-radius:var(--radius-md); cursor:pointer; display:flex; align-items:center; transition:all 0.3s ease; background:${state.answers[state.current] === oIdx ? 'rgba(249,115,22,0.1)' : 'var(--clr-surface)'}">
                                <div class="radio-custom" style="width:22px; height:22px; min-width:22px; border-radius:50%; border:2px solid ${state.answers[state.current] === oIdx ? 'var(--clr-accent)' : 'var(--clr-text-muted)'}; display:flex; align-items:center; justify-content:center; margin-left:1rem; transition:all 0.2s;">
                                    ${state.answers[state.current] === oIdx ? `<div style="width:12px; height:12px; background:var(--clr-accent); border-radius:50%; transform:scale(1); transition:transform 0.2s;"></div>` : `<div style="width:12px; height:12px; background:transparent; border-radius:50%; transform:scale(0); transition:transform 0.2s;"></div>`}
                                </div>
                                <span style="flex:1; font-size:1.1rem; color:${state.answers[state.current] === oIdx ? '#fff' : 'var(--clr-text-muted)'}; transition:color 0.3s;">${opt}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="exam-footer flex justify-between mt-8 pt-6" style="border-top:1px solid var(--clr-border);">
                    <button class="btn btn-secondary" onclick="window.prevQuestion()" ${state.current === 0 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                        <i class="fa-solid fa-arrow-right"></i> السابق
                    </button>
                    
                    ${state.current === state.questions.length - 1 ? `
                        <button class="btn btn-primary" onclick="window.submitExam()" ${answeredCount < state.questions.length ? 'disabled style="opacity:0.5;cursor:not-allowed;" title="أجب على جميع الأسئلة"' : ''}>
                            إرسال الإجابات <i class="fa-solid fa-check-circle mr-2"></i>
                        </button>
                    ` : `
                        <button class="btn btn-primary" onclick="window.nextQuestion()">
                            التالي <i class="fa-solid fa-arrow-left"></i>
                        </button>
                    `}
                </div>
            `;
            
            document.getElementById('exam-wrapper').innerHTML = html;
        };

        contentHtml = `
            <style>
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .q-nav-btn:hover { border-color: var(--clr-accent) !important; color: white !important; }
                .q-nav-btn.answered:hover { opacity: 0.9; }
                .option-label:hover { border-color: var(--clr-accent) !important; background: rgba(249,115,22,0.05) !important; }
                .mr-2 { margin-right: 0.5rem; }
                .flex-col { flex-direction: column; }
                .flex-wrap { flex-wrap: wrap; }
                .justify-center { justify-content: center; }
            </style>
            <div class="exam-container" id="exam-wrapper" style="box-shadow:var(--shadow-lg); border:none; background:var(--clr-surface); padding:3rem; border-radius:var(--radius-xl); max-width:800px; margin:0 auto;">
                <!-- Exam content will be rendered here -->
            </div>
        `;

        setTimeout(() => {
            if(document.getElementById('exam-wrapper')) {
                if (previousResult) {
                    document.getElementById('exam-wrapper').innerHTML = window.renderExamResult(previousResult);
                } else {
                    window.startExam();
                }
            }
        }, 50);
    }

    let html = `
        <div class="container mt-8 mb-8" oncopy="return false" oncut="return false" onpaste="return false">
            <h1 class="mb-6">${lesson.title}</h1>
            ${contentHtml}
            
            <div class="flex justify-between mt-6">
                ${prev ? `<button class="btn btn-secondary" onclick="app.navigate('/lesson/${courseId}/${prev.id}')"><i class="fa-solid fa-arrow-right"></i> الدرس السابق</button>` : '<div></div>'}
                <button class="btn btn-outline" onclick="app.navigate('/course/${courseId}')">العودة للفهرس</button>
                ${next ? `<button class="btn btn-primary" onclick="app.navigate('/lesson/${courseId}/${next.id}')">الدرس التالي <i class="fa-solid fa-arrow-left"></i></button>` : '<div></div>'}
            </div>
        </div>
    `;
    
    app.root.innerHTML = html;

    // Extra runtime protection
    document.addEventListener('contextmenu', event => event.preventDefault());
};

Views.parentDashboard = () => {
    let session = Database.getSession();
    let users = Database.get(DB_KEYS.USERS);
    let child = users.find(u => u.email === session.childEmail && u.role === 'student');
    
    if(!child) {
        app.root.innerHTML = `<div class="container mt-8 text-center"><h2 class="text-danger">عفواً، لم يتم العثور على حساب الطالب المرتبط. يرجى مراجعة الإدارة.</h2></div>`;
        return;
    }

    let courses = Database.get(DB_KEYS.COURSES);
    let childCourses = courses.filter(c => 
        (child.enrolled && child.enrolled.includes(c.id)) || 
        (child.enrolledLessons && child.enrolledLessons.some(l => l.startsWith(c.id + '_')))
    );

    let totalScore = 0;
    let totalExams = 0;
    if(child.examResults && child.examResults.length > 0) {
        child.examResults.forEach(r => { totalScore += r.perc; totalExams++; });
    }
    let avgScore = totalExams > 0 ? (totalScore / totalExams) : 0;
    
    let evaluation = "لم يختبر بعد";
    let evalColor = "var(--clr-text-muted)";
    if(totalExams > 0) {
        if(avgScore >= 85) { evaluation = "ممتاز"; evalColor = "var(--clr-success)"; }
        else if(avgScore >= 70) { evaluation = "جيد جداً"; evalColor = "#3b82f6"; }
        else if(avgScore >= 50) { evaluation = "مقبول"; evalColor = "#f59e0b"; }
        else { evaluation = "ضعيف (يحتاج متابعة)"; evalColor = "var(--clr-danger)"; }
    }

    let totalMins = child.totalTimeSpent ? Math.floor(child.totalTimeSpent / 60) : 0;
    let totalHours = (totalMins / 60).toFixed(1);

    let html = `
        <div class="container mt-8 mb-8">
            <h1 class="mb-6"><i class="fa-solid fa-users text-accent"></i> لوحة متابعة ولي الأمر</h1>
            
            <div class="card p-6 mb-8" style="background: linear-gradient(135deg, var(--clr-surface), var(--clr-bg)); border-right: 4px solid var(--clr-accent);">
                <h3 class="mb-2">بيانات الطالب: <span class="text-accent">${child.email}</span></h3>
                <p class="font-bold">رصيد المحفظة الحالي: <span class="text-success">${child.walletBalance || 0} ج.م</span></p>
                <p class="text-muted mt-2">إجمالي وقت المشاهدة الفعلي: <span class="text-white font-bold">${totalHours > 0 ? totalHours + ' ساعة' : totalMins + ' دقيقة'}</span></p>
            </div>

            <div class="card p-6 mb-8">
                <h3 class="mb-4">نشاط الطالب الفعلي خلال آخر 7 أيام</h3>
                ${(() => {
                    let chartHtml = `<div class="flex gap-2 items-end mt-4" style="height: 150px; padding:1rem; background:var(--clr-bg); border-radius:10px;">`;
                    let last7Days = [];
                    for(let i=6; i>=0; i--) {
                        let d = new Date();
                        d.setDate(d.getDate() - i);
                        let dateStr = d.toISOString().split('T')[0];
                        last7Days.push({date: dateStr, name: d.toLocaleDateString('ar-EG', {weekday:'short'})});
                    }
                    let maxTime = 1; 
                    last7Days.forEach(day => {
                        let t = child.dailyActivity && child.dailyActivity[day.date] ? child.dailyActivity[day.date] : 0;
                        if(t > maxTime) maxTime = t;
                    });
                    
                    last7Days.forEach(day => {
                        let secs = child.dailyActivity && child.dailyActivity[day.date] ? child.dailyActivity[day.date] : 0;
                        let mins = Math.floor(secs / 60);
                        let heightPct = (secs / maxTime) * 100;
                        if(secs === 0) heightPct = 5; 
                        chartHtml += `
                            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:0.5rem; height:100%;">
                                <div style="width:100%; height:100%; display:flex; align-items:flex-end; justify-content:center;">
                                    <div title="${mins} دقيقة" style="width:40%; max-width:40px; height:${heightPct}%; background: ${secs>0 ? 'var(--clr-accent)' : 'var(--clr-surface-light)'}; border-radius:4px 4px 0 0; transition:height 0.5s ease;"></div>
                                </div>
                                <span style="font-size:0.75rem; color:var(--clr-text-muted);">${day.name}</span>
                            </div>
                        `;
                    });
                    chartHtml += `</div>`;
                    return chartHtml;
                })()}
            </div>

            <div class="grid grid-2 gap-6 mb-8">
                <div class="card p-6 text-center">
                    <h3 class="mb-4">التقييم الشامل</h3>
                    <div style="font-size:2.5rem; font-weight:900; color:${evalColor};">${evaluation}</div>
                    ${totalExams > 0 ? `<p class="text-muted mt-2">متوسط الدرجات: ${avgScore.toFixed(1)}% في ${totalExams} اختبارات</p>` : ''}
                </div>
                <div class="card p-6">
                    <h3 class="mb-4">نتائج الاختبارات الأخيرة</h3>
                    ${child.examResults && child.examResults.length > 0 ? `
                        <ul style="list-style:none; padding:0;">
                            ${child.examResults.slice().reverse().map(r => {
                                let c = courses.find(x => x.id === r.courseId);
                                let l = c ? c.lessons.find(x => x.id === r.lessonId) : null;
                                return `<li class="flex justify-between items-center p-3 mb-2" style="background:var(--clr-surface); border-radius:5px;">
                                    <span>${l ? l.title : 'اختبار غير معروف'}</span>
                                    <span class="font-bold ${r.perc>=50?'text-success':'text-danger'}">${r.perc.toFixed(0)}%</span>
                                </li>`;
                            }).join('')}
                        </ul>
                    ` : '<p class="text-muted">لا توجد نتائج اختبارات حتى الآن.</p>'}
                </div>
            </div>

            <h3 class="mb-4">متابعة الدورات المشترك بها</h3>
            ${childCourses.length === 0 ? '<p class="text-muted">لم يشترك الطالب في أي دورات بعد.</p>' : `
                <div class="grid grid-2 gap-6">
                    ${childCourses.map(c => {
                        let totalLessons = c.lessons.length;
                        let viewedLessonsCount = 0;
                        let totalExamsForCourse = 0;
                        let solvedExamsForCourse = 0;

                        c.lessons.forEach(l => {
                            if(child.viewedLessons && child.viewedLessons.includes(c.id + '_' + l.id)) {
                                viewedLessonsCount++;
                            }
                            if(l.type === 'exam') {
                                totalExamsForCourse++;
                                if(child.examResults && child.examResults.some(r => r.courseId === c.id && r.lessonId === l.id)) {
                                    solvedExamsForCourse++;
                                }
                            }
                        });
                        
                        let progress = totalLessons > 0 ? (viewedLessonsCount / totalLessons) * 100 : 0;
                        let missedExams = totalExamsForCourse - solvedExamsForCourse;
                        
                        return `
                            <div class="card p-4">
                                <h4 class="mb-2">${c.title}</h4>
                                <div class="flex justify-between text-sm mb-2">
                                    <span class="text-muted">تم استكمال ${viewedLessonsCount} من ${totalLessons} درس</span>
                                    <span class="text-accent font-bold">${progress.toFixed(0)}% متابعة</span>
                                </div>
                                <div class="progress-bar-bg mb-4" style="width:100%; height:8px; background:var(--clr-surface-light); border-radius:4px; overflow:hidden;">
                                    <div class="progress-bar-fill" style="width:${progress}%; height:100%; background:var(--clr-accent);"></div>
                                </div>
                                ${totalExamsForCourse > 0 ? `
                                    <div class="text-sm mt-3 pt-3" style="border-top:1px solid var(--clr-border);">
                                        <span class="text-muted">اختبارات الدورة: </span>
                                        <span class="font-bold ${missedExams === 0 ? 'text-success' : 'text-danger'}">
                                            ${missedExams === 0 ? '<i class="fa-solid fa-check"></i> أنهى جميع الاختبارات' : `<i class="fa-solid fa-triangle-exclamation"></i> تخلف عن حل ${missedExams} اختبار`}
                                        </span>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;
    app.root.innerHTML = html;
};

Views.books = () => {
    let session = Database.getSession();
    let isStudent = session && session.role === 'student';

    if (isStudent && !window.currentBookTermFilter) {
        window.currentBookTermFilter = '1';
    }

    let allBooks = Database.get(DB_KEYS.BOOKS);
    let books = allBooks;
    let termTabsHtml = '';

    if (isStudent) {
        books = allBooks.filter(b => (!b.grade || b.grade === session.grade || b.grade === 'all') && (!b.term || b.term === window.currentBookTermFilter || b.term === 'full'));
        
        termTabsHtml = `
            <div class="tabs mb-6" style="justify-content:center; gap:1rem; border-bottom:1px solid var(--clr-border); padding-bottom: 1rem;">
                <button class="tab-btn ${window.currentBookTermFilter === '1' ? 'active' : ''}" style="flex:1; max-width:200px;" onclick="window.currentBookTermFilter='1'; app.route()">الفصل الدراسي الأول</button>
                <button class="tab-btn ${window.currentBookTermFilter === '2' ? 'active' : ''}" style="flex:1; max-width:200px;" onclick="window.currentBookTermFilter='2'; app.route()">الفصل الدراسي الثاني</button>
                <button class="tab-btn ${window.currentBookTermFilter === 'full' ? 'active' : ''}" style="flex:1; max-width:200px;" onclick="window.currentBookTermFilter='full'; app.route()">عام دراسي كامل</button>
            </div>
        `;
    }

    let html = `
        <div class="container mt-8 mb-8" style="min-height: 50vh;">
            <h1 class="mb-6"><i class="fa-solid fa-book-open text-accent"></i> كتب ومذكرات</h1>
            ${termTabsHtml}
            ${books.length === 0 ? '<div class="card p-8 text-center text-muted">لا يوجد مذكرات متاحة حالياً في هذا الفصل الدراسي</div>' : ''}
            <div class="grid grid-3 gap-6">
                ${books.map(b => {
                    let purchased = session.purchasedBooks && session.purchasedBooks.includes(b.id);
                    return `
                        <div class="card p-6 shadow-lg" style="display:flex; flex-direction:column; background:var(--clr-surface); border:1px solid var(--clr-border); border-radius: var(--radius-xl); transition: transform 0.3s ease; position:relative;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
                            <div style="height: 250px; margin:-1.5rem -1.5rem 1.5rem -1.5rem; background: linear-gradient(145deg, var(--clr-bg), var(--clr-surface)); border-radius: var(--radius-xl) var(--radius-xl) 0 0; position:relative; display:flex; align-items:center; justify-content:center; padding: 1.5rem;">
                                ${b.image ? `
                                    <img src="${b.image}" style="max-height:100%; max-width:100%; object-fit:contain; border-radius: 4px; box-shadow: 0 10px 20px rgba(0,0,0,0.5);" alt="غلاف الكتاب">
                                ` : `
                                    <div style="width:140px; height:200px; background:var(--clr-surface-light); border-radius:4px; box-shadow: 0 10px 20px rgba(0,0,0,0.3); display:flex; flex-direction:column; align-items:center; justify-content:center; border: 2px solid var(--clr-border);">
                                        <i class="fa-solid fa-file-pdf text-accent mb-2" style="font-size:3rem;"></i>
                                        <span class="text-muted text-xs font-bold text-center" style="font-size:0.8rem;">PDF<br>مذكرة</span>
                                    </div>
                                `}
                            </div>
                            
                            <div style="display:flex; flex-direction:column; flex:1;">
                                <h3 class="mb-2" style="font-size: 1.2rem; line-height: 1.4; text-align:right;">${b.title}</h3>
                                <p class="text-muted mb-4" style="font-size:0.9rem; flex:1; line-height:1.6; text-align:right;">${b.desc || ''}</p>
                                
                                <div style="display:flex; flex-direction:column; gap:0.8rem; margin-top:auto; padding-top:1rem; border-top:1px solid var(--clr-border);">
                                    ${purchased ? `
                                        <div style="display:flex; align-items:center; justify-content:center; gap:0.5rem; background: rgba(34, 197, 94, 0.1); padding: 0.5rem; border-radius: 8px;">
                                            <i class="fa-solid fa-check-circle text-success"></i> 
                                            <span class="text-success font-bold text-sm">تم الشراء مسبقاً</span>
                                        </div>
                                        <button onclick="app.navigate('/book/${b.id}')" class="btn btn-primary" style="width:100%; text-align:center;"><i class="fa-solid fa-book-open"></i> تصفح الآن</button>
                                    ` : `
                                        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--clr-bg); padding:1rem; border-radius:8px;">
                                            <span class="text-muted" style="font-size:0.9rem;">التكلفة:</span>
                                            <span class="text-accent font-bold" style="font-size:1.1rem;">${b.price === 0 ? 'مجاني' : b.price + ' ج.م'}</span>
                                        </div>
                                        <button class="btn btn-primary" style="width:100%; display:flex; align-items:center; justify-content:center; gap:0.5rem; outline:none; border:none; padding:0.8rem; border-radius:8px;" onclick="window.buyBook('${b.id}', ${b.price})"><i class="fa-solid fa-cart-shopping"></i> اقتناء</button>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    app.root.innerHTML = html;

    window.buyBook = (bId, price) => {
        if(confirm(`هل أنت متأكد من شراء هذه المذكرة بسعر ${price} ج.م؟ سيتم الخصم من محفظتك.`)) {
            let res = Database.buyBook(bId, price);
            if(res.success) {
                UI.showToast(res.msg);
                app.route();
            } else {
                UI.showToast(res.msg, 'error');
            }
        }
    };
};

Views.bookViewer = (bookId) => {
    let book = Database.get(DB_KEYS.BOOKS).find(b => b.id === bookId);
    let session = Database.getSession();
    
    if(!book) {
        app.navigate('/books');
        return;
    }

    // Check if purchased
    let isPurchased = session && session.purchasedBooks && session.purchasedBooks.includes(bookId);
    let isAdmin = session && session.role === 'admin';
    
    if(!isPurchased && !isAdmin) {
        UI.showToast('يجب اقتناء المذكرة أولاً لتتمكن من تصفحها', 'error');
        app.navigate('/books');
        return;
    }

    let pdfUrl = book.link;
    if(pdfUrl.includes('drive.google.com')) {
        // Convert drive link to preview link if needed
        if(pdfUrl.includes('/view')) {
            pdfUrl = pdfUrl.replace('/view', '/preview');
        } else if(!pdfUrl.includes('/preview')) {
            // handle other drive formats if possible
        }
    }

    let protectHTML = `oncontextmenu="return false;" onselectstart="return false;" ondragstart="return false;"`;
    
    let html = `
        <div class="container mt-8 mb-8" ${protectHTML}>
            <div class="flex justify-between items-center mb-6">
                <h1 class="mb-0">${book.title}</h1>
                <button class="btn btn-outline" onclick="app.navigate('/books')"><i class="fa-solid fa-arrow-right"></i> العودة للمكتبة</button>
            </div>
            
            <div class="protected-content-wrapper" style="height:85vh; border-radius:var(--radius-xl); overflow:hidden; position:relative; box-shadow:var(--shadow-lg); border: 2px solid var(--clr-border);" ${protectHTML}>
                <div class="watermark" style="pointer-events:none; z-index:10;">${session.email}</div>
                
                <!-- Blocking overlay for Google Drive UI buttons (Pop-out, Print, Download) -->
                <div class="drive-ui-blocker" style="position:absolute; top:0; right:0; width:150px; height:60px; z-index:20; cursor:not-allowed;" title="أدوات التحميل معطلة للحماية"></div>
                
                <div class="protection-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:5; pointer-events:none;"></div>
                <iframe src="${pdfUrl}" width="100%" height="100%" frameborder="0" style="background:var(--clr-bg);"></iframe>
            </div>
            
            <div class="mt-6 p-4 card text-center text-muted" style="font-size:0.9rem;">
                <i class="fa-solid fa-shield-halved text-accent"></i> يتم عرض هذا المحتوى حصرياً لمنصة محمد عبدالسلام. يمنع النسخ أو التداول تحت طائلة المساءلة.
            </div>
        </div>
    `;
    
    app.root.innerHTML = html;
};

Views.dashboard = () => {
    let session = Database.getSession();
    let courses = Database.get(DB_KEYS.COURSES);
    let myCourses = courses.filter(c => 
        (session.enrolled && session.enrolled.includes(c.id)) || 
        (session.enrolledLessons && session.enrolledLessons.some(l => l.startsWith(c.id + '_')))
    );

    let html = `
        <div class="dashboard container mt-8 mb-8" style="display:block;">
            <h2 class="mb-6"><i class="fa-solid fa-graduation-cap text-accent"></i> الدورات المشترك بها</h2>
            ${myCourses.length === 0 ? '<div class="card p-8 text-center text-muted">لا يوجد دورات مفعلة حالياً</div>' : ''}
            <div class="grid grid-3 gap-6">
                ${myCourses.map(c => `
                    <div class="card cursor-pointer" onclick="app.navigate('/course/${c.id}')">
                         <div class="card-img-wrapper" style="padding-top: 40%">
                            <img src="${c.image}" class="card-img">
                        </div>
                        <div class="card-body p-4">
                            <h4>${c.title}</h4>
                            <button class="btn btn-primary w-100 mt-4" style="width:100%">متابعة التعلم</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    app.root.innerHTML = html;
};

Views.contact = () => {
    let settings = Database.get(DB_KEYS.SETTINGS) || {};
    
    let waLink = settings.whatsappNum ? `https://wa.me/${settings.whatsappNum}` : '#';
    let tgLink = settings.telegramLink ? (settings.telegramLink.includes('http') ? settings.telegramLink : `https://t.me/${settings.telegramLink}`) : '#';
    let fbLink = settings.facebookLink ? (settings.facebookLink.includes('http') ? settings.facebookLink : `https://${settings.facebookLink}`) : '#';
    
    let html = `
        <div class="container mt-8 mb-8 text-center">
            <h1 class="mb-4"><i class="fa-solid fa-headset text-accent"></i> تواصل معنا</h1>
            <p class="text-muted mb-8" style="font-size:1.2rem;">نحن هنا دائماً لمساعدتك. يمكنك التواصل معنا عبر أي من القنوات التالية:</p>
            
            <div class="grid grid-3 gap-6">
                <!-- WhatsApp -->
                <div class="card p-6" style="border-top: 4px solid #25D366; transition: transform 0.3s; cursor: pointer;" onmouseover="this.style.transform='translateY(-10px)'" onmouseout="this.style.transform='translateY(0)'" onclick="if('${waLink}' !== '#') window.open('${waLink}', '_blank'); else alert('لم يتم إعداد رقم الواتساب بعد، يرجى مراجعة الإدارة.');">
                    <i class="fa-brands fa-whatsapp mb-4" style="font-size: 4rem; color: #25D366;"></i>
                    <h3>واتساب</h3>
                    <p class="text-muted">تواصل معنا عبر رسائل الواتساب للحصول على دعم سريع.</p>
                </div>
                
                <!-- Telegram -->
                <div class="card p-6" style="border-top: 4px solid #0088cc; transition: transform 0.3s; cursor: pointer;" onmouseover="this.style.transform='translateY(-10px)'" onmouseout="this.style.transform='translateY(0)'" onclick="if('${tgLink}' !== '#') window.open('${tgLink}', '_blank'); else alert('لم يتم إعداد التليجرام بعد، يرجى مراجعة الإدارة.');">
                    <i class="fa-brands fa-telegram mb-4" style="font-size: 4rem; color: #0088cc;"></i>
                    <h3>تليجرام</h3>
                    <p class="text-muted">انضم لقناتنا أو راسل الدعم الفني عبر تليجرام.</p>
                </div>
                
                <!-- Facebook -->
                <div class="card p-6" style="border-top: 4px solid #1877F2; transition: transform 0.3s; cursor: pointer;" onmouseover="this.style.transform='translateY(-10px)'" onmouseout="this.style.transform='translateY(0)'" onclick="if('${fbLink}' !== '#') window.open('${fbLink}', '_blank'); else alert('لم يتم إعداد صفحة الفيسبوك بعد، يرجى مراجعة الإدارة.');">
                    <i class="fa-brands fa-facebook mb-4" style="font-size: 4rem; color: #1877F2;"></i>
                    <h3>فيسبوك</h3>
                    <p class="text-muted">تابع صفحتنا وتواصل معنا عبر رسائل ماسنجر.</p>
                </div>
            </div>
        </div>
    `;
    app.root.innerHTML = html;
};

window.AdminActions = {
    addBook() {
        let html = `
            <div class="modal-header">
                <h3 class="mb-0">إضافة كتاب / مذكرة تعليمية</h3>
                <button class="modal-close" onclick="AdminActions.closeModal()"><i class="fa-solid fa-times"></i></button>
            </div>
            <div class="form-group"><label class="form-label">عنوان المذكرة</label><input type="text" id="bTitle" class="form-control" placeholder="مثال: مذكرة مراجعة الباب الأول"></div>
            <div class="form-group"><label class="form-label">وصف مبسط</label><textarea id="bDesc" class="form-control" rows="2" placeholder="وصف محتوى المذكرة..."></textarea></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                <div class="form-group">
                    <label class="form-label">الصف الدراسي</label>
                    <datalist id="existingGradesBooks">
                        ${Database.getActiveGrades().map(g => `<option value="${g}">${g === '1' ? 'الصف الأول الثانوي' : g === '2' ? 'الصف الثاني الثانوي' : g === '3' ? 'الصف الثالث الثانوي' : ''}</option>`).join('')}
                    </datalist>
                    <input type="text" id="bGrade" list="existingGradesBooks" class="form-control" placeholder="مثلاً: الصف الأول الإعدادي">
                </div>
                <div class="form-group">
                    <label class="form-label">الفصل الدراسي</label>
                    <select id="bTerm" class="form-control" style="background-color: var(--clr-bg);">
                        <option value="1">الفصل الدراسي الأول</option>
                        <option value="2">الفصل الدراسي الثاني</option>
                        <option value="full">عام دراسي كامل</option>
                    </select>
                </div>
            </div>
            <div class="form-group"><label class="form-label">السعر (ج.م)</label><input type="number" id="bPrice" class="form-control" value="0"></div>
            <div class="form-group"><label class="form-label">رابط صورة الغلاف</label><input type="text" id="bImage" class="form-control" placeholder="https://..."></div>
            <div class="form-group"><label class="form-label">رابط التحميل / القراءة (رابط PDF)</label><input type="text" id="bLink" class="form-control" placeholder="https://..."></div>
            <button class="btn btn-primary w-100" style="width:100%" onclick="AdminActions.saveBook()">حفظ وإضافة للمنصة</button>
        `;
        this.openModal(html);
    },
    saveBook() {
        let title = document.getElementById('bTitle').value;
        let desc = document.getElementById('bDesc').value;
        let price = parseFloat(document.getElementById('bPrice').value) || 0;
        let link = document.getElementById('bLink').value;
        let image = document.getElementById('bImage').value;
        let grade = document.getElementById('bGrade').value || 'all';
        let term = document.getElementById('bTerm').value || 'full';
        
        if(!title || !link) return UI.showToast('يرجى إدخال العنوان والرابط كحد أدنى', 'error');
        
        let books = Database.get(DB_KEYS.BOOKS);
        books.push({ id: 'b' + Date.now(), title, desc, price, link, image, grade, term });
        Database.set(DB_KEYS.BOOKS, books);
        
        UI.showToast('تم إدراج المذكرة بنجاح');
        this.closeModal();
        app.route();
    },
    deleteBook(id) {
        if(!confirm('هل أنت متأكد من حذف هذه المذكرة من المنصة بشكل نهائي؟')) return;
        let books = Database.get(DB_KEYS.BOOKS).filter(b => b.id !== id);
        Database.set(DB_KEYS.BOOKS, books);
        UI.showToast('تم الحذف بنجاح');
        app.route();
    },
    openModal(html) {
        let overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal-dialog">${html}</div>`;
        document.body.appendChild(overlay);
        this.currentModal = overlay;
    },
    closeModal() {
        if(this.currentModal) { this.currentModal.remove(); this.currentModal = null; }
    },
    viewImage(base64) {
        let html = `
            <div class="modal-header">
                <h3 class="mb-0">صورة الإيصال المرفقة</h3>
                <button class="modal-close" onclick="AdminActions.closeModal()"><i class="fa-solid fa-times"></i></button>
            </div>
            <div class="text-center" style="padding:1rem 0;">
                <img src="${base64}" style="max-width:100%; max-height:60vh; border-radius:8px; display:block; margin:0 auto;">
            </div>
        `;
        this.openModal(html);
    },
    decideReq(id, action) {
        if(!confirm(action === 'approve'? 'هل أنت متأكد من تفعيل الكورس لهذا الطالب؟' : 'هل أنت متأكد من رفض طلب الدفع هذا؟')) return;
        if(action === 'approve') {
            Database.approveRequest(id);
            UI.showToast('تم تفعيل الكورس للطالب بنجاح');
        } else {
            Database.rejectRequest(id);
            UI.showToast('تم رفض الطلب', 'error');
        }
        app.route();
    },
    saveSettings() {
        let w = document.getElementById('walletNumInput').value;
        let wa = document.getElementById('waInput').value;
        let tg = document.getElementById('tgInput').value;
        let fb = document.getElementById('fbInput').value;
        
        let s = Database.get(DB_KEYS.SETTINGS) || {};
        s.walletNumber = w;
        s.whatsappNum = wa;
        s.telegramLink = tg;
        s.facebookLink = fb;
        
        Database.set(DB_KEYS.SETTINGS, s);
        UI.showToast('تم حفظ الإعدادات بنجاح');
        app.route();
    },
    addCourse() {
        let html = `
            <div class="modal-header">
                <h3 class="mb-0">إضافة دورة جديدة</h3>
                <button class="modal-close" onclick="AdminActions.closeModal()"><i class="fa-solid fa-times"></i></button>
            </div>
            <div class="form-group"><label class="form-label">اسم الدورة</label><input type="text" id="cTitle" class="form-control"></div>
            <div class="form-group"><label class="form-label">الوصف</label><textarea id="cDesc" class="form-control" rows="2"></textarea></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                <div class="form-group">
                    <label class="form-label">الصف الدراسي</label>
                    <datalist id="existingGradesAddC">
                        ${Database.getActiveGrades().map(g => `<option value="${g}">${g === '1' ? 'الصف الأول الثانوي' : g === '2' ? 'الصف الثاني الثانوي' : g === '3' ? 'الصف الثالث الثانوي' : ''}</option>`).join('')}
                    </datalist>
                    <input type="text" id="cGrade" list="existingGradesAddC" class="form-control" placeholder="مثلاً: الصف الأول الإعدادي">
                </div>
                <div class="form-group">
                    <label class="form-label">الفصل الدراسي</label>
                    <select id="cTerm" class="form-control" style="background-color: var(--clr-bg);">
                        <option value="1">الفصل الدراسي الأول</option>
                        <option value="2">الفصل الدراسي الثاني</option>
                        <option value="full">عام دراسي كامل</option>
                    </select>
                </div>
            </div>
            <div class="form-group"><label class="form-label">السعر (ج.م)</label><input type="number" id="cPrice" class="form-control"></div>
            <div class="form-group"><label class="form-label">رابط صورة الغلاف</label><input type="text" id="cImage" class="form-control" placeholder="https://..."></div>
            <button class="btn btn-primary w-100" style="width:100%" onclick="AdminActions.saveCourse('add')">حفظ وإضافة</button>
        `;
        this.openModal(html);
    },
    editCourse(cId) {
        let course = Database.get(DB_KEYS.COURSES).find(c => c.id === cId);
        let html = `
            <div class="modal-header">
                <h3 class="mb-0">تعديل بيانات الدورة</h3>
                <button class="modal-close" onclick="AdminActions.closeModal()"><i class="fa-solid fa-times"></i></button>
            </div>
            <input type="hidden" id="cId" value="${cId}">
            <div class="form-group"><label class="form-label">اسم الدورة</label><input type="text" id="cTitle" class="form-control" value="${course.title}"></div>
            <div class="form-group"><label class="form-label">الوصف</label><textarea id="cDesc" class="form-control" rows="2">${course.desc}</textarea></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                <div class="form-group">
                    <label class="form-label">الصف الدراسي</label>
                    <datalist id="existingGradesEditC">
                        ${Database.getActiveGrades().map(g => `<option value="${g}">${g === '1' ? 'الصف الأول الثانوي' : g === '2' ? 'الصف الثاني الثانوي' : g === '3' ? 'الصف الثالث الثانوي' : ''}</option>`).join('')}
                    </datalist>
                    <input type="text" id="cGrade" list="existingGradesEditC" class="form-control" placeholder="مثلاً: الصف الأول الإعدادي" value="${course.grade || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">الفصل الدراسي</label>
                    <select id="cTerm" class="form-control" style="background-color: var(--clr-bg);">
                        <option value="1" ${course.term==='1'?'selected':''}>الفصل الدراسي الأول</option>
                        <option value="2" ${course.term==='2'?'selected':''}>الفصل الدراسي الثاني</option>
                        <option value="full" ${course.term==='full'?'selected':''}>عام دراسي كامل</option>
                    </select>
                </div>
            </div>
            <div class="form-group"><label class="form-label">السعر (ج.م)</label><input type="number" id="cPrice" class="form-control" value="${course.price}"></div>
            <div class="form-group"><label class="form-label">رابط صورة الغلاف</label><input type="text" id="cImage" class="form-control" value="${course.image}"></div>
            <button class="btn btn-primary w-100" style="width:100%" onclick="AdminActions.saveCourse('edit')">حفظ التعديلات</button>
        `;
        this.openModal(html);
    },
    deleteCourse(cId) {
        if(!confirm('هل أنت متأكد من حذف هذه الدورة بالكامل؟ (لا يمكن التراجع)')) return;
        let c = Database.get(DB_KEYS.COURSES);
        c = c.filter(x => x.id !== cId);
        Database.set(DB_KEYS.COURSES, c);
        app.route();
    },
    saveCourse(mode) {
        let title = document.getElementById('cTitle').value;
        let desc = document.getElementById('cDesc').value;
        let price = document.getElementById('cPrice').value;
        let image = document.getElementById('cImage').value;
        let grade = document.getElementById('cGrade').value;
        let term = document.getElementById('cTerm').value;
        
        let courses = Database.get(DB_KEYS.COURSES);
        if(mode === 'edit') {
            let id = document.getElementById('cId').value;
            let idx = courses.findIndex(x => x.id === id);
            courses[idx].title = title;
            courses[idx].desc = desc;
            courses[idx].price = price;
            courses[idx].image = image;
            courses[idx].grade = grade;
            courses[idx].term = term;
            UI.showToast('تم تعديل الدورة بنجاح');
        } else {
            courses.push({
                id: 'c' + Date.now(), title, desc, price, image, grade, term, lessons: []
            });
            UI.showToast('تمت إضافة الدورة بنجاح');
        }
        Database.set(DB_KEYS.COURSES, courses);
        this.closeModal();
        app.route();
    },
    // Lessons & Content
    addLesson(courseId) {
        let html = `
            <div class="modal-header">
                <h3 class="mb-0">إضافة محتوى جديد الدرس</h3>
                <button class="modal-close" onclick="AdminActions.closeModal()"><i class="fa-solid fa-times"></i></button>
            </div>
            <input type="hidden" id="lCourseId" value="${courseId}">
            <div class="form-group"><label class="form-label">عنوان الدرس / الاختبار</label><input type="text" id="lTitle" class="form-control"></div>
            <div class="form-group"><label class="form-label">سعر الدرس (ج.م)</label><input type="number" id="lPrice" class="form-control" value="0"></div>
            <div class="form-group">
                <label class="form-label">نوع المحتوى</label>
                <select id="lType" class="form-control" onchange="AdminActions.toggleLessonInputs()">
                    <option value="video">مقطع فيديو</option>
                    <option value="pdf">ملف PDF</option>
                    <option value="exam">اختبار (أسئلة وأجوبة)</option>
                </select>
            </div>
            <div id="lContentWrap" class="form-group">
                <label class="form-label">رابط الفيديو (URL)</label>
                <input type="text" id="lContent" class="form-control" placeholder="https://...">
            </div>
            <div id="lRewardWrap" class="form-group" style="display:none;">
                <label class="form-label">مكافأة التفوق (تضاف لمحفظة الطالب عند الحصول على 100%)</label>
                <input type="number" id="lReward" class="form-control" value="0" placeholder="0 ج.م">
            </div>
            <button class="btn btn-primary w-100" style="width:100%" onclick="AdminActions.saveLesson()">حفظ المحتوى</button>
        `;
        this.openModal(html);
    },
    toggleLessonInputs() {
        let type = document.getElementById('lType').value;
        let wrap = document.getElementById('lContentWrap');
        let rewardWrap = document.getElementById('lRewardWrap');
        
        if(type === 'exam') {
            rewardWrap.style.display = 'block';
            wrap.innerHTML = `
                <div id="qList"></div>
                <button type="button" class="btn btn-outline w-100 mt-2" onclick="AdminActions.addQuestionField()">+ إضافة سؤال جديد</button>
            `;
            AdminActions.addQuestionField();
        } else if (type === 'pdf') {
            rewardWrap.style.display = 'none';
            wrap.innerHTML = `
                <label class="form-label">رابط ملف الـ PDF</label>
                <input type="text" id="lContent" class="form-control" placeholder="https://...">
            `;
        } else {
            rewardWrap.style.display = 'none';
            wrap.innerHTML = `
                <label class="form-label">رابط ملف الفيديو</label>
                <input type="text" id="lContent" class="form-control" placeholder="https://...">
            `;
        }
    },
    addQuestionField() {
        let qList = document.getElementById('qList');
        let index = qList.children.length;
        let html = `
            <div class="card p-4 mt-4" style="background:var(--clr-bg); border-color:var(--clr-border);">
                <div class="form-group"><label class="form-label text-accent">السؤال</label><input type="text" class="form-control q-text"></div>
                <div class="form-group"><label class="form-label">خيارات الإجابة (كل خيار مفصول بفاصلة , )</label><input type="text" class="form-control q-opts" placeholder="مثال: ورقة, ساق, جذر"></div>
                <div class="form-group"><label class="form-label">رقم الإجابة الصحيحة (1 للأول، 2 للثاني...)</label><input type="number" class="form-control q-ans" min="1"></div>
            </div>
        `;
        let div = document.createElement('div');
        div.innerHTML = html;
        qList.appendChild(div);
    },
    saveLesson() {
        let courseId = document.getElementById('lCourseId').value;
        let title = document.getElementById('lTitle').value;
        let type = document.getElementById('lType').value;
        let price = parseFloat(document.getElementById('lPrice').value) || 0;
        let reward = type === 'exam' ? (parseFloat(document.getElementById('lReward').value) || 0) : 0;
        
        if(!title) return UI.showToast('يرجى كتابة عنوان الدرس أو الاختبار', 'error');

        let newLesson = { id: 'l' + Date.now(), title, type, price, reward };
        
        if(type === 'exam') {
            let questions = [];
            let qBlocks = document.querySelectorAll('#qList .card');
            for(let b of qBlocks) {
                let text = b.querySelector('.q-text').value;
                let opts = b.querySelector('.q-opts').value.split(',').map(x=>x.trim()).filter(x=>x);
                let ans = parseInt(b.querySelector('.q-ans').value) - 1; 
                if(text && opts.length > 1) {
                    questions.push({ q: text, options: opts, answer: ans });
                }
            }
            if(questions.length === 0) return UI.showToast('الرجاء إضافة سؤال واحد صحيح على الأقل', 'error');
            newLesson.questions = questions;
        } else {
            let val = document.getElementById('lContent').value;
            if(!val) return UI.showToast('يجب إدخال الرابط', 'error');
            newLesson.content = val;
        }

        let courses = Database.get(DB_KEYS.COURSES);
        let cIdx = courses.findIndex(c => c.id === courseId);
        courses[cIdx].lessons.push(newLesson);
        Database.set(DB_KEYS.COURSES, courses);
        
        UI.showToast('تم إضافة المحتوى بنجاح');
        this.closeModal();
        app.route();
    },
    deleteLesson(courseId, lessonId) {
        if(!confirm('هل أنت متأكد من حذف هذا الدرس / الاختبار؟')) return;
        let courses = Database.get(DB_KEYS.COURSES);
        let cIdx = courses.findIndex(c => c.id === courseId);
        courses[cIdx].lessons = courses[cIdx].lessons.filter(l => l.id !== lessonId);
        Database.set(DB_KEYS.COURSES, courses);
        app.route();
    }
};

Views.admin = () => {
    let courses = Database.get(DB_KEYS.COURSES);
    let users = Database.get(DB_KEYS.USERS).filter(u => u.role === 'student');
    let codes = Database.get(DB_KEYS.CODES);
    let requests = Database.get(DB_KEYS.PAYMENTS);

    window.adminTab = window.adminTab || 'stats';

    let renderTabs = () => `
        <div class="tabs mb-8" style="flex-wrap:wrap; gap:0.5rem; overflow-x:auto;">
            <button class="tab-btn ${window.adminTab === 'stats' ? 'active' : ''}" onclick="window.adminTab='stats'; app.route()">الإحصائيات</button>
            <button class="tab-btn ${window.adminTab === 'users' ? 'active' : ''}" onclick="window.adminTab='users'; app.route()">المستخدمين</button>
            <button class="tab-btn ${window.adminTab === 'courses' ? 'active' : ''}" onclick="window.adminTab='courses'; app.route()">الدورات والدروس</button>
            <button class="tab-btn ${window.adminTab === 'books' ? 'active' : ''}" onclick="window.adminTab='books'; app.route()">المكتبة (المذكرات)</button>
            <button class="tab-btn ${window.adminTab === 'codes' ? 'active' : ''}" onclick="window.adminTab='codes'; app.route()">أكواد الشحن</button>
            <button class="tab-btn ${window.adminTab === 'requests' ? 'active' : ''}" onclick="window.adminTab='requests'; app.route()">طلبات الشحن <span style="background:var(--clr-danger);color:white;padding:2px 8px;border-radius:10px;font-size:0.8rem;margin-right:4px;">${requests.filter(r=>r.status==='pending').length}</span></button>
            <button class="tab-btn ${window.adminTab === 'settings' ? 'active' : ''}" onclick="window.adminTab='settings'; app.route()">إعدادات الدفع</button>
        </div>
    `;

    let html = `
        <div class="container mt-8 mb-8">
            <h1 class="mb-6"><i class="fa-solid fa-shield-halved text-accent"></i> لوحة تحكم الإدارة</h1>
            ${renderTabs()}
            
            <div id="admin-content">
                ${window.adminTab === 'stats' ? `
                    <div class="grid grid-3 gap-6 mb-8">
                        <div class="stat-card">
                            <div class="stat-icon"><i class="fa-solid fa-users"></i></div>
                            <div class="stat-info"><h4>عدد الطلاب الحقيقي</h4><p>${users.length}</p></div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon"><i class="fa-solid fa-book-open"></i></div>
                            <div class="stat-info"><h4>الدورات</h4><p>${courses.length}</p></div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon"><i class="fa-solid fa-qrcode"></i></div>
                            <div class="stat-info"><h4>الأكواد المستعملة</h4><p>${codes.filter(c=>c.usedBy).length}</p></div>
                        </div>
                    </div>
                ` : ''}

                ${window.adminTab === 'users' ? `
                    <div class="card p-6 mb-8">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="mb-0">إدارة المستخدمين (طلاب وأولياء أمور)</h3>
                        </div>
                    </div>
                    <div class="table-container">
                        <table>
                            <tr>
                                <th>الاسم / البريد</th>
                                <th>الدور</th>
                                <th>الحالة</th>
                                <th>إجراءات</th>
                            </tr>
                            ${Database.get(DB_KEYS.USERS).filter(u => u.role !== 'admin').map(u => `
                                <tr>
                                    <td>
                                        <div class="font-bold">${u.name || 'بدون اسم'}</div>
                                        <div class="text-sm text-muted" style="margin:2px 0;">${u.email}</div>
                                        <div class="text-sm text-accent"><i class="fa-solid fa-phone"></i> ${u.phone || 'غير مسجل'}</div>
                                    </td>
                                    <td>
                                        <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; background: ${u.role === 'student' ? 'var(--clr-primary)' : 'var(--clr-secondary)'}; color: white;">
                                            ${u.role === 'student' ? 'طالب' : 'ولي أمر'}
                                        </span>
                                        ${u.role === 'student' && u.grade ? `
                                            <span style="display:inline-block; margin-top:5px; padding:2px 6px; border-radius:4px; font-size:0.75rem; background:var(--clr-surface-light); color:var(--clr-text-muted);">
                                                ${u.grade === 'all' ? 'عام (للكل)' : u.grade}
                                            </span>
                                        ` : ''}
                                    </td>
                                    <td>${u.suspended ? '<span class="text-danger font-bold"><i class="fa-solid fa-ban"></i> معلق</span>' : '<span class="text-success font-bold"><i class="fa-solid fa-check-circle"></i> نشط</span>'}</td>
                                    <td>
                                        <div class="flex gap-2">
                                            <button class="btn ${u.suspended ? 'btn-success' : 'btn-warning'}" style="padding:0.3rem 0.6rem; border-radius:5px;" onclick="window.toggleUserSuspension('${u.email}')"><i class="fa-solid ${u.suspended ? 'fa-play' : 'fa-pause'}"></i> ${u.suspended ? 'تفعيل' : 'تعليق'}</button>
                                            <button class="btn btn-danger" style="padding:0.3rem 0.6rem; border-radius:5px;" onclick="window.deleteUser('${u.email}')"><i class="fa-solid fa-trash"></i> حذف</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </table>
                    </div>
                ` : ''}

                ${window.adminTab === 'codes' ? `
                    <div class="card p-6 mb-8">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="mb-0">إدارة وتوليد أكواد الشحن</h3>
                            <div class="flex gap-3">
                                <button class="btn btn-secondary" onclick="window.printSelectedCodes()"><i class="fa-solid fa-print"></i> طباعة المحددة</button>
                                <button class="btn btn-danger" onclick="window.deleteSelectedCodes()"><i class="fa-solid fa-trash"></i> حذف المحددة</button>
                            </div>
                        </div>
                        <div class="flex gap-4">
                            <input type="number" id="genValue" class="form-control" style="width:200px;" placeholder="قيمة الكود (ج.م)">
                            <input type="number" id="genCount" class="form-control" style="width:100px;" value="10" title="العدد">
                            <button class="btn btn-primary" onclick="window.generateCodes()"><i class="fa-solid fa-plus"></i> إنشاء</button>
                        </div>
                    </div>
                    
                    <div class="table-container">
                        <table>
                            <tr>
                                <th style="width:50px;text-align:center;"><input type="checkbox" onchange="window.toggleAllCodes(this)"></th>
                                <th>الكود</th>
                                <th>قيمة الشحن</th>
                                <th>الحالة</th>
                                <th>حذف</th>
                            </tr>
                            ${codes.reverse().map(c => `
                                <tr>
                                    <td style="text-align:center;"><input type="checkbox" class="code-cb" value="${c.code}" data-value="${c.value || 0}"></td>
                                    <td class="font-bold">${c.code}</td>
                                    <td><span class="text-accent font-bold">${c.value || 0} ج.م</span></td>
                                    <td>${c.usedBy ? `<span class="text-danger">مستخدم بواسطة ${c.usedBy}</span>` : '<span class="text-success">متاح</span>'}</td>
                                    <td><button class="btn btn-danger" style="padding:0.3rem 0.6rem; border-radius:5px;" onclick="window.deleteCode('${c.code}')"><i class="fa-solid fa-trash"></i></button></td>
                                </tr>
                            `).join('')}
                        </table>
                    </div>
                ` : ''}

                ${window.adminTab === 'books' ? `
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="mb-0">إدارة الكتب والمذكرات</h3>
                        <button class="btn btn-primary" onclick="AdminActions.addBook()"><i class="fa-solid fa-plus"></i> إضافة كتاب/مذكرة جديدة</button>
                    </div>
                    <div class="grid grid-3 gap-6">
                    ${Database.get(DB_KEYS.BOOKS).map(b => `
                        <div class="card p-4">
                            ${b.image ? `
                                <div style="height: 180px; background:var(--clr-bg); display:flex; align-items:center; justify-content:center; margin:-1rem -1rem 1rem -1rem; border-radius:5px 5px 0 0; padding:10px;">
                                    <img src="${b.image}" style="max-height:100%; max-width:100%; object-fit:contain; box-shadow:0 4px 10px rgba(0,0,0,0.5);">
                                </div>
                            ` : `
                                <div style="height: 180px; background:var(--clr-surface-light); display:flex; align-items:center; justify-content:center; margin:-1rem -1rem 1rem -1rem; border-radius:5px 5px 0 0;">
                                    <i class="fa-solid fa-file-pdf text-muted" style="font-size:3rem;"></i>
                                </div>
                            `}
                            <h4 class="mb-2"><i class="fa-solid fa-book text-accent"></i> ${b.title}</h4>
                            <div style="display:flex; gap:5px; margin-bottom:10px;">
                                <span class="badge" style="background:var(--clr-primary); color:white; padding:4px 8px; border-radius:4px; font-size:0.85rem;">
                                    ${b.grade && b.grade !== 'all' ? b.grade : 'عام (للكل)'}
                                </span>
                                <span class="badge" style="background:var(--clr-secondary); color:white; padding:4px 8px; border-radius:4px; font-size:0.85rem;">
                                    ${!b.term || b.term === 'full' ? 'عام كامل' : b.term === '1' ? 'الفصل الأول' : 'الفصل الثاني'}
                                </span>
                            </div>
                            <p class="text-muted mb-4 text-sm" style="flex:1;">${b.desc || 'لا يوجد وصف'}</p>
                            <p class="font-bold mb-4 bg-surface p-2 text-center" style="border-radius:5px;">السعر المدخل: <span class="text-accent">${b.price} ج.م</span></p>
                            <div class="flex gap-2 mt-auto">
                                <a href="${b.link}" target="_blank" class="btn btn-outline flex-1 text-center" style="padding:0.4rem;font-size:0.9rem;"><i class="fa-solid fa-eye"></i> عرض</a>
                                <button class="btn btn-danger flex-1" style="padding:0.4rem;font-size:0.9rem;" onclick="AdminActions.deleteBook('${b.id}')"><i class="fa-solid fa-trash"></i> حذف</button>
                            </div>
                        </div>
                    `).join('')}
                    </div>
                ` : ''}

                ${window.adminTab === 'courses' ? `
                    <button class="btn btn-primary mb-6" onclick="AdminActions.addCourse()"><i class="fa-solid fa-plus"></i> إضافة دورة جديدة</button>
                    ${courses.map(c => `
                        <div class="card p-6 mb-4">
                            <div class="flex justify-between items-start mb-4">
                                <div>
                                    <h3 class="mb-2">${c.title}</h3>
                                    <div style="display:flex; gap:5px;">
                                        <span class="badge" style="background:var(--clr-primary); color:white; padding:4px 8px; border-radius:4px; font-size:0.85rem;">
                                            ${c.grade === 'all' ? 'عام (للكل)' : c.grade}
                                        </span>
                                        <span class="badge" style="background:var(--clr-secondary); color:white; padding:4px 8px; border-radius:4px; font-size:0.85rem;">
                                            ${c.term === '1' ? 'الفصل الأول' : c.term === '2' ? 'الفصل الثاني' : 'عام كامل'}
                                        </span>
                                    </div>
                                </div>
                                <div class="flex gap-4 mt-2">
                                    <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="AdminActions.editCourse('${c.id}')"><i class="fa-solid fa-pen"></i> تعديل</button>
                                    <button class="btn btn-danger" style="padding: 0.5rem 1rem;" onclick="AdminActions.deleteCourse('${c.id}')"><i class="fa-solid fa-trash"></i> حذف</button>
                                </div>
                            </div>
                            <div style="background:var(--clr-bg); padding:1rem; border-radius:var(--radius-md);">
                                <h4 class="mb-4">المحتوى التعليمي (الدروس والاختبارات):</h4>
                                <ul style="list-style:none; padding: 0;">
                                    ${c.lessons.map(l => `
                                        <li class="flex justify-between items-center p-3 mb-2" style="background:var(--clr-surface); border:1px solid var(--clr-border); border-radius:var(--radius-md);">
                                            <span>
                                                <i class="fa-solid ${l.type==='video'?'fa-video':l.type==='pdf'?'fa-file-pdf':'fa-list-check'} text-accent"></i> 
                                                ${l.title} <span class="text-muted text-sm" style="font-size:0.85rem">(${l.type})</span>
                                            </span>
                                            <button class="btn btn-danger" style="padding:0.4rem 0.8rem;" onclick="AdminActions.deleteLesson('${c.id}', '${l.id}')" title="حذف المحتوى"><i class="fa-solid fa-times"></i></button>
                                        </li>
                                    `).join('')}
                                </ul>
                                <button class="btn btn-secondary mt-4" onclick="AdminActions.addLesson('${c.id}')"><i class="fa-solid fa-plus"></i> إضافة درس أو اختبار جديد</button>
                            </div>
                        </div>
                    `).join('')}
                ` : ''}

                ${window.adminTab === 'requests' ? `
                    <div class="card p-6 mb-8">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="mb-0">طلبات شحن الرصيد</h3>
                            <button class="btn btn-danger" onclick="window.deleteSelectedRequests()"><i class="fa-solid fa-trash"></i> حذف المحددة</button>
                        </div>
                    </div>
                    <div class="table-container">
                        <table>
                            <tr>
                                <th style="width:50px;text-align:center;"><input type="checkbox" onchange="window.toggleAllRequests(this)"></th>
                                <th>طالب الشحن (الإيميل)</th>
                                <th>مبلغ الشحن المطلوب</th>
                                <th>تاريخ الطلب</th>
                                <th>صورة الإيصال</th>
                                <th>القرار</th>
                            </tr>
                            ${Database.get(DB_KEYS.PAYMENTS).reverse().map(r => `
                                <tr>
                                    <td style="text-align:center;"><input type="checkbox" class="req-cb" value="${r.id}"></td>
                                    <td>${r.email}</td>
                                    <td><span class="text-accent font-bold">${r.amount} ج.م</span></td>
                                    <td>${new Date(r.date).toLocaleDateString('ar-EG', {month:'short', day:'numeric', year:'numeric'})}</td>
                                    <td><button class="btn btn-outline" style="padding:0.25rem 0.5rem; font-size:0.8rem;" onclick="AdminActions.viewImage('${r.receipt}')"><i class="fa-solid fa-eye"></i> عرض</button></td>
                                    <td>
                                        ${r.status === 'pending' ? `
                                            <div class="flex gap-2">
                                                <button class="btn btn-success" style="padding:0.25rem 0.6rem; background:var(--clr-success); color:white; border:none;" onclick="AdminActions.decideReq('${r.id}', 'approve')"><i class="fa-solid fa-check"></i> شحن الرصيد</button>
                                                <button class="btn btn-danger" style="padding:0.25rem 0.6rem;" onclick="AdminActions.decideReq('${r.id}', 'reject')"><i class="fa-solid fa-times"></i> رفض</button>
                                            </div>
                                        ` : `
                                            <span class="${r.status === 'approved' ? 'text-success' : 'text-danger'} font-bold">
                                                ${r.status === 'approved' ? 'تم الشحن' : 'تم الرفض'}
                                            </span>
                                        `}
                                    </td>
                                </tr>
                            `).join('')}
                        </table>
                    </div>
                ` : ''}

                ${window.adminTab === 'settings' ? `
                    <div class="grid grid-2 gap-6">
                        <div class="card p-6" style="max-width:100%;">
                            <h3 class="mb-4">إعدادات المنصة وطرق الدفع</h3>
                            <div class="form-group">
                                <label class="form-label">رقم الهاتف لاستقبال الدفع (المحفظة)</label>
                                <input type="text" id="walletNumInput" class="form-control" value="${Database.get(DB_KEYS.SETTINGS).walletNumber || ''}" placeholder="01000000000">
                            </div>
                            <div class="form-group">
                                <label class="form-label">رقم الواتساب للتواصل (بدون +)</label>
                                <input type="text" id="waInput" class="form-control" value="${Database.get(DB_KEYS.SETTINGS).whatsappNum || ''}" placeholder="201000000000">
                            </div>
                            <div class="form-group">
                                <label class="form-label">رابط أو معرف التليجرام</label>
                                <input type="text" id="tgInput" class="form-control" value="${Database.get(DB_KEYS.SETTINGS).telegramLink || ''}" placeholder="menasah">
                            </div>
                            <div class="form-group">
                                <label class="form-label">رابط صفحة الفيسبوك</label>
                                <input type="text" id="fbInput" class="form-control" value="${Database.get(DB_KEYS.SETTINGS).facebookLink || ''}" placeholder="facebook.com/menasah">
                            </div>
                            <button class="btn btn-primary w-100" style="width:100%" onclick="AdminActions.saveSettings()"><i class="fa-solid fa-save"></i> حفظ التغييرات</button>
                        </div>
                        
                        <div class="card p-6" style="max-width:100%;">
                            <h3 class="mb-4">تحديث بيانات الإدارة</h3>
                            <div class="form-group">
                                <label class="form-label">البريد الإلكتروني للآدمن</label>
                                <input type="email" id="adminEmailUpdate" class="form-control" value="${Database.getSession().email}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">كلمة المرور الجديدة</label>
                                <input type="text" id="adminPassUpdate" class="form-control" placeholder="أدخل الكلمة الجديدة">
                            </div>
                            <button class="btn btn-warning w-100" style="width:100%" onclick="window.updateAdminAuth()"><i class="fa-solid fa-user-shield"></i> تحديث بيانات الدخول</button>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    app.root.innerHTML = html;

    window.updateAdminAuth = () => {
        let e = document.getElementById('adminEmailUpdate').value;
        let p = document.getElementById('adminPassUpdate').value;
        if(!e || !p) return UI.showToast('يرجى ملء جميع الحقول', 'error');
        
        let users = Database.get(DB_KEYS.USERS);
        let idx = users.findIndex(u => u.role === 'admin');
        if(idx > -1) {
            users[idx].email = e;
            users[idx].password = p;
            Database.set(DB_KEYS.USERS, users);
            Database.updateSession(users[idx]);
            UI.showToast('تم تحديث بيانات الدخول بنجاح! سيتم تطبيقها في المرة القادمة.');
        }
    };

    window.generateCodes = () => {
        let val = parseFloat(document.getElementById('genValue').value);
        if(!val || val <= 0) return UI.showToast('يرجى تحديد قيمة صالحة للكود', 'error');
        let count = parseInt(document.getElementById('genCount').value);
        let curr = Database.get(DB_KEYS.CODES);
        for(let i=0; i<count; i++) {
            curr.push({
                code: 'MR_' + Math.random().toString(36).substr(2, 8).toUpperCase(),
                value: val,
                usedBy: null
            });
        }
        Database.set(DB_KEYS.CODES, curr);
        UI.showToast(`تم إضافة ${count} كود شحن بنجاح`);
        app.route(); // refresh
    };
    
    window.toggleAllCodes = (el) => {
        document.querySelectorAll('.code-cb').forEach(cb => cb.checked = el.checked);
    };
    
    window.deleteSelectedCodes = () => {
        let selected = Array.from(document.querySelectorAll('.code-cb:checked')).map(cb => cb.value);
        if(selected.length === 0) return UI.showToast('لم تقم بتحديد أي كود', 'error');
        if(!confirm(`هل أنت متأكد من حذف ${selected.length} كود؟`)) return;
        let dbCodes = Database.get(DB_KEYS.CODES).filter(c => !selected.includes(c.code));
        Database.set(DB_KEYS.CODES, dbCodes);
        UI.showToast(`تم حذف ${selected.length} كود بنجاح`);
        app.route();
    };

    window.printSelectedCodes = () => {
        let allCodes = Database.get(DB_KEYS.CODES);
        let selected = Array.from(document.querySelectorAll('.code-cb:checked'))
            .map(cb => ({
                code: cb.value,
                value: cb.getAttribute('data-value')
            }))
            .filter(sel => {
                let dbCode = allCodes.find(c => c.code === sel.code);
                return dbCode && !dbCode.usedBy;
            });
        
        if(selected.length === 0) return UI.showToast('لم تقم بتحديد أي كود صالح (غير مستخدم) للطباعة', 'error');
        
        let printWindow = window.open('', '_blank');
        
        let html = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>طباعة أكواد الشحن</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Cairo', sans-serif; padding: 40px; background: #f8fafc; color: #1e293b; margin: 0; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
                .header h1 { margin: 0; color: #0f172a; font-size: 28px; }
                .header p { margin: 8px 0 0; color: #64748b; font-size: 16px; }
                .codes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
                .code-card { 
                    background: white; border: 2px dashed #cbd5e1; border-radius: 12px; 
                    padding: 20px; text-align: center; page-break-inside: avoid;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.05); position: relative; overflow: hidden;
                }
                .code-card::before {
                    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
                    background: linear-gradient(90deg, #f97316, #fcd34d);
                }
                .code-val { font-size: 22px; font-weight: 900; color: #f97316; margin-bottom: 10px; }
                .code-str { font-size: 18px; font-weight: bold; background: #f1f5f9; padding: 8px; border-radius: 6px; letter-spacing: 2px;}
                .platform-name { font-size: 12px; color: #94a3b8; margin-top: 10px; font-weight: 600; }
                
                @media print {
                    body { background: white; padding: 0; }
                    .header { margin-bottom: 20px; }
                    .code-card { border-color: #000; box-shadow: none; border-style: solid; border-width: 1px; }
                    .code-card::before { display: none; }
                    .code-val { color: #000; }
                    .code-str { background: transparent; border: 1px solid #ccc; }
                    button { display: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>أكواد الشحن - منصة محمد عبدالسلام</h1>
                <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
                <div style="text-align:center; margin-top:20px;">
                    <button onclick="window.print()" style="padding:12px 25px; background:#f97316; color:white; border:none; border-radius:8px; cursor:pointer; font-family:'Cairo'; font-weight:bold; font-size:16px; box-shadow:0 4px 10px rgba(249,115,22,0.3);">طباعة الأكواد الآن</button>
                </div>
            </div>
            
            <div class="codes-grid">
                ${selected.map(c => `
                    <div class="code-card">
                        <div class="code-val">${c.value} ج.م</div>
                        <div class="code-str">${c.code}</div>
                        <div class="platform-name">منصة محمد عبدالسلام</div>
                    </div>
                `).join('')}
            </div>
        </body>
        </html>
        `;
        
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
    };
    
    window.deleteCode = (code) => {
        if(!confirm(`هل أنت متأكد من حذف الكود ${code}؟`)) return;
        let dbCodes = Database.get(DB_KEYS.CODES).filter(c => c.code !== code);
        Database.set(DB_KEYS.CODES, dbCodes);
        UI.showToast(`تم حذف الكود بنجاح`);
        app.route();
    };

    window.toggleUserSuspension = (email) => {
        let users = Database.get(DB_KEYS.USERS);
        let user = users.find(u => u.email === email);
        if(user) {
            user.suspended = !user.suspended;
            Database.set(DB_KEYS.USERS, users);
            UI.showToast(user.suspended ? 'تم تعليق الحساب بنجاح' : 'تم تفعيل الحساب بنجاح');
            app.route();
        }
    };

    window.deleteUser = (email) => {
        if(!confirm(`هل أنت متأكد من الحذف النهائي لحساب: ${email}؟`)) return;
        let users = Database.get(DB_KEYS.USERS).filter(u => u.email !== email);
        Database.set(DB_KEYS.USERS, users);
        UI.showToast('تم حذف الحساب نهائياً');
        app.route();
    };

    window.toggleAllRequests = (el) => {
        document.querySelectorAll('.req-cb').forEach(cb => cb.checked = el.checked);
    };

    window.deleteSelectedRequests = () => {
        let selected = Array.from(document.querySelectorAll('.req-cb:checked')).map(cb => cb.value);
        if(selected.length === 0) return UI.showToast('لم تقم بتحديد أي طلب لحذفه', 'error');
        if(!confirm(`هل أنت متأكد من حذف ${selected.length} طلب؟`)) return;
        
        let requests = Database.get(DB_KEYS.PAYMENTS).filter(r => !selected.includes(r.id));
        Database.set(DB_KEYS.PAYMENTS, requests);
        UI.showToast(`تم حذف ${selected.length} طلب بنجاح`);
        app.route();
    };

};

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
    app.init();
});
