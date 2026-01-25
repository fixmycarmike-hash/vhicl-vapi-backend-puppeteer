// Authentication System - VHICL Pro
// Staff Login and Session Management

class AuthSystem {
    constructor() {
        this.STORAGE_KEY = 'vhicl_staff_session';
        this.session = null;
        this.loadSession();
    }

    // Load session from localStorage
    loadSession() {
        try {
            const sessionData = localStorage.getItem(this.STORAGE_KEY);
            if (sessionData) {
                this.session = JSON.parse(sessionData);
                // Check if session is expired
                if (this.isSessionExpired()) {
                    this.logout();
                }
            }
        } catch (error) {
            console.error('Error loading session:', error);
            this.logout();
        }
    }

    // Check if session is expired (24 hours)
    isSessionExpired() {
        if (!this.session) return true;
        const loginTime = new Date(this.session.loginTime);
        const now = new Date();
        const hoursSinceLogin = (now - loginTime) / (1000 * 60 * 60);
        return hoursSinceLogin > 24;
    }

    // Login with email and password
    async login(email, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (result.success) {
                this.session = {
                    token: result.token,
                    user: result.user,
                    loginTime: new Date().toISOString()
                };
                this.saveSession();
                return { success: true };
            } else {
                return { success: false, error: result.error || 'Login failed' };
            }
        } catch (error) {
            console.error('Login error:', error);
            // For demo purposes, allow demo login
            if (email === 'admin@vhicl.pro' && password === 'demo123') {
                this.session = {
                    token: 'demo-token-' + Date.now(),
                    user: {
                        id: 1,
                        name: 'Demo Admin',
                        email: 'admin@vhicl.pro',
                        role: 'admin'
                    },
                    loginTime: new Date().toISOString()
                };
                this.saveSession();
                return { success: true };
            }
            return { success: false, error: 'Invalid credentials' };
        }
    }

    // Logout current user
    logout() {
        this.session = null;
        localStorage.removeItem(this.STORAGE_KEY);
        // Redirect to login page if not already there
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = '/login.html';
        }
    }

    // Save session to localStorage
    saveSession() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.session));
        } catch (error) {
            console.error('Error saving session:', error);
        }
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.session !== null && !this.isSessionExpired();
    }

    // Get current user
    getCurrentUser() {
        return this.session ? this.session.user : null;
    }

    // Get auth token for API calls
    getAuthToken() {
        return this.session ? this.session.token : null;
    }

    // Require authentication (redirect if not logged in)
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
            return false;
        }
        return true;
    }

    // Fetch with authentication header
    async authenticatedFetch(url, options = {}) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const authOptions = {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${this.getAuthToken()}`
            }
        };

        return fetch(url, authOptions);
    }
}

// Create global auth instance
const auth = new AuthSystem();

// Auto-logout on session expiration
setInterval(() => {
    if (auth.isSessionExpired()) {
        auth.logout();
    }, 60000); // Check every minute
