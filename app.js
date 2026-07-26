/**
 * IMS - Internship Management System
 * Core logic implementing State, Observer, Abstract Approval, and Encapsulation patterns.
 */

// ==========================================
// 1. OBSERVER PATTERN
// ==========================================
// Identifiable as: Subject-Observer mechanism to trigger real-time UI/Logic updates.
class Subject {
    constructor() {
        this.observers = [];
    }
    subscribe(fn) { this.observers.push(fn); }
    unsubscribe(fn) { this.observers = this.observers.filter(o => o !== fn); }
    notify(data) { this.observers.forEach(o => o(data)); }
}

const GlobalNotifier = new Subject();

// ==========================================
// EMAIL SERVICE (EmailJS Integration)
// ==========================================
const EmailService = {
    async send(toEmail, subject, body) {
        if (typeof emailjs === 'undefined') {
            console.warn('EmailJS SDK not loaded');
            return;
        }
        try {
            await emailjs.send('service_k45xfaa', 'template_3xzlthn', {
                to_email: toEmail,
                subject: subject,
                message: body
            });
            console.log(`Email sent to ${toEmail}`);
        } catch (error) {
            console.error('Email sending failed:', error);
        }
    },
    async sendToRole(role, subject, body) {
        let emails = [];
        if (supabase) {
            try {
                const { data } = await supabase.from('users').select('email').eq('role', role);
                if (data) {
                    emails = data.map(u => u.email);
                }
            } catch (e) {
                console.error("Failed to fetch users for email:", e);
            }
        }
        
        // LocalStorage Fallback (if Supabase fails or user is testing offline)
        if (emails.length === 0) {
            const storedUsers = JSON.parse(localStorage.getItem('ims_users') || '[]');
            emails = storedUsers.filter(u => u.role === role).map(u => u.email);
        }

        if (emails.length === 0) {
            console.warn(`EmailService: Attempted to notify role '${role}', but NO users exist with this role in the database.`);
            return;
        }

        console.log(`EmailService: Found ${emails.length} user(s) for role '${role}'. Dispatching emails...`);
        for (const email of emails) {
            await this.send(email, subject, body);
        }
    }
};

// ==========================================
// SUPABASE INTEGRATION
// ==========================================
const SUPABASE_URL = "https://lnutvukrbalberwyctau.supabase.co";
const SUPABASE_KEY = "sb_publishable_vzaTQNQ96x0AO_KkOMGACg_EMOL6JVN";
const supabase = (typeof window !== 'undefined' && window.supabase) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

/**
 * Fetches role and name from Supabase 'users' table or LocalStorage fallback.
 */
async function fetchUserFromDB(email) {
    console.log(`FETCHING USER: ${email}`);

    let userProfile = null;

    // 1. Try Supabase
    if (supabase && SUPABASE_URL) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('role, name')
                .eq('email', email)
                .single();

            if (data) userProfile = data;
            if (error) console.error("Supabase Error:", error);
        } catch (e) {
            console.error("Supabase Exception:", e);
        }
    }

    // 2. Try LocalStorage (Persistence for Signups)
    if (!userProfile) {
        const storedUsers = JSON.parse(localStorage.getItem('ims_users') || '[]');
        userProfile = storedUsers.find(u => u.email === email);
    }

    // 3. Fallback to Hardcoded Mock DB
    if (!userProfile) {
        const mockDB = {
            'student@univ.edu': { name: 'Alex Rivet', role: 'student' },
            'company@nvidia.com': { name: 'NVIDIA Corp', role: 'company' },
            'faculty@univ.edu': { name: 'Dr. Smith', role: 'mentor' },
            'hod@univ.edu': { name: 'Dr. Johnson', role: 'hod' },
            'tpo@univ.edu': { name: 'Prof. Miller', role: 'tpo' },
            'staff@univ.edu': { name: 'Sarah Wilson', role: 'coordinator' }
        };
        userProfile = mockDB[email];
    }

    // Default if still not found
    if (!userProfile) {
        userProfile = { name: email.split('@')[0], role: 'student' };
    }

    // Role mapping normalization
    if (userProfile.role && userProfile.role.toLowerCase() === 'faculty') {
        userProfile.role = 'mentor';
    } else if (userProfile.role && userProfile.role.toLowerCase() === 'staff') {
        userProfile.role = 'coordinator';
    }

    return userProfile;
}

// ==========================================
// 2. STATE PATTERN
// ==========================================
// Identifiable as: Managing object behavior based on internal status transitions.
const States = {
    COMPANY: { PENDING: 'Pending', VERIFIED: 'Verified', REJECTED: 'Rejected' },
    OD: {
        PENDING_MENTOR: 'Pending Mentor',
        PENDING_HOD: 'Pending HOD',
        PENDING_TPO: 'Pending TPO',
        GRANTED: 'OD Granted',
        REJECTED: 'Rejected'
    }
};

class WorkflowState {
    constructor(initial) { this.current = initial; this.history = []; }
    transition(newState, actor, comment = '') {
        this.current = newState;
        const entry = { status: newState, actor, comment, timestamp: new Date().toLocaleString() };
        this.history.push(entry);
        return entry;
    }
}

// ==========================================
// 3. ABSTRACT APPROVAL & POLYMORPHISM
// ==========================================
// Identifiable as: Uniform interface (Approver) with role-specific implementations.
class BaseApprover {
    constructor(role, next = null) {
        this.role = role;
        this.next = next;
    }
    // Abstract polymorphic method
    handle(application, action, comment) {
        if (action === 'REJECT') {
            application.state.transition(States.OD.REJECTED, this.role, comment);
            return { status: States.OD.REJECTED, terminal: true };
        }
        return this.approve(application, comment);
    }
    approve(application, comment) { throw new Error("Method 'approve()' must be implemented."); }
}

class MentorApprover extends BaseApprover {
    approve(app, cmd) {
        app.state.transition(States.OD.PENDING_HOD, this.role, cmd);
        return { status: States.OD.PENDING_HOD, terminal: false };
    }
}

class HODApprover extends BaseApprover {
    approve(app, cmd) {
        app.state.transition(States.OD.PENDING_TPO, this.role, cmd);
        return { status: States.OD.PENDING_TPO, terminal: false };
    }
}

class TPOApprover extends BaseApprover {
    approve(app, cmd) {
        app.state.transition(States.OD.GRANTED, this.role, cmd);
        return { status: States.OD.GRANTED, terminal: true };
    }
}

// Chain of Responsibility Setup
const tpoHandler = new TPOApprover('TPO');
const hodHandler = new HODApprover('HOD', tpoHandler);
const mentorHandler = new MentorApprover('Mentor', hodHandler);

const ApproverMap = { 'mentor': mentorHandler, 'hod': hodHandler, 'tpo': tpoHandler };

// ==========================================
// 4. DATA ENCAPSULATION
// ==========================================
// Identifiable as: Private state with controlled access methods (I.I.F.E).
const Store = (() => {
    let _user = null;
    let _notifs = [];
    let _companies = [
        { id: 'C01', name: 'NVIDIA', email: 'careers@nvidia.com', state: new WorkflowState(States.COMPANY.VERIFIED), doc: 'NVIDIA_PROFILE.pdf' }
    ];
    let _internships = [
        { id: 'INT-01', company: 'NVIDIA', title: 'Deep Learning Intern', location: 'Remote', stipend: '$2000/mo', type: 'Full-time', description: 'Working on CUDA kernel optimizations.', applyLink: 'https://nvidia.com/careers' }
    ];
    let _applications = [
        { id: 'OD-100', student: 'STU-001', studentName: 'Alex Rivet', company: 'NVIDIA', duration: '3 Months', state: new WorkflowState(States.OD.PENDING_MENTOR), doc: 'INTERN_OFFER.pdf' }
    ];

    const _saveToDB = async (table, data) => {
        if (!supabase) return;
        // Transform for DB if needed
        let dbData = Array.isArray(data) ? data : [data];

        // Custom transformation for Workflow objects
        if (table === 'companies') {
            dbData = dbData.map(c => ({
                id: c.id,
                name: c.name,
                email: c.email || '',
                state_current: c.state.current,
                state_history: c.state.history,
                doc_url: c.doc || '',
                submitted_by_role: c.submittedByRole || 'student',
                website: c.website || '',
                linkedin: c.linkedin || '',
                submitted_by: c.submittedBy || null
            }));
        } else if (table === 'applications') {
            dbData = dbData.map(a => ({
                id: a.id,
                student_id: a.student,
                student_name: a.studentName,
                company_name: a.company,
                duration: a.duration,
                state_current: a.state.current,
                state_history: a.state.history,
                doc_name: a.doc || '',
                doc_data: a.docData || ''
            }));
        } else if (table === 'notifications') {
            dbData = dbData.map(n => ({
                msg: n.msg,
                type: n.type,
                target_role: n.role
            }));
        } else if (table === 'internships') {
            dbData = dbData.map(i => ({
                id: i.id,
                company_name: i.company,
                title: i.title,
                location: i.location || '',
                stipend: i.stipend || '',
                job_type: i.type || '',
                description: i.description || '',
                apply_link: i.applyLink || ''
            }));
        }

        const { error } = await supabase.from(table).upsert(dbData, { onConflict: 'id' });
        if (error) console.error(`DB Sync Error [${table}]:`, error);
    };

    const _loadFromDB = async () => {
        let dbFailed = !supabase;

        if (supabase) {
            try {
                // 1. Companies
                const { data: compData, error: compErr } = await supabase.from('companies').select('*');
                if (compErr) throw compErr;
                if (compData && compData.length > 0) {
                    _companies = compData.map(c => {
                        const ws = new WorkflowState(c.state_current);
                        ws.history = c.state_history || [];
                        return {
                            id: c.id, name: c.name, email: c.email,
                            state: ws, doc: c.doc_url, submittedByRole: c.submitted_by_role,
                            website: c.website || '', linkedin: c.linkedin || '', submittedBy: c.submitted_by || null
                        };
                    });
                }

                // 2. Internships
                const { data: intData, error: intErr } = await supabase.from('internships').select('*');
                if (intErr) throw intErr;
                if (intData && intData.length > 0) {
                    _internships = intData.map(i => ({
                        id: i.id, company: i.company_name, title: i.title,
                        location: i.location, stipend: i.stipend, type: i.job_type,
                        description: i.description, applyLink: i.apply_link
                    }));
                }

                // 3. Applications
                const { data: appData, error: appErr } = await supabase.from('applications').select('*');
                if (appErr) throw appErr;
                if (appData && appData.length > 0) {
                    _applications = appData.map(a => {
                        const ws = new WorkflowState(a.state_current);
                        ws.history = a.state_history || [];
                        return {
                            id: a.id, student: a.student_id, studentName: a.student_name,
                            company: a.company_name, duration: a.duration,
                            state: ws, doc: a.doc_name, docData: a.doc_data
                        };
                    });
                }

                // 4. Notifications
                const { data: notData, error: notErr } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
                if (notErr) throw notErr;
                if (notData && notData.length > 0) {
                    _notifs = notData.map(n => ({
                        msg: n.msg, type: n.type, role: n.target_role, time: new Date(n.created_at).toLocaleTimeString()
                    }));
                }
            } catch (error) {
                console.error("Supabase load failed, falling back to local storage:", error);
                dbFailed = true;
            }
        }

        // If DB failed or didn't fetch our expected demo items, let's check local storage
        if (dbFailed || _companies.length <= 1) {
            const localComps = JSON.parse(localStorage.getItem('ims_companies') || '[]');
            if (localComps.length > 0) {
                _companies = localComps.map(c => {
                    const ws = new WorkflowState(c.state.current);
                    ws.history = c.state.history || [];
                    return { ...c, state: ws };
                });
            }

            const localApps = JSON.parse(localStorage.getItem('ims_applications') || '[]');
            if (localApps.length > 0) {
                _applications = localApps.map(a => {
                    const ws = new WorkflowState(a.state.current);
                    ws.history = a.state.history || [];
                    return { ...a, state: ws };
                });
            }

            const localInterns = JSON.parse(localStorage.getItem('ims_internships') || '[]');
            if (localInterns.length > 0) _internships = localInterns;

            const localNotifs = JSON.parse(localStorage.getItem('ims_notifs') || '[]');
            if (localNotifs.length > 0) _notifs = localNotifs;
        }
    };

    const _sync = (table) => {
        // Fallback Local Storage
        localStorage.setItem('ims_notifs', JSON.stringify(_notifs));
        localStorage.setItem('ims_companies', JSON.stringify(_companies));
        localStorage.setItem('ims_internships', JSON.stringify(_internships));
        localStorage.setItem('ims_applications', JSON.stringify(_applications));

        // Primary DB Sync
        if (table) {
            const dataMap = {
                'notifications': _notifs,
                'companies': _companies,
                'internships': _internships,
                'applications': _applications
            };
            _saveToDB(table, dataMap[table]);
        }
    };

    return {
        init: async (onReady) => {
            await _loadFromDB();
            // User requested to avoid default login directly into the website
            localStorage.removeItem('ims_user_email');
            _user = null;
            onReady(null);
        },
        sync: (table) => _sync(table),
        save: (table) => _sync(table),
        getUser: () => _user,
        setUser: (u) => {
            _user = u;
            if (u) localStorage.setItem('ims_user_email', u.email);
            else localStorage.removeItem('ims_user_email');
        },
        getCompanies: () => _companies,
        getApplications: () => _applications,
        getInternships: () => _internships,
        deleteInternship: async (id) => {
            _internships = _internships.filter(i => i.id !== id);
            if (supabase) await supabase.from('internships').delete().eq('id', id);
            Store.addNotif(`Internship posting ${id} was removed by Coordinator`, 'info', 'company');
            _sync('internships');
        },
        addNotif: (msg, type = 'info', role = 'student') => {
            // Avoid repetition: check if the last notification for this role is already the same message
            const lastNotif = _notifs.find(n => n.role === role);
            if (lastNotif && lastNotif.msg === msg) {
                console.warn('Duplicate notification blocked:', msg);
                return;
            }

            const n = { msg, type, role, time: new Date().toLocaleTimeString(), id: Math.random() };
            _notifs.unshift(n);
            _sync('notifications');
            GlobalNotifier.notify(n);

            // ---------------------------------------------
            // EMAIL INTEGRATION (Triggered by notifications)
            // ---------------------------------------------
            const staffRoles = ['mentor', 'hod', 'tpo', 'coordinator'];
            
            // Condition 1: OD applied/moved -> Notify respective staff
            if (staffRoles.includes(role) && (msg.includes('New OD request') || msg.includes('OD review needed'))) {
                EmailService.sendToRole(role, 'IMS OD Notification', msg);
            }
            
            // Condition 2: Company added/verified -> Notify all students
            if (role === 'student' && (msg.includes('was verified by the coordinator') || msg.includes('has been verified!'))) {
                EmailService.sendToRole('student', 'IMS Company Verified', msg);
            }
        },
        getNotifs: (role) => {
            const list = _notifs.filter(n => n.role === role);
            // Filter out consecutive duplicates with the same message
            return list.filter((n, i) => i === 0 || n.msg !== list[i - 1].msg);
        },
        submitOD: (data) => {
            const company = _companies.find(c => c.name.toLowerCase() === data.company.toLowerCase());
            if (!company || company.state.current !== States.COMPANY.VERIFIED) {
                const error = `Cannot apply for OD: ${data.company} is not yet verified by the coordinator.`;
                console.error(error);
                return { error };
            }

            const existing = _applications.find(a => a.student === _user.id && a.company === data.company);
            if (existing) return existing;

            const app = {
                id: `OD-${Date.now().toString().slice(-4)}`,
                student: _user.id,
                studentName: _user.name,
                ...data,
                state: new WorkflowState(States.OD.PENDING_MENTOR)
            };
            _applications.push(app);
            _sync('applications');
            Store.addNotif(`New OD request from ${app.studentName}`, 'info', 'mentor');
            return app;
        },
        submitCompany: (data, actor = 'student') => {
            const isAutoVerified = actor === 'tpo' || actor === 'coordinator';
            const status = isAutoVerified ? States.COMPANY.VERIFIED : States.COMPANY.PENDING;
            const comp = { id: `C-${Date.now().toString().slice(-4)}`, submittedByRole: actor, ...data, state: new WorkflowState(status) };
            _companies.push(comp);
            _sync('companies');
            if (!isAutoVerified) {
                Store.addNotif(`New Company registration: ${comp.name}`, 'info', 'coordinator');
            }
            return comp;
        },
        postInternship: (data) => {
            const companyName = data.company || _user.name;

            // If posted by Coordinator/TPO, ensure company is recognized as verified
            if (_user.role === 'coordinator' || _user.role === 'tpo') {
                const existing = _companies.find(c => c.name.toLowerCase() === companyName.toLowerCase());
                if (!existing) {
                    _companies.push({
                        id: `C-${Date.now().toString().slice(-4)}`,
                        name: companyName,
                        email: `${companyName.toLowerCase().replace(/\s/g, '')}@institutional.verified`,
                        state: new WorkflowState(States.COMPANY.VERIFIED),
                        submittedByRole: _user.role
                    });
                    _sync('companies');
                } else if (existing.state.current !== States.COMPANY.VERIFIED) {
                    existing.state.transition(States.COMPANY.VERIFIED, _user.role, 'Auto-verified via institutional posting');
                    _sync('companies');
                }
            }

            const intern = { id: `INT-${Date.now().toString().slice(-4)}`, company: companyName, ...data, applyLink: data.applyLink || '#' };
            _internships.push(intern);
            _sync('internships');
            Store.addNotif(`New Opportunity: ${data.title} at ${companyName}`, 'info', 'student');
            return intern;
        },
        updateUserProfile: async (newData) => {
            if (!_user) return;
            _user = { ..._user, ...newData };
            
            // Sync to Supabase if exists, else local fallback
            if (supabase) {
                await supabase.from('users').update({ name: _user.name }).eq('email', _user.email);
            }
            
            const storedUsers = JSON.parse(localStorage.getItem('ims_users') || '[]');
            const idx = storedUsers.findIndex(u => u.email === _user.email);
            if (idx !== -1) {
                storedUsers[idx].name = _user.name;
                localStorage.setItem('ims_users', JSON.stringify(storedUsers));
            }
            
            localStorage.setItem('ims_user_email', _user.email);
            GlobalNotifier.notify({ type: 'profile_update' });
        }
    };
})();

// ==========================================
// 5. UI CONTROLLER & VIEW LOGIC
// ==========================================
const UI = {
    init() {
        this.bindGlobalEvents();
        this.createMobileOverlay();
        
        // Theme init
        const savedTheme = localStorage.getItem('ims_theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);

        GlobalNotifier.subscribe((n) => {
            if (n.type === 'profile_update') {
                this.renderDashboard();
                return;
            }
            if (Store.getUser()?.role === n.role) {
                this.toast(n.msg, n.type);
                this.updateNotifBadge();
            }
        });

        // Initialize Store from DB
        Store.init((user) => {
            if (user) {
                this.showScreen('dashboard');
                this.renderDashboard();
            } else {
                this.showScreen('login');
            }
        });
    },

    createMobileOverlay() {
        if (!document.querySelector('.sidebar-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.onclick = () => this.toggleMobileSidebar(false);
            document.body.appendChild(overlay);
        }
    },

    toggleMobileSidebar(force) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        if (!sidebar || !overlay) return;

        const isOpen = force !== undefined ? force : !sidebar.classList.contains('open');
        
        if (isOpen) {
            sidebar.classList.add('open');
            overlay.classList.add('active');
        } else {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        }
    },

    bindGlobalEvents() {
        // Auth Toggle Logic
        const toggleAuth = document.getElementById('toggle-auth');
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const authTitle = document.getElementById('auth-title');
        const authDesc = document.getElementById('auth-desc');

        if (toggleAuth) {
            toggleAuth.onclick = (e) => {
                e.preventDefault();
                if (loginForm.style.display === 'none') {
                    loginForm.style.display = 'block';
                    signupForm.style.display = 'none';
                    toggleAuth.textContent = 'Need an account? Sign up';
                    authTitle.textContent = 'Gateway';
                    authDesc.textContent = 'Enter your credentials to access the portal';
                } else {
                    loginForm.style.display = 'none';
                    signupForm.style.display = 'block';
                    toggleAuth.textContent = 'Already have an account? Sign in';
                    authTitle.textContent = 'Join IMS';
                    authDesc.textContent = 'Create your institutional profile';
                }
            };
        }

        // Signup Submission
        if (signupForm) {
            signupForm.onsubmit = async (e) => {
                e.preventDefault();
                const name = document.getElementById('signup-name').value;
                const role = document.getElementById('signup-role').value;
                const email = document.getElementById('signup-email').value;
                const password = document.getElementById('signup-password').value;

                // Generate OTP
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                this.toast("Sending OTP to your email...", "info");
                
                await EmailService.send(email, 'Your IMS Verification Code', `Hello ${name},\n\nYour OTP for IMS registration is: ${otp}\n\nDo not share this with anyone.`);
                
                // Show OTP Modal
                const overlay = document.createElement('div');
                overlay.id = 'otp-overlay';
                overlay.style = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:2000;`;
                
                overlay.innerHTML = `
                    <div style="background:var(--card-bg); padding:30px; border-radius:12px; width:90%; max-width:400px; text-align:center;">
                        <h3 style="margin-bottom:15px; font-family:'Outfit', sans-serif;">Verification Required</h3>
                        <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:20px;">We sent a 6-digit code to <strong>${email}</strong>.</p>
                        <input type="text" id="otp-input" placeholder="000000" style="width:100%; padding:12px; font-size:1.5rem; text-align:center; letter-spacing:5px; border:1px solid var(--border); border-radius:8px; margin-bottom:20px; background:var(--bg-light); color:var(--text-main);" maxlength="6">
                        <div style="display:flex; gap:10px; justify-content:center;">
                            <button id="btn-cancel-otp" class="ui-btn ui-btn-ghost">Cancel</button>
                            <button id="btn-verify-otp" class="ui-btn ui-btn-primary">Verify & Create Account</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(overlay);

                document.getElementById('btn-cancel-otp').onclick = () => overlay.remove();
                
                document.getElementById('btn-verify-otp').onclick = async () => {
                    const entered = document.getElementById('otp-input').value;
                    if(entered !== otp) {
                        this.toast("Invalid Verification Code. Try again.", "danger");
                        return;
                    }
                    overlay.remove();
                    
                    try {
                        this.toast("Processing registration...", "info");

                        if (supabase && SUPABASE_URL) {
                            // 1. Create Auth User in Supabase
                            const { data: authData, error: authError } = await supabase.auth.signUp({
                                email,
                                password,
                            });

                            // If there's an error, check if it's just a rate limit or "User already exists"
                            if (authError) {
                                if (authError.status === 429) {
                                    throw new Error("Supabase rate limit exceeded. Please disable 'Email Rate Limit' in Supabase Dashboard (Auth -> Providers -> Email) or wait a few minutes.");
                                }
                                // If user already exists in Auth, we might still need to create their DB profile
                                if (authError.message.includes("already registered") || authError.message.includes("taken")) {
                                    console.log("User already exists in Auth, attempting to update/insert DB profile.");
                                } else {
                                    throw authError;
                                }
                            }

                            // 2. Add/Update the 'users' Table (The "Database" part)
                            // We use upsert to ensure details are stored even if they previously failed the DB part
                            const { error: dbError } = await supabase
                                .from('users')
                                .upsert([{ email, name, role }], { onConflict: 'email' });

                            if (dbError) {
                                console.error("Database Insert Error:", dbError);
                                throw new Error("Auth worked, but database storage failed. Ensure you have created the 'users' table in Supabase.");
                            }
                        } else {
                            console.log("Supabase not initiated. Storing in Local Database.");
                            const storedUsers = JSON.parse(localStorage.getItem('ims_users') || '[]');
                            if (storedUsers.some(u => u.email === email)) {
                                throw new Error("A user with this email already exists.");
                            }
                            storedUsers.push({ email, name, role, password });
                            localStorage.setItem('ims_users', JSON.stringify(storedUsers));
                        }

                        this.toast("Account ready! You can now sign in.", "success");
                        toggleAuth.click();
                    } catch (error) {
                        this.toast(error.message, "danger");
                    }
                };
            };
        }

        // Login Submission
        document.getElementById('login-form').onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                // 1. Supabase Authentication
                if (supabase && SUPABASE_URL) {
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email: email,
                        password: password,
                    });
                    if (error) throw error;
                    console.log("Supabase Auth: Success");
                } else {
                    console.log("Checking Local Database for authentication.");
                    const storedUsers = JSON.parse(localStorage.getItem('ims_users') || '[]');
                    const localUser = storedUsers.find(u => u.email === email);

                    if (localUser) {
                        if (localUser.password !== password) {
                            throw new Error("Invalid password.");
                        }
                    } else {
                        // Check hardcoded mock DB for demo accounts
                        const demoEmails = ['student@univ.edu', 'company@nvidia.com', 'faculty@univ.edu', 'hod@univ.edu', 'tpo@univ.edu', 'staff@univ.edu'];
                        if (!demoEmails.includes(email)) {
                            throw new Error("User not found. Please sign up first.");
                        }
                    }
                }

                // 2. Fetch Role and Name from DB (Supabase or LocalStorage)
                const userProfile = await fetchUserFromDB(email);

                Store.setUser({
                    id: email,
                    name: userProfile.name,
                    role: userProfile.role
                });

                this.toast(`Authenticated as ${userProfile.role}`, 'success');
                this.showScreen('dashboard');
                this.renderDashboard();
            } catch (error) {
                this.toast(error.message, 'danger');
            }
        };


        document.getElementById('logout-btn').onclick = () => {
            Store.setUser(null);
            this.showScreen('login');
            if (window.innerWidth <= 768) {
                this.toggleMobileSidebar(false);
            }
        };

        // Search logic
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.oninput = (e) => this.handleSearch(e.target.value);
        }

        // Notification Bell Logic
        const bell = document.getElementById('bell-icon');
        if (bell) {
            bell.onclick = () => {
                this.renderView('notifs');
                // Highlight active nav item
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                const notifItem = document.querySelector('.nav-item[data-view="notifs"]');
                if (notifItem) notifItem.classList.add('active');
            };
        }

        // User Pill Dropdown Logic
        const userPill = document.getElementById('user-pill');
        if (userPill) {
            userPill.style.cursor = 'pointer';
            userPill.onclick = (e) => {
                e.stopPropagation();
                this.showUserMenu(userPill);
            };
        }

        // Mobile Menu Toggle
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            menuToggle.onclick = (e) => {
                e.stopPropagation();
                this.toggleMobileSidebar();
            };
        }
    },

    showUserMenu(anchor) {
        const existing = document.getElementById('user-dropdown');
        if (existing) {
            existing.remove();
            return;
        }

        const dropdown = document.createElement('div');
        dropdown.id = 'user-dropdown';
        dropdown.className = 'glass';
        dropdown.style = `
            position: absolute;
            top: 75px;
            right: 40px;
            width: 220px;
            padding: 8px;
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
            z-index: 1000;
            background: var(--card-bg);
            border: 1px solid var(--border);
            animation: slideInUp 0.2s ease-out;
        `;

        dropdown.innerHTML = `
            <div class="dropdown-item" onclick="UI.showProfileModal()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span>Profiles</span>
            </div>
            <div class="dropdown-item" onclick="UI.toggleTheme()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                <span>Toggle Theme</span>
            </div>
            <div style="height: 1px; background: var(--border); margin: 6px 8px;"></div>
            <div class="dropdown-item logout" onclick="document.getElementById('logout-btn').click()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                <span>Logout</span>
            </div>
        `;

        document.body.appendChild(dropdown);

        const closeMenu = (e) => {
            if (!dropdown.contains(e.target) && !anchor.contains(e.target)) {
                dropdown.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    },

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('ims_theme', next);
        this.toast(`Institutional UI: ${next.toUpperCase()} mode active`, 'info');
    },

    showProfileModal() {
        const u = Store.getUser();
        const modalHtml = `
            <div id="modal-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; display:flex; justify-content:center; align-items:center;">
                <div class="glass" style="width:400px; padding:30px; border-radius:12px;">
                    <h3 style="color:var(--primary); margin-bottom:20px;">Institutional Profile</h3>
                    <div style="margin-bottom:20px;">
                        <label style="display:block; font-size:0.75rem; font-weight:700; margin-bottom:8px;">FULL NAME</label>
                        <input type="text" id="edit-profile-name" value="${u.name}" style="width:100%; padding:12px; border:1px solid var(--border); border-radius:8px; background:var(--bg-light);">
                    </div>
                    <div style="margin-bottom:25px;">
                        <label style="display:block; font-size:0.75rem; font-weight:700; margin-bottom:8px;">INSTITUTIONAL ROLE</label>
                        <div style="padding:12px; background:var(--bg-light); border-radius:8px; font-size:0.9rem; color:var(--text-muted); opacity:0.8;">${u.role.toUpperCase()} (Restricted)</div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button class="ui-btn ui-btn-primary" style="flex:1;" onclick="UI.saveProfile()">Save Identity</button>
                        <button class="ui-btn ui-btn-ghost" style="flex:1;" onclick="document.getElementById('modal-overlay').remove()">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    togglePass(id) {
        const input = document.getElementById(id);
        const toggle = input.nextElementSibling;
        const iconEye = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        const iconEyeOff = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

        if (input.type === 'password') {
            input.type = 'text';
            toggle.innerHTML = iconEye;
        } else {
            input.type = 'password';
            toggle.innerHTML = iconEyeOff;
        }
    },

    saveProfile() {
        const newName = document.getElementById('edit-profile-name').value;
        if (newName) {
            Store.updateUserProfile({ name: newName });
            document.getElementById('modal-overlay').remove();
            this.toast('Profile identity updated', 'success');
        }
    },

    handleSearch(query) {
        if (!query) return this.renderView(document.querySelector('.nav-item.active').dataset.view);
        const container = document.getElementById('page-content');
        const q = query.toLowerCase();

        const companies = Store.getCompanies().filter(c => c.name.toLowerCase().includes(q));
        const u = Store.getUser();
        const apps = Store.getApplications()
            .filter(a => u.role !== 'student' || a.student === u.id)
            .filter(a => a.studentName.toLowerCase().includes(q) || a.company.toLowerCase().includes(q));
        const interns = Store.getInternships().filter(i => i.title.toLowerCase().includes(q) || i.company.toLowerCase().includes(q));

        container.innerHTML = `
            <h3>Search Results for "${query}"</h3>
            <div style="margin-top:20px;">
                ${interns.length ? '<h4>Positions Found</h4>' + interns.map(i => `<div class="metric-card" style="margin-bottom:10px;">${i.title} @ ${i.company}</div>`).join('') : ''}
                ${companies.length ? '<h4 style="margin-top:20px;">Companies Found</h4>' + companies.map(c => `<div class="metric-card" style="margin-bottom:10px;">${c.name} (${c.state.current})</div>`).join('') : ''}
                ${apps.length ? '<h4 style="margin-top:20px;">Applications Found</h4>' + apps.map(a => `<div class="metric-card" style="margin-bottom:10px;">${a.studentName} - ${a.company}</div>`).join('') : ''}
                ${!interns.length && !companies.length && !apps.length ? '<p>No matches found in institutional records.</p>' : ''}
            </div>
        `;
    },

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(`${id}-screen`).classList.add('active');
    },

    renderDashboard() {
        const u = Store.getUser();
        document.getElementById('user-welcome').textContent = `Institutional Portal / Welcome, ${u.name}`;
        document.getElementById('user-role-label').textContent = u.role;
        document.getElementById('user-avatar').textContent = u.name.charAt(0).toUpperCase();

        this.renderSidebar(); // Render dynamic menu
        this.updateNotifBadge();
        this.renderView('overview');
    },

    renderSidebar() {
        const u = Store.getUser();
        const navMenu = document.getElementById('nav-menu');

        // Define views based on roles
        const roleViews = {
            student: [
                { id: 'overview', icon: '🏠', label: 'Dashboard' },
                { id: 'od-request', icon: '📄', label: 'Apply for OD' },
                { id: 'internships', icon: '💼', label: 'Internships' },
                { id: 'applications', icon: '📝', label: 'Applications' },
                { id: 'notifs', icon: '🔔', label: 'Notifications' },
                { id: 'workflow', icon: '📊', label: 'Workflow Maps' }
            ],
            coordinator: [
                { id: 'overview', icon: '🏠', label: 'Dashboard' },
                { id: 'internships', icon: '💼', label: 'Internships' },
                { id: 'applications', icon: '📝', label: 'Student ODs' },
                { id: 'notifs', icon: '🔔', label: 'Notifications' },
                { id: 'analytics', icon: '📈', label: 'Analytics' }
            ],
            mentor: [
                { id: 'overview', icon: '🏠', label: 'Dashboard' },
                { id: 'applications', icon: '📝', label: 'Queue' },
                { id: 'notifs', icon: '🔔', label: 'Notifications' },
                { id: 'analytics', icon: '📈', label: 'Analytics' }
            ],
            hod: [
                { id: 'overview', icon: '🏠', label: 'Dashboard' },
                { id: 'applications', icon: '📝', label: 'Approval Queue' },
                { id: 'notifs', icon: '🔔', label: 'Notifications' },
                { id: 'analytics', icon: '📈', label: 'Analytics' }
            ],
            tpo: [
                { id: 'overview', icon: '🏠', label: 'Dashboard' },
                { id: 'applications', icon: '📝', label: 'Action Pipeline' },
                { id: 'internships', icon: '💼', label: 'Marketplace' },
                { id: 'notifs', icon: '🔔', label: 'Notifications' },
                { id: 'analytics', icon: '📈', label: 'Analytics' }
            ]
        };

        const views = roleViews[u.role] || roleViews['student']; // Fallback to student

        navMenu.innerHTML = views.map(v => `
            <div class="nav-item ${v.id === 'overview' ? 'active' : ''}" data-view="${v.id}">
                ${v.icon} ${v.label}
            </div>
        `).join('');

        // Re-bind events to the new menu items
        navMenu.querySelectorAll('.nav-item').forEach(item => {
            item.onclick = () => {
                navMenu.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                this.renderView(item.dataset.view);
                
                // Close sidebar on mobile after selection
                if (window.innerWidth <= 768) {
                    this.toggleMobileSidebar(false);
                }
            };
        });
    },

    renderView(view) {
        const title = {
            overview: 'Institutional Overview',
            internships: 'Internships',
            applications: 'Workflow Pipeline',
            notifs: 'Communications',
            analytics: 'System Intelligence',
            workflow: 'Status Architectures',
            'od-request': 'OD Application Portal'
        };
        document.getElementById('view-title').textContent = title[view];
        const container = document.getElementById('page-content');
        container.innerHTML = `<div style="text-align:center; padding:50px;">Architecting view...</div>`;

        setTimeout(() => {
            switch (view) {
                case 'overview': this.renderOverview(container); break;
                case 'internships': this.renderInternships(container); break;
                case 'applications': this.renderApplications(container); break;
                case 'notifs': this.renderNotifs(container); break;
                case 'analytics': this.renderAnalytics(container); break;
                case 'workflow': this.renderWorkflowMaps(container); break;
                case 'od-request': this.renderODApplication(container); break;
            }
        }, 150);
    },

    renderODApplication(container) {
        const verifiedCompanies = Store.getCompanies().filter(c => c.state.current === States.COMPANY.VERIFIED);

        container.innerHTML = `
            <div class="form-card" style="max-width:600px; margin:0 auto;">
                <h3 style="color:var(--accent);">Submit OD Application</h3>
                <p style="margin-bottom:25px; color:var(--text-muted); font-size:0.85rem;">
                    Please select your verified internship provider and provide the required documentation to begin the three-tier institutional approval process.
                </p>
                <form id="od-request-form">
                    <div style="margin-bottom:20px;">
                        <label style="display:block; font-size:0.75rem; font-weight:700; color:var(--text-main); margin-bottom:8px;">VERIFIED COMPANY</label>
                        <select id="od-company-select" style="width:100%; padding:14px; border:1px solid var(--border); border-radius:10px; background:var(--bg-light); color:var(--text-main); font-size:0.9rem;" required>
                            <option value="">-- Choose Verified Partner --</option>
                            ${verifiedCompanies.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                        </select>
                        <p style="font-size:0.7rem; color:var(--text-muted); margin-top:5px;">Can't find your company? Submit it for verification in the Dashboard first.</p>
                    </div>
                    <div style="margin-bottom:20px;">
                        <label style="display:block; font-size:0.75rem; font-weight:700; color:var(--text-main); margin-bottom:8px;">INTERNSHIP DURATION</label>
                        <input type="text" id="od-duration-input" placeholder="e.g., 3 Months (June - Aug)" style="width:100%; padding:14px; border:1px solid var(--border); border-radius:10px; background:var(--bg-light); color:var(--text-main); font-size:0.9rem;" required>
                    </div>
                    <div style="margin-bottom:30px;">
                        <label style="display:block; font-size:0.75rem; font-weight:700; color:var(--text-main); margin-bottom:8px;">OFFER LETTER / DOCUMENTATION</label>
                        <div style="position:relative; width:100%; height:80px; border:2px dashed var(--border); border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:var(--bg-light); transition:var(--transition); overflow:hidden;">
                            <div id="file-preview-container" style="display:none; position:absolute; inset:0; background:white; z-index:5; align-items:center; justify-content:center; padding:10px;">
                                <img id="file-preview-img" src="" style="max-height:100%; max-width:100%; border-radius:4px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                            </div>
                            <span style="font-size:1.2rem; margin-bottom:2px;">📄</span>
                            <span id="file-preview-name" style="font-size:0.7rem; font-weight:600; color:var(--text-muted); text-align:center; padding:0 20px;">Click to upload Offer Letter</span>
                            <input type="file" id="od-doc-input" accept="image/*,.pdf" style="position:absolute; width:100%; height:100%; opacity:0; z-index:10; cursor:pointer;" required>
                        </div>
                    </div>
                    <button type="submit" class="ui-btn ui-btn-primary" style="width:100%; padding:16px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Initialize Approval Pipeline</button>
                    <div style="text-align:center; margin-top:20px; font-size:0.75rem; color:var(--text-muted);">
                        🔒 This request will be forwarded to your Mentor, HOD, and TPO for multi-tier verification.
                    </div>
                </form>
            </div>
        `;
        this.attachSubEvents();
    },

    renderStudentSubform() {
        const u = Store.getUser();
        const studentComps = Store.getCompanies().filter(c => c.submittedByRole === 'student' && c.submittedBy === u.id);

        return `
            <div class="dashboard-grid" style="grid-template-columns: 1fr; margin-bottom: 20px;">
                <div class="form-card">
                    <h3 style="color:var(--accent);">Verify Internship Company</h3>
                    <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">You must verify your company before you can apply for OD approvals.</p>
                    <form id="comp-submit-form">
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px;">
                            <div>
                                <label style="display:block; font-size:0.75rem; font-weight:700; margin-bottom:5px;">COMPANY NAME</label>
                                <input type="text" id="comp-name" placeholder="Inc. Corp" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" required>
                            </div>
                            <div>
                                <label style="display:block; font-size:0.75rem; font-weight:700; margin-bottom:5px;">OFFICIAL EMAIL</label>
                                <input type="email" id="comp-email" placeholder="hr@company.com" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" required>
                            </div>
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px;">
                            <div>
                                <label style="display:block; font-size:0.75rem; font-weight:700; margin-bottom:5px;">WEBSITE LINK</label>
                                <input type="url" id="comp-website" placeholder="https://company.com" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" required>
                            </div>
                            <div>
                                <label style="display:block; font-size:0.75rem; font-weight:700; margin-bottom:5px;">LINKEDIN PROFILE</label>
                                <input type="url" id="comp-linkedin" placeholder="https://linkedin.com/company/..." style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" required>
                            </div>
                        </div>
                        <button type="submit" class="ui-btn ui-btn-primary" style="width:100%;">Submit for Verification</button>
                    </form>
                </div>
            </div>

            ${studentComps.length > 0 ? `
                <h3 style="margin-top:30px; margin-bottom:15px;">Your Verification Requests</h3>
                <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">
                    ${studentComps.map(c => `
                        <div class="metric-card">
                            <div style="display:flex; justify-content:space-between; align-items:start;">
                                <strong>${c.name}</strong>
                                <span class="badge badge-${c.state.current === States.COMPANY.VERIFIED ? 'success' : c.state.current === States.COMPANY.REJECTED ? 'danger' : 'pending'}">${c.state.current}</span>
                            </div>
                            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:10px;">
                                <div>🌐 <a href="${c.website}" target="_blank" style="color:var(--accent);">${c.website}</a></div>
                                <div>🔗 <a href="${c.linkedin}" target="_blank" style="color:var(--accent);">LinkedIn Profile</a></div>
                            </div>
                            ${(() => {
                if (c.state.current !== States.COMPANY.VERIFIED) return '';
                const app = Store.getApplications().find(a => a.student === u.id && a.company === c.name);
                if (app) {
                    return `
                                        <div style="margin-top:15px; padding:12px; background:var(--bg-light); border-radius:10px; border:1px solid var(--border);">
                                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                                <span style="font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.02em;">OD Application Context</span>
                                                <span class="badge badge-${app.state.current.toLowerCase().includes('granted') ? 'success' : app.state.current.includes('Rejected') ? 'danger' : 'pending'}" style="font-size:0.65rem; padding:4px 10px;">${app.state.current}</span>
                                            </div>
                                            <div style="font-size:0.75rem; color:var(--text-main); font-weight:600;">ID: ${app.id} • ${app.duration}</div>
                                            <div style="margin-top:8px; display:flex; gap:10px;">
                                                <button class="ui-btn ui-btn-ghost view-app" data-id="${app.id}" style="flex:1; padding:6px; font-size:0.7rem;">Integrate View</button>
                                                <button class="ui-btn ui-btn-ghost view-history" data-id="${app.id}" style="flex:1; padding:6px; font-size:0.7rem;">Timeline</button>
                                            </div>
                                        </div>
                                    `;
                } else {
                    return `
                                        <div style="margin-top:15px; padding:12px; border:1px dashed var(--border); border-radius:10px; text-align:center; background:rgba(197, 160, 89, 0.03);">
                                            <p style="font-size:0.75rem; color:var(--text-muted); font-weight:500;">Institutional OD not yet initiated.</p>
                                            <p style="font-size:0.7rem; color:var(--accent); margin-top:2px; cursor:pointer; font-weight:700; text-transform:uppercase;" onclick="UI.renderView('od-request')">Navigate to OD Portal →</p>
                                        </div>
                                    `;
                }
            })()}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
    },

    renderCompanySubform() {
        return `
            <div class="form-card" style="margin-top:20px;">
                <h3>Company Dashboard</h3>
                <p>Manage your internship postings and view applicant status.</p>
                <button class="ui-btn ui-btn-primary" onclick="UI.showPostInternModal()">Post New Internship</button>
            </div>
        `;
    },

    renderDirectAdditionForm() {
        return `
            <div class="form-card" style="margin-top:20px;">
                <h3>Whitelist New Company (Direct/Auto-Verified)</h3>
                <p style="font-size:0.8rem; color:var(--text-muted);">As TPO/Coordinator, companies you add are instantly verified.</p>
                <form id="direct-comp-form" style="margin-top:15px;">
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
                        <input type="text" id="d-comp-name" placeholder="Company Name" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:4px;" required>
                        <input type="email" id="d-comp-email" placeholder="Official Email" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:4px;" required>
                    </div>
                    <button type="submit" class="ui-btn ui-btn-primary">Directly Add to List</button>
                </form>
            </div>
        `;
    },

    renderOverview(container) {
        const u = Store.getUser();
        let html = `
            <div class="dashboard-grid">
                <div class="metric-card"><div class="metric-label">System Load</div><div class="metric-value">Active</div></div>
                <div class="metric-card"><div class="metric-label">Role Context</div><div class="metric-value">${u.role.toUpperCase()}</div></div>
                <div class="metric-card"><div class="metric-label">Last Log</div><div class="metric-value">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div>
            </div>
        `;

        if (u.role === 'student') {
            html += this.renderStudentSubform();
        } else if (u.role === 'coordinator') {
            html += this.renderCoordinatorReview();
            html += this.renderApproverQueue(); // Coordinators can now see/monitor the OD queue
        } else if (u.role === 'tpo') {
            html += this.renderApproverQueue();
        } else {
            html += this.renderApproverQueue();
        }

        container.innerHTML = html;
        this.attachSubEvents();
    },

    renderInternships(container) {
        const u = Store.getUser();
        const interns = Store.getInternships();

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px;">
                <h3>Active Internships</h3>
                ${(u.role === 'company' || u.role === 'coordinator' || u.role === 'tpo') ? '<button class="ui-btn ui-btn-primary" id="open-post-intern">Post New Opening</button>' : ''}
            </div>
            <div class="dashboard-grid" style="grid-template-columns: repeat(2, 1fr);">
                ${interns.map(i => `
                    <div class="metric-card">
                        <div style="display:flex; justify-content:space-between;">
                            <span class="badge badge-success">${i.type}</span>
                            <span style="font-weight:700; color:var(--accent);">${i.stipend}</span>
                        </div>
                        <h4 style="margin-top:10px;">${i.title}</h4>
                        <p style="font-size:0.8rem; color:var(--text-muted);">${i.company} • ${i.location}</p>
                        <p style="font-size:0.85rem; margin-top:10px;">${i.description}</p>
                        ${(() => {
                const company = Store.getCompanies().find(c => c.name.toLowerCase() === i.company.toLowerCase());
                const isVerified = company && company.state.current === States.COMPANY.VERIFIED;

                if (u.role === 'student') {
                    if (isVerified) {
                        return `<button class="ui-btn ui-btn-primary apply-link-btn" data-link="${i.applyLink}" style="width:100%; margin-top:20px;">Instantly Apply</button>`;
                    } else {
                        return `<div style="margin-top:20px; padding:15px; background:rgba(255,0,0,0.05); border:1px solid rgba(255,0,0,0.1); border-radius:8px; text-align:center;">
                                    <p style="font-size:0.8rem; color:var(--danger); font-weight:600;">Verification Required</p>
                                    <p style="font-size:0.75rem; color:var(--text-muted);">This company is not yet verified. Please verify it in the Dashboard first.</p>
                                </div>`;
                    }
                }
                return '';
            })()}
            ${(() => {
                const deleteBtn = (u.role === 'coordinator' || u.role === 'tpo')
                    ? `<button class="ui-btn ui-btn-ghost delete-intern" data-id="${i.id}" style="width:100%; margin-top:10px; color:var(--danger); border-color:var(--danger);">Delete Posting</button>`
                    : '';
                return deleteBtn;
            })()}
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;
        this.attachSubEvents();
    },

    renderAnalytics(container) {
        const comps = Store.getCompanies();
        const apps = Store.getApplications();
        const verifiedCount = comps.filter(c => c.state.current === States.COMPANY.VERIFIED).length;
        const grantedCount = apps.filter(a => a.state.current === States.OD.GRANTED).length;

        container.innerHTML = `
            <div class="dashboard-grid">
                <div class="metric-card"><div class="metric-label">Institutional Partners</div><div class="metric-value">${comps.length}</div><p style="font-size:0.7rem;">${verifiedCount} Verified</p></div>
                <div class="metric-card"><div class="metric-label">OD Throughput</div><div class="metric-value">${apps.length}</div><p style="font-size:0.7rem;">${grantedCount} Granted</p></div>
                <div class="metric-card"><div class="metric-label">Success Rate</div><div class="metric-value">${Math.round((grantedCount / (apps.length || 1)) * 100)}%</div></div>
            </div>
            <div class="form-card" style="max-width:100%;">
                <h3>Monthly Approval Distribution</h3>
                <div style="display:flex; align-items:flex-end; gap:20px; height:200px; margin-top:30px; padding-bottom:20px; border-bottom:2px solid var(--border);">
                    <div style="flex:1; background:var(--primary); height:40%; border-radius:4px 4px 0 0; position:relative;"><span style="position:absolute; top:-20px; width:100%; text-align:center; font-size:0.7rem;">Jan</span></div>
                    <div style="flex:1; background:var(--primary); height:65%; border-radius:4px 4px 0 0; position:relative;"><span style="position:absolute; top:-20px; width:100%; text-align:center; font-size:0.7rem;">Feb</span></div>
                    <div style="flex:1; background:var(--accent); height:90%; border-radius:4px 4px 0 0; position:relative;"><span style="position:absolute; top:-20px; width:100%; text-align:center; font-size:0.7rem;">Mar</span></div>
                    <div style="flex:1; background:var(--primary); height:55%; border-radius:4px 4px 0 0; position:relative;"><span style="position:absolute; top:-20px; width:100%; text-align:center; font-size:0.7rem;">Apr</span></div>
                </div>
            </div>
        `;
    },

    renderCoordinatorReview() {
        const pending = Store.getCompanies().filter(c => c.state.current === States.COMPANY.PENDING);
        return `
            <h3>Company Verification Queue</h3>
            <div style="margin-top:20px;">
                ${pending.map(c => `
                    <div class="metric-card" style="margin-bottom:15px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <strong style="font-size:1.1rem; color:var(--primary);">${c.name}</strong><br>
                                <span style="font-size:0.85rem; font-weight:600;">${c.email}</span>
                            </div>
                            <div style="display:flex; gap:10px;">
                                <button class="ui-btn ui-btn-primary coordinator-action" data-id="${c.id}" data-action="VERIFY">Verify</button>
                                <button class="ui-btn ui-btn-ghost coordinator-action" data-id="${c.id}" data-action="REJECT" style="color:var(--danger);">Reject</button>
                            </div>
                        </div>
                        <div style="margin-top:15px; display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:0.8rem; background:var(--bg-light); padding:10px; border-radius:6px;">
                            <div><strong>Website:</strong> <br><a href="${c.website}" target="_blank" style="color:var(--primary);">${c.website || 'N/A'}</a></div>
                            <div><strong>LinkedIn:</strong> <br><a href="${c.linkedin}" target="_blank" style="color:var(--primary);">${c.linkedin || 'N/A'}</a></div>
                        </div>
                    </div>
                `).join('') || '<p>Queue clear.</p>'}
            </div>
        `;
    },

    renderApproverQueue() {
        const u = Store.getUser();
        const activeApps = Store.getApplications().filter(a => {
            if (u.role === 'coordinator') return true; // Coordinators see everything as monitors
            if (u.role === 'mentor') return a.state.current === States.OD.PENDING_MENTOR;
            if (u.role === 'hod') return a.state.current === States.OD.PENDING_HOD;
            if (u.role === 'tpo') return a.state.current === States.OD.PENDING_TPO;
            return false;
        });

        return `
            <h3>${u.role === 'coordinator' ? 'Institutional OD Monitor' : 'Action Pipeline'}</h3>
            <div style="margin-top:20px;">
                ${activeApps.map(a => `
                    <div class="metric-card" style="margin-bottom:15px;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div style="flex:1;">
                                <strong style="color:var(--primary);">${a.studentName}</strong> <span style="color:var(--text-muted); font-size:0.8rem;">(${a.student})</span><br>
                                <span style="font-size:0.85rem; font-weight:600;">Entity: ${a.company}</span><br>
                                <span style="font-size:0.8rem;">ID: ${a.id} • Duration: ${a.duration} • <span class="badge badge-pending">${a.state.current}</span></span>
                                <div style="display:flex; align-items:center; gap:8px; margin-top:10px; padding-top:10px; border-top:1px dashed var(--border);">
                                    <div style="width:28px; height:28px; border-radius:4px; background:var(--bg-light); display:flex; align-items:center; justify-content:center; border:1px solid var(--border); overflow:hidden; flex-shrink:0;">
                                        ${a.docData && a.docData.startsWith('data:image') ? `<img src="${a.docData}" style="width:100%; height:100%; object-fit:cover;">` : '<span style="font-size:0.7rem;">📄</span>'}
                                    </div>
                                    <div>
                                        <div style="font-size:0.6rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Offer Letter</div>
                                        ${a.docData ? `<a href="${a.docData}" target="_blank" download="${a.doc || 'offer_letter'}" style="font-size:0.75rem; color:var(--primary); font-weight:600; text-decoration:none; border-bottom:1px solid var(--accent);">${a.doc || 'document.pdf'}</a>` : `<span style="font-size:0.75rem; color:var(--text-muted);">${a.doc || 'N/A'}</span>`}
                                    </div>
                                </div>
                            </div>
                            <button class="ui-btn ui-btn-primary view-app" data-id="${a.id}" style="margin-left:15px; flex-shrink:0;">${u.role === 'coordinator' ? 'View Details' : 'Review & Action'}</button>
                        </div>
                    </div>
                `).join('') || '<p>No pending approvals in the queue.</p>'}
            </div>
        `;
    },

    renderApplications(container) {
        const u = Store.getUser();
        let apps = Store.getApplications();

        if (u.role === 'student') {
            apps = apps.filter(a => a.student === u.id);
        }

        container.innerHTML = `
            <h3>${u.role === 'student' ? 'Your Progress Tracking' : 'Global Pipeline Tracking'}</h3>
            <div style="margin-top:20px;">
                ${apps.map(a => `
                    <div class="metric-card" style="margin-bottom:15px; padding:20px;">
                        <div style="display:flex; flex-direction:column; gap:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <div style="width:32px; height:32px; border-radius:50%; background:rgba(10,37,64,0.05); display:flex; align-items:center; justify-content:center; color:var(--primary); font-weight:800; font-size:0.7rem;">${a.company[0]}</div>
                                    <div>
                                        <div style="font-weight:700; color:var(--primary); font-size:0.9rem;">${a.company}</div>
                                        <div style="font-size:0.7rem; color:var(--text-muted);">ID: ${a.id} • Assigned to ${a.studentName}</div>
                                    </div>
                                </div>
                                <span class="badge badge-${a.state.current.toLowerCase().includes('granted') ? 'success' : a.state.current.includes('Rejected') ? 'danger' : 'pending'}">${a.state.current.replace('PENDING_', '')}</span>
                            </div>
                            
                            ${this.renderMiniPipeline(a.state.current, a.state.history)}
                            
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px; padding-top:10px; border-top:1px dashed var(--border);">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <div style="width:30px; height:30px; border-radius:4px; background:var(--bg-light); display:flex; align-items:center; justify-content:center; border:1px solid var(--border); overflow:hidden; flex-shrink:0;">
                                        ${a.docData && a.docData.startsWith('data:image') 
                                            ? `<img src="${a.docData}" style="width:100%; height:100%; object-fit:cover;">` 
                                            : a.docData 
                                                ? `<div style="width:100%; height:100%; background:#e8f0fe; display:flex; align-items:center; justify-content:center;"><span style="font-size:0.55rem; font-weight:800; color:#1a56db; letter-spacing:-0.02em;">PDF</span></div>`
                                                : '<span style="font-size:0.75rem;">📄</span>'}
                                    </div>
                                    <div>
                                        <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Offer Letter</div>
                                        ${a.docData 
                                            ? `<a href="${a.docData}" target="_blank" download="${a.doc || 'offer_letter'}" style="font-size:0.75rem; color:var(--primary); font-weight:600; text-decoration:none; border-bottom:1px solid var(--accent);">${a.doc || 'document.pdf'}</a>`
                                            : `<span style="font-size:0.75rem; color:var(--text-muted);">${a.doc || 'document.pdf'}</span>`}
                                    </div>
                                </div>
                                <button class="ui-btn ui-btn-ghost view-history" data-id="${a.id}" style="font-size:0.65rem; padding:4px 10px; height:auto;">History log</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        this.attachSubEvents();
    },

    renderMiniPipeline(current, history = []) {
        const steps = ['Mentor', 'HOD', 'TPO', 'Granted'];
        const states = [States.OD.PENDING_MENTOR, States.OD.PENDING_HOD, States.OD.PENDING_TPO, States.OD.GRANTED];
        const curIdx = states.indexOf(current);
        const isGranted = current === States.OD.GRANTED;

        if (current === States.OD.REJECTED) {
            // Find the rejector from history
            const rejEntry = [...history].reverse().find(h => h.status === States.OD.REJECTED);
            return `
                <div style="display:flex; align-items:center; gap:10px; padding:12px; background:rgba(220,53,69,0.05); border-radius:8px; border:1px solid rgba(220,53,69,0.15);">
                    <span style="width:20px; height:20px; border-radius:50%; background:var(--danger); display:flex; align-items:center; justify-content:center; color:white; font-size:0.6rem; font-weight:900; flex-shrink:0;">✕</span>
                    <div>
                        <div style="font-size:0.72rem; font-weight:700; color:var(--danger);">Application Rejected</div>
                        ${rejEntry ? `<div style="font-size:0.65rem; color:var(--text-muted); margin-top:2px;">By ${rejEntry.actor} · ${rejEntry.timestamp}${rejEntry.comment ? ' — "' + rejEntry.comment + '"' : ''}</div>` : ''}
                    </div>
                </div>`;
        }

        // Map which history entry corresponds to each step being completed
        // Completing step i means the state moved TO states[i+1] (or GRANTED)
        const completionHistory = [
            history.find(h => h.status === States.OD.PENDING_HOD),   // Mentor approved
            history.find(h => h.status === States.OD.PENDING_TPO),    // HOD approved
            history.find(h => h.status === States.OD.GRANTED),         // TPO approved
            history.find(h => h.status === States.OD.GRANTED),         // Granted (same)
        ];

        return `
            <div class="mini-pipeline" style="display:flex; align-items:flex-start; padding:16px 0 8px; position:relative;">
                ${steps.map((s, i) => {
                    const isDone = isGranted ? true : i < curIdx;
                    const isActive = !isGranted && i === curIdx;
                    const hist = completionHistory[i];

                    // Node styles
                    const nodeBg   = isDone ? 'var(--accent)' : isActive ? 'var(--primary)' : '#e9ecef';
                    const nodeBdr  = isDone ? 'var(--accent)' : isActive ? 'var(--primary)' : '#ced4da';
                    const labelClr = isDone ? 'var(--accent)' : isActive ? 'var(--primary)' : 'var(--text-muted)';

                    return `
                        <div class="mini-pipeline-step ${isDone ? 'completed' : ''}" style="display:flex; align-items:flex-start; flex:1; min-width:0; position:relative;">
                            <!-- Segments for horizontal desktop layout -->
                            <div class="left-seg" style="flex:1; height:2px; background:${i > 0 && (isGranted || i <= curIdx) ? 'var(--accent)' : '#dee2e6'}; margin-top:10px; ${i === 0 ? 'visibility:hidden' : ''}"></div>
                            
                            <div class="node-container" style="display:flex; flex-direction:column; align-items:center; min-width:52px;">
                                <div style="width:20px; height:20px; border-radius:50%; flex-shrink:0;
                                    background:${nodeBg};
                                    border:2px solid ${nodeBdr};
                                    box-shadow:${isActive ? '0 0 0 4px rgba(10,37,64,0.12)' : isDone ? '0 0 0 3px rgba(197,160,89,0.2)' : 'none'};
                                    transition:all 0.35s ease;
                                    display:flex; align-items:center; justify-content:center;
                                    z-index: 2;
                                    ${isActive ? 'animation:pipelinePulse 1.8s ease-in-out infinite;' : ''}">
                                    ${isDone ? '<span style="color:white; font-size:0.55rem; font-weight:900; line-height:1;">✓</span>' : isActive ? '<span style="width:6px; height:6px; border-radius:50%; background:white; display:block;"></span>' : ''}
                                </div>
                                <div class="label-container" style="display:flex; flex-direction:column; align-items:center;">
                                    <span style="font-size:0.58rem; font-weight:700; margin-top:6px; color:${labelClr}; text-transform:uppercase; letter-spacing:0.04em; text-align:center; line-height:1.2;">${s}</span>
                                    ${isDone && hist ? `<span style="font-size:0.5rem; color:var(--text-muted); margin-top:2px; text-align:center; max-width:52px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${hist.actor}">${hist.actor}</span>` : ''}
                                    ${isActive ? '<span style="font-size:0.5rem; font-weight:700; color:var(--accent); margin-top:2px; text-transform:uppercase; letter-spacing:0.03em;">Pending</span>' : ''}
                                </div>
                            </div>

                            <div class="right-seg" style="flex:1; height:2px; background:${i < steps.length - 1 && (isGranted || i < curIdx) ? 'var(--accent)' : '#dee2e6'}; margin-top:10px; ${i === steps.length - 1 ? 'visibility:hidden' : ''}"></div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    renderWorkflowMaps(container) {
        container.innerHTML = `
            <div class="form-card">
                <h3>State Transition Architecture (UML Inspired)</h3>
                <p style="color:var(--text-muted); font-size:0.8rem; margin-bottom:30px;">This diagram illustrates the finite state machine transitions for OD approvals.</p>
                <div class="pipeline">
                    <div class="pipeline-step active"><div class="step-bubble">S</div><div class="step-label">Submitted</div></div>
                    <div class="pipeline-step active"><div class="step-bubble">M</div><div class="step-label">Mentor</div></div>
                    <div class="pipeline-step active"><div class="step-bubble">H</div><div class="step-label">HOD</div></div>
                    <div class="pipeline-step active"><div class="step-bubble">T</div><div class="step-label">TPO</div></div>
                    <div class="pipeline-step active"><div class="step-bubble">G</div><div class="step-label">Granted</div></div>
                </div>
            </div>
        `;
    },

    renderNotifs(container) {
        const role = Store.getUser().role;
        const notifs = Store.getNotifs(role);
        container.innerHTML = `
            <div class="form-card">
                <h3>Institutional Feed (Observer Updates)</h3>
                <div style="margin-top:20px;">
                    ${notifs.map(n => `
                        <div style="padding:15px; border-bottom:1px solid var(--border); border-left:3px solid ${n.type === 'info' ? 'var(--primary)' : n.type === 'success' ? 'var(--success)' : 'var(--danger)'}">
                            <div style="font-size:0.85rem; font-weight:500;">${n.msg}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted);">${n.time}</div>
                        </div>
                    `).join('') || '<p>No system logs recorded.</p>'}
                </div>
            </div>
        `;
    },

    attachSubEvents() {
        const u = Store.getUser();

        // OD Submission (Dashboard modal version)
        const odForm = document.getElementById('od-submit-form');
        if (odForm) {
            odForm.onsubmit = (e) => {
                e.preventDefault();
                Store.submitOD({ company: document.getElementById('od-company').value, duration: document.getElementById('od-duration').value });
                this.toast('OD Application pipeline initialized!', 'success');
                this.renderView('applications');
            };
        }

        // Dedicated OD Request Form
        const odRequestForm = document.getElementById('od-request-form');
        if (odRequestForm) {
            odRequestForm.onsubmit = (e) => {
                e.preventDefault();
                const company = document.getElementById('od-company-select').value;
                const duration = document.getElementById('od-duration-input').value;
                const docInput = document.getElementById('od-doc-input');
                const docFile = docInput.files[0];

                // Retrieve base64 doc data stored by the file reader
                const docData = docInput.dataset.docData || '';

                const result = Store.submitOD({
                    company: company,
                    duration: duration,
                    doc: docFile ? docFile.name : 'OFFER_LETTER.pdf',
                    docData: docData
                });

                if (result.error) {
                    this.toast(result.error, 'danger');
                } else {
                    this.toast('OD Application submitted successfully!', 'success');
                    this.renderView('applications');
                }
            };
        }

        // Real-time File Preview for OD Request
        const fileInput = document.getElementById('od-doc-input');
        if (fileInput) {
            fileInput.onchange = () => {
                const file = fileInput.files[0];
                const preview = document.getElementById('file-preview-name');
                const container = document.getElementById('file-preview-container');
                const img = document.getElementById('file-preview-img');

                if (file) {
                    preview.textContent = file.name;
                    preview.parentElement.style.borderColor = 'var(--accent)';

                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            img.src = e.target.result;
                            container.style.display = 'flex';
                            fileInput.dataset.docData = e.target.result;
                        };
                        reader.readAsDataURL(file);
                    } else {
                        // For non-image files (e.g. PDF), still read as data URL for storage
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            fileInput.dataset.docData = e.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                }
            };
        }

        // Company Submission (Student)
        const compForm = document.getElementById('comp-submit-form');
        if (compForm) {
            compForm.onsubmit = (e) => {
                e.preventDefault();
                const u = Store.getUser();
                Store.submitCompany({
                    name: document.getElementById('comp-name').value,
                    email: document.getElementById('comp-email').value,
                    website: document.getElementById('comp-website').value,
                    linkedin: document.getElementById('comp-linkedin').value,
                    submittedBy: u.id,
                    doc: 'STUDENT_SUBMISSION.pdf'
                }, 'student');
                this.toast('Company submitted to Internship Coordinator for verification.', 'info');
                this.renderView('overview');
            };
        }

        // Direct Company Addition (TPO/Coordinator)
        const directForm = document.getElementById('direct-comp-form');
        if (directForm) {
            directForm.onsubmit = (e) => {
                e.preventDefault();
                Store.submitCompany({
                    name: document.getElementById('d-comp-name').value,
                    email: document.getElementById('d-comp-email').value,
                    doc: 'DIRECT_ENTRY.pdf'
                }, u.role);
                this.toast('Company added and automatically verified!', 'success');
                this.renderView('overview');
            };
        }

        // Coordinator Action
        document.querySelectorAll('.coordinator-action').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                const action = btn.dataset.action;
                const comp = Store.getCompanies().find(c => c.id === id);
                comp.state.transition(action === 'VERIFY' ? States.COMPANY.VERIFIED : States.COMPANY.REJECTED, 'Internship Coordinator');
                Store.sync('companies');
                Store.addNotif(`Company ${comp.name} was ${action.toLowerCase()}ed by the coordinator`, action === 'VERIFY' ? 'success' : 'danger', 'student');

                // If verified, notify the specific student who submitted it
                if (comp.submittedBy) {
                    Store.addNotif(`Great news! Your company ${comp.name} has been verified!`, 'success', 'student');
                }

                Store.addNotif(`Your company info was ${action.toLowerCase()}ed by the coordinator`, action === 'VERIFY' ? 'success' : 'danger', 'company');
                this.renderView('overview');
            };
        });

        // View Review Link
        document.querySelectorAll('.view-app').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                this.showReviewModal(id);
            };
        });

        // Internship External Application (Redirect)
        document.querySelectorAll('.apply-link-btn').forEach(btn => {
            btn.onclick = () => {
                const link = btn.dataset.link;
                if (link && link !== '#') {
                    window.open(link, '_blank');
                    this.toast('Opening application portal...', 'info');
                } else {
                    this.toast('Application link not available for this position.', 'warning');
                }
            };
        });

        // Delete Internship
        document.querySelectorAll('.delete-intern').forEach(btn => {
            btn.onclick = () => {
                if (confirm('Are you sure you want to remove this posting?')) {
                    Store.deleteInternship(btn.dataset.id);
                    this.renderView('internships');
                }
            };
        });

        // Post Internship Modal
        const postBtn = document.getElementById('open-post-intern');
        if (postBtn) postBtn.onclick = () => this.showPostInternModal();

        // View Timeline/History
        document.querySelectorAll('.view-history').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                this.showHistoryModal(id);
            };
        });
    },

    showHistoryModal(id) {
        const app = Store.getApplications().find(a => a.id === id);
        if (!app) return;

        const modalHtml = `
            <div id="modal-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; display:flex; justify-content:center; align-items:center;">
                <div class="glass" style="width:500px; padding:30px; border-radius:12px; max-height:80vh; overflow-y:auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                        <h3 style="color:var(--primary);">Workflow Timeline: ${app.id}</h3>
                        <button onclick="document.getElementById('modal-overlay').remove()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-muted);">&times;</button>
                    </div>
                    
                    <div style="position:relative; padding-left:30px;">
                        <div style="position:absolute; left:10px; top:0; bottom:0; width:2px; background:var(--border);"></div>
                        
                        ${app.state.history.length === 0 ? '<p style="color:var(--text-muted); font-size:0.85rem;">No history recorded yet.</p>' : 
                          app.state.history.map((entry, index) => `
                            <div style="position:relative; margin-bottom:25px;">
                                <div style="position:absolute; left:-25px; top:5px; width:12px; height:12px; border-radius:50%; background:${entry.status === States.OD.REJECTED ? 'var(--danger)' : index === app.state.history.length-1 ? 'var(--accent)' : 'var(--primary)'}; border:2px solid white; box-shadow:0 0 0 2px ${entry.status === States.OD.REJECTED ? 'var(--danger)' : 'var(--primary)'};"></div>
                                <div style="font-weight:700; color:var(--primary); font-size:0.9rem;">${entry.status}</div>
                                <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${entry.actor} • ${entry.timestamp}</div>
                                ${entry.comment ? `<div style="margin-top:8px; padding:10px; background:var(--bg-light); border-radius:6px; font-size:0.8rem; font-style:italic; border-left:3px solid var(--accent);">"${entry.comment}"</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                    
                    <button class="ui-btn ui-btn-primary" onclick="document.getElementById('modal-overlay').remove()" style="width:100%; margin-top:20px;">Close Pipeline View</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    showPostInternModal() {
        const u = Store.getUser();
        const isInstitutional = u.role !== 'company';
        const modalHtml = `
            <div id="modal-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; display:flex; justify-content:center; align-items:center;">
                <div class="glass" style="width:600px; padding:30px; border-radius:12px;">
                    <h2>Post Institutional Opportunity</h2>
                    <form id="post-intern-form" style="margin-top:20px;">
                        <input type="text" id="post-company" placeholder="Company Name" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:4px; margin-bottom:10px;" required>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
                            <input type="text" id="post-title" placeholder="Position Title" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:4px;" required>
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
                            <input type="text" id="post-stipend" placeholder="Stipend (e.g. $1000/mo)" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:4px;">
                            <input type="text" id="post-location" placeholder="Location" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:4px;">
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr; gap:10px; margin-bottom:10px;">
                            <input type="url" id="post-link" placeholder="Application Link (HTTP/HTTPS)" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:4px;" required>
                        </div>
                        <textarea id="post-desc" placeholder="Job Description" style="width:100%; height:100px; padding:10px; border:1px solid var(--border); border-radius:4px; margin-bottom:20px;"></textarea>
                        <div style="display:flex; gap:10px;">
                            <button type="submit" class="ui-btn ui-btn-primary" style="flex:1;">Publish Posting</button>
                            <button type="button" class="ui-btn ui-btn-ghost" onclick="document.getElementById('modal-overlay').remove()">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('post-intern-form').onsubmit = (e) => {
            e.preventDefault();
            Store.postInternship({
                title: document.getElementById('post-title').value,
                company: document.getElementById('post-company').value,
                stipend: document.getElementById('post-stipend').value,
                location: document.getElementById('post-location').value,
                description: document.getElementById('post-desc').value,
                applyLink: document.getElementById('post-link').value,
                type: 'Full-time'
            });
            document.getElementById('modal-overlay').remove();
            this.toast('New position published successfully', 'success');
            this.renderView('internships');
        };
    },

    showReviewModal(id) {
        const app = Store.getApplications().find(a => a.id === id);
        const u = Store.getUser();

        const isApprover = !!ApproverMap[u.role];

        const modalHtml = `
            <div id="modal-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; display:flex; justify-content:center; align-items:center;">
                <div class="glass" style="width:500px; padding:30px; border-radius:12px;">
                    <h3>${isApprover ? 'Application Review' : 'Application Details'}: ${app.id}</h3>
                    <div style="margin:20px 0; font-size:0.9rem; line-height:1.6;">
                        <p><strong>Student:</strong> ${app.studentName} (${app.student})</p>
                        <p><strong>Company:</strong> ${app.company}</p>
                        <p><strong>Duration:</strong> ${app.duration}</p>
                        <p><strong>Status:</strong> <span class="badge badge-pending">${app.state.current}</span></p>
                        <div style="margin-top:10px; padding:12px; background:var(--bg-light); border-radius:8px; border:1px solid var(--border);">
                            <div style="font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:8px;">📄 Offer Letter / Documentation</div>
                            ${app.docData ? `
                                <div style="display:flex; align-items:center; gap:12px;">
                                    ${app.docData.startsWith('data:image') ? `<img src="${app.docData}" style="height:60px; border-radius:4px; border:1px solid var(--border); box-shadow:0 2px 5px rgba(0,0,0,0.1);">` : `<div style="width:50px; height:60px; background:rgba(10,37,64,0.06); border-radius:4px; border:1px solid var(--border); display:flex; align-items:center; justify-content:center; font-size:1.5rem;">📄</div>`}
                                    <div>
                                        <div style="font-weight:600; font-size:0.85rem; color:var(--primary);">${app.doc || 'offer_letter.pdf'}</div>
                                        <a href="${app.docData}" target="_blank" download="${app.doc || 'offer_letter'}" style="font-size:0.75rem; color:var(--accent); font-weight:600; text-decoration:none; border-bottom:1px solid var(--accent);">⬇ Download / View File</a>
                                    </div>
                                </div>
                            ` : `<span style="font-size:0.8rem; color:var(--text-muted);">${app.doc || 'No document attached'}</span>`}
                        </div>
                    </div>
                    
                    ${isApprover ? `
                        <textarea id="review-comment" placeholder="Add commentary..." style="width:100%; height:80px; padding:10px; border:1px solid var(--border); border-radius:4px; margin-bottom:20px;"></textarea>
                        <div style="display:flex; gap:10px;">
                            <button class="ui-btn ui-btn-primary" id="modal-approve">Approve & Forward</button>
                            <button class="ui-btn ui-btn-ghost" id="modal-reject" style="color:var(--danger);">Reject Application</button>
                            <button class="ui-btn ui-btn-ghost" id="modal-close">Exit</button>
                        </div>
                    ` : `
                        <div style="padding:15px; background:var(--bg-light); border-radius:8px; margin-bottom:20px; font-size:0.8rem;">
                            <strong>Institutional Note:</strong> You are viewing this application as an Internship Coordinator. Approval is managed by the Mentor -> HOD -> TPO pipeline.
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="ui-btn ui-btn-primary" id="modal-close" style="width:100%;">Close Viewer</button>
                        </div>
                    `}
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('modal-close').onclick = () => document.getElementById('modal-overlay').remove();

        if (isApprover) {
            document.getElementById('modal-approve').onclick = (e) => {
                e.target.disabled = true;
                const cmd = document.getElementById('review-comment').value || 'Approved';
                const handler = ApproverMap[u.role];
                handler.handle(app, 'APPROVE', cmd);

                // Persist the state transition to DB + localStorage immediately
                Store.sync('applications');

                document.getElementById('modal-overlay').remove();

                // Notify correct next role in the Mentor → HOD → TPO chain
                if (u.role === 'mentor') {
                    this.toast('Approved ✓ — Forwarded to HOD', 'success');
                    Store.addNotif(`📋 OD review needed: ${app.studentName} @ ${app.company} (approved by Mentor)`, 'info', 'hod');
                    Store.addNotif(`✅ Your OD for ${app.company} was approved by your Mentor — now pending HOD`, 'success', 'student');
                } else if (u.role === 'hod') {
                    this.toast('Approved ✓ — Forwarded to TPO', 'success');
                    Store.addNotif(`📋 OD review needed: ${app.studentName} @ ${app.company} (approved by HOD)`, 'info', 'tpo');
                    Store.addNotif(`✅ Your OD for ${app.company} was approved by HOD — now pending TPO`, 'success', 'student');
                } else if (u.role === 'tpo') {
                    this.toast('🎉 OD Fully Granted!', 'success');
                    Store.addNotif(`🎉 Your OD application for ${app.company} has been FULLY GRANTED!`, 'success', 'student');
                    Store.addNotif(`✅ OD for ${app.studentName} @ ${app.company} granted by TPO`, 'success', 'coordinator');
                    Store.addNotif(`✅ OD for ${app.studentName} @ ${app.company} granted by TPO`, 'success', 'mentor');
                    Store.addNotif(`✅ OD for ${app.studentName} @ ${app.company} granted by TPO`, 'success', 'hod');
                }

                // Re-render applications view so pipeline updates live
                this.renderView('applications');
            };

            document.getElementById('modal-reject').onclick = (e) => {
                e.target.disabled = true;
                const cmd = document.getElementById('review-comment').value || 'Rejected by reviewer';
                const handler = ApproverMap[u.role];
                handler.handle(app, 'REJECT', cmd);

                // Persist the state transition
                Store.sync('applications');

                document.getElementById('modal-overlay').remove();
                this.toast('Application rejected', 'danger');
                Store.addNotif(`❌ Your OD for ${app.company} was rejected by ${u.role.toUpperCase()}${cmd !== 'Rejected by reviewer' ? ' — Reason: ' + cmd : ''}`, 'danger', 'student');
                this.renderView('applications');
            };
        }
    },

    toast(msg, type = 'info') {
        const c = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.style = `padding:15px 25px; border-radius:8px; background:${type === 'danger' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--primary)'}; color:white; margin-bottom:10px; box-shadow:0 4px 12px rgba(0,0,0,0.2); animation:slideInUp 0.3s forwards;`;
        t.innerHTML = `<strong>${type.toUpperCase()}:</strong> ${msg}`;
        c.appendChild(t);
        setTimeout(() => t.remove(), 4000);
    },

    updateNotifBadge() {
        const u = Store.getUser();
        if (!u) return;
        const count = Store.getNotifs(u.role).length;
        document.getElementById('header-notif-count').textContent = count;
    }
};

window.UI = UI;
document.addEventListener('DOMContentLoaded', () => UI.init());
