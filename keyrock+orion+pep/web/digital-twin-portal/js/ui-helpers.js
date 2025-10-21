/* ======================== UI HELPERS ======================== */
/**
 * UI Helper functions for interface management
 * Tab switching, dropdown handling, and general UI interactions
 */

import {
    userDropdown, usersTab, rolesTab, auditTab, settingsTab, orionTab, digitalTwinTab, inventoryTab, 
    usersSection, rolesSection, auditSection, settingsSection, orionSection, digitalTwinSection, inventorySection
} from './dom-elements.js';

/**
 * Show/hide dropdown menu
 * @param {boolean} show - Whether to show the dropdown
 */
export function showDropdown(show = true) {
    userDropdown.classList.toggle("hidden", !show);
}

/**
 * Reset the entire application (reload page)
 */
export function resetApp() {
    location.reload();
}

/**
 * Clear active styles from all tab buttons
 */
export function clearTabButtonStyles() {
    [usersTab, rolesTab, auditTab, settingsTab, orionTab, digitalTwinTab, inventoryTab].forEach((btn) => {
        btn.classList.remove("tab-active", "text-indigo-600");
        btn.classList.add("text-gray-500", "border-transparent");
    });
}

/**
 * Hide all content sections
 */
export function hideAllSections() {
    usersSection.classList.add("hidden");
    rolesSection.classList.add("hidden");
    auditSection.classList.add("hidden");
    settingsSection.classList.add("hidden");
    orionSection.classList.add("hidden");
    digitalTwinSection.classList.add("hidden");
    inventorySection.classList.add("hidden");
}

/**
 * Switch between different tabs in the interface
 * @param {string} name - Tab name to switch to
 */
export function switchTab(name) {
    clearTabButtonStyles();
    hideAllSections();

    switch (name) {
        case "users":
            usersTab.classList.add("tab-active", "text-indigo-600");
            usersSection.classList.remove("hidden");
            break;
        case "roles":
            rolesTab.classList.add("tab-active", "text-indigo-600");
            rolesSection.classList.remove("hidden");
            break;
        case "audit":
            auditTab.classList.add("tab-active", "text-indigo-600");
            auditSection.classList.remove("hidden");
            break;
        case "settings":
            settingsTab.classList.add("tab-active", "text-indigo-600");
            settingsSection.classList.remove("hidden");
            break;
        case "orion":
            orionTab.classList.add("tab-active", "text-indigo-600");
            orionSection.classList.remove("hidden");
            break;
        case "digitalTwin":
            digitalTwinTab.classList.add("tab-active", "text-indigo-600");
            digitalTwinSection.classList.remove("hidden");
            break;
        case "inventory":
            inventoryTab.classList.add("tab-active", "text-indigo-600");
            inventorySection.classList.remove("hidden");
            break;
    }
}

/**
 * Toggle password visibility in input fields
 * @param {HTMLElement} passwordField - The password input field
 * @param {HTMLElement} toggleIcon - The toggle icon element
 */
export function togglePasswordVisibility(passwordField, toggleIcon) {
    passwordField.type = passwordField.type === "password" ? "text" : "password";
    toggleIcon.classList.toggle("fa-eye");
    toggleIcon.classList.toggle("fa-eye-slash");
}

/**
 * Enable/disable form inputs
 * @param {HTMLElement[]} elements - Array of form elements to enable/disable
 * @param {boolean} enabled - Whether to enable the elements
 */
export function setElementsEnabled(elements, enabled) {
    elements.forEach((el) => (el.disabled = !enabled));
}
