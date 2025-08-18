/* ======================== MAIN APPLICATION ======================== */
/**
 * Main Application module - Initialization and event coordination
 * Handles DOMContentLoaded setup, event listeners, and module coordination
 */

// Import all necessary modules
import { clearSession } from './config.js';
import { initTwinViewer }  from './digital-twin.js';
import {
    emailInput, passwordInput, btnLogin, userInfoBtn, userDropdown, btnLogout, 
    usersTab, rolesTab, auditTab, settingsTab, orionTab, digitalTwinTab,
    refreshUsers, refreshLogs, btnApplyFilter, btnClearFilter,
    btnCreate, togglePassword, toggleNewPassword, newPassword
} from './dom-elements.js';
import { 
    showDropdown, resetApp, switchTab, togglePasswordVisibility 
} from './ui-helpers.js';
import { handleLogin, handleLoginKeyPress } from './auth.js';
import { refreshUsersList, handleCreateUser } from './users.js';
import { refreshLogsList, applyLogsFilter, clearLogsFilter } from './orion-logs.js';

/**
 * Initialize the application when DOM is fully loaded
 */
function initializeApp() {
    setupTabNavigation();
    setupPasswordToggleHandlers();
    setupUserMenuHandlers();
    setupFilterHandlers();
    setupRefreshHandlers();
    setInterval(refreshLogsList, 1000);
    setupAuthenticationHandlers();
    setupUserManagementHandlers();
    initTwinViewer(); 

    // Clear any existing session on page load
    clearSession();

    console.log("Digital Twin Security Portal initialized successfully");
}

/**
 * Set up tab navigation event listeners
 */
function setupTabNavigation() {
    usersTab.onclick = () => switchTab("users");
    rolesTab.onclick = () => switchTab("roles");
    auditTab.onclick = () => switchTab("audit");
    settingsTab.onclick = () => switchTab("settings");
    orionTab.onclick = () => switchTab("orion");
    digitalTwinTab.onclick = () => switchTab("digitalTwin");
}

/**
 * Set up password toggle functionality
 */
function setupPasswordToggleHandlers() {
    togglePassword.onclick = function () {
        togglePasswordVisibility(passwordInput, this);
    };

    toggleNewPassword.onclick = function () {
        togglePasswordVisibility(newPassword, this);
    };
}

/**
 * Set up user menu dropdown handlers
 */
function setupUserMenuHandlers() {
    userInfoBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showDropdown(userDropdown.classList.contains("hidden"));
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", () => showDropdown(false));

    // Logout handler
    btnLogout.addEventListener("click", resetApp);
}

/**
 * Set up filter functionality for logs
 */
function setupFilterHandlers() {
    btnApplyFilter.onclick = applyLogsFilter;
    btnClearFilter.onclick = clearLogsFilter;
}

/**
 * Set up refresh button handlers
 */
function setupRefreshHandlers() {
    refreshUsers.onclick = refreshUsersList;
    refreshLogs.onclick = refreshLogsList;
}

/**
 * Set up authentication-related event listeners
 */
function setupAuthenticationHandlers() {
    btnLogin.onclick = handleLogin;

    // Enter key support for login form
    emailInput.addEventListener('keypress', handleLoginKeyPress);
    passwordInput.addEventListener('keypress', handleLoginKeyPress);
}

/**
 * Set up user management handlers
 */
function setupUserManagementHandlers() {
    btnCreate.onclick = handleCreateUser;
}

/**
 * Handle application errors globally
 * @param {Error} error - The error that occurred
 * @param {string} context - Context where the error occurred
 */
export function handleAppError(error, context = 'Application') {
    console.error(`${context} Error:`, error);

    // We can add user-friendly error display here
    // For example, show a toast notification or error banner
}

/**
 * Initialize the application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', initializeApp);

// Export for potential external use
export { initializeApp };
