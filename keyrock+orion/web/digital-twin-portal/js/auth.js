/* ======================== AUTHENTICATION ======================== */
/**
 * Authentication module - Login handling and session management
 * Handles user authentication, token management, and session state
 */

import { KEYROCK_BASE, setSessionToken, setCurrentUserEmail } from './config.js';
import {
    emailInput, passwordInput, loginBtnText, loginSpinner, btnLogin,
    loginMsg, userMenuWrapper, loggedInEmail, loginSection, tabsNav,
    usersSection, newUsername, newEmail, newPassword, newDescription,
    newWebsite, newEnable, btnCreate
} from './dom-elements.js';
import { setElementsEnabled, switchTab } from './ui-helpers.js';
import { listUsers } from './users.js';
import { listLogs } from './orion-logs.js';

/**
 * Handle user login process
 * Authenticates user credentials and sets up authenticated UI state
 */
export async function handleLogin() {
    loginMsg.textContent = "";
    const email = emailInput.value.trim();
    const pwd = passwordInput.value.trim();

    if (!email || !pwd) {
        loginMsg.textContent = "Please enter both email and password.";
        return;
    }

    // Show loading state
    loginBtnText.textContent = "Authenticating…";
    loginSpinner.classList.remove("hidden");
    btnLogin.disabled = true;

    try {
        const resp = await fetch(`${KEYROCK_BASE}/v1/auth/tokens`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: email, password: pwd }),
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            loginMsg.textContent = err.error?.message || "Authentication failed.";
            return;
        }

        const token = resp.headers.get("X-Subject-Token") || "";
        if (!token) {
            loginMsg.textContent = "No token received.";
            return;
        }

        // Set session state
        setSessionToken(token);
        setCurrentUserEmail(email);

        // Update UI to authenticated state
        await setupAuthenticatedUI(email);

    } catch (e) {
        console.error("Login error:", e);
        loginMsg.textContent = "Network error.";
    } finally {
        // Reset button state
        loginBtnText.textContent = "Sign In";
        loginSpinner.classList.add("hidden");
        btnLogin.disabled = false;
    }
}

/**
 * Set up the UI for authenticated state
 * @param {string} email - User email to display
 */
async function setupAuthenticatedUI(email) {
    // Show authenticated UI elements
    userMenuWrapper.classList.remove("hidden");
    loggedInEmail.textContent = email;
    loginSection.classList.add("hidden");
    tabsNav.classList.remove("hidden");
    usersSection.classList.remove("disabled-section");

    // Enable form inputs
    const formElements = [
        newUsername, newEmail, newPassword, newDescription,
        newWebsite, newEnable, btnCreate
    ];
    setElementsEnabled(formElements, true);

    // Load initial data
    listUsers();
    await listLogs();
    switchTab("users");
}

/**
 * Check if user is currently authenticated
 * @returns {boolean} True if authenticated
 */
export function isAuthenticated() {
    return Boolean(sessionToken);
}

/**
 * Handle Enter key press for login form
 * @param {Event} e - Keyboard event
 */
export function handleLoginKeyPress(e) {
    if (e.key === 'Enter') {
        handleLogin();
    }
}
