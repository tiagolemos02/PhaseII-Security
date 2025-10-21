/* ======================== USER MANAGEMENT ======================== */
/**
 * User Management module - User listing, creation, and management functions
 * Handles all user-related operations and table rendering
 */

import { KEYROCK_BASE, /*sessionToken*/ keystoneToken } from './config.js';
import {
    usersTableBody, usersMessage, newUsername, newEmail, newPassword,
    newDescription, newWebsite, newEnable, createMsg, createUserForm
} from './dom-elements.js';

/**
 * List all users from Keyrock API
 * Fetches user data and renders it in the users table
 */
export async function listUsers() {
    usersMessage.textContent = "";
    usersTableBody.innerHTML =
        "<tr><td colspan='5' class='px-6 py-4 text-center'><i class='fas fa-spinner loading-spinner text-indigo-600'></i></td></tr>";

   /* if (!sessionToken) {
        usersMessage.textContent = "Please login first.";
        usersTableBody.innerHTML =
            "<tr><td colspan='5' class='px-6 py-4 text-center text-sm text-gray-500'>Please sign in to view users</td></tr>";
        return;
    }*/

    if (!keystoneToken || !keystoneToken.trim()) {
    usersMessage.textContent = "Admin session not available. Please re-login with an admin user.";
    usersTableBody.innerHTML = "<tr><td colspan='5' class='px-6 py-4 text-center text-sm text-gray-500'>Admin token missing</td></tr>";
    return;
  }
  console.debug("Using Keystone X-Auth-Token length:", keystoneToken.length);

    try {
        const resp = await fetch(`${KEYROCK_BASE}/v1/users`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "X-Auth-Token": keystoneToken,
                //"Authorization": `Bearer ${sessionToken}`,
            },
        });

        if (!resp.ok) {
            const body = await resp.text().catch(()=> "");
            console.error("Keyrock /v1/users error:", resp.status, body);
            usersMessage.textContent = `Error listing users (HTTP ${resp.status})`;
            usersTableBody.innerHTML =
                "<tr><td colspan='5' class='px-6 py-4 text-center text-sm text-red-500'>Error loading users</td></tr>";
            return;
        }

        const data = await resp.json();
        renderUsersTable(data.users);

    } catch (e) {
        console.error("Error listing users:", e);
        usersMessage.textContent = "Network error.";
        usersTableBody.innerHTML =
            "<tr><td colspan='5' class='px-6 py-4 text-center text-sm text-red-500'>Network error</td></tr>";
    }
}

/**
 * Render users data in the table
 * @param {Array} users - Array of user objects
 */
function renderUsersTable(users) {
    if (!Array.isArray(users) || !users.length) {
        usersTableBody.innerHTML =
            "<tr><td colspan='5' class='px-6 py-4 text-center text-sm text-gray-500'>No users found</td></tr>";
        return;
    }

    usersTableBody.innerHTML = "";
    users.forEach((user) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class='px-6 py-4 text-sm whitespace-nowrap'>${user.id}</td>
            <td class='px-6 py-4 text-sm'>${user.username}</td>
            <td class='px-6 py-4 text-sm'>${user.email}</td>
            <td class='px-6 py-4'>${renderUserStatus(user.enabled)}</td>
            <td class='px-6 py-4 text-sm'>-</td>`;
        usersTableBody.appendChild(tr);
    });
}

/**
 * Render user status badge
 * @param {boolean} enabled - Whether the user is enabled
 * @returns {string} HTML for status badge
 */
function renderUserStatus(enabled) {
    return enabled
        ? "<span class='status-badge status-active'>Active</span>"
        : "<span class='status-badge status-inactive'>Inactive</span>";
}

/**
 * Handle user creation
 * Creates a new user with the provided form data
 */
export async function handleCreateUser() {
    createMsg.textContent = "";
    createMsg.className = "mt-3 text-sm text-red-600"; // Reset to error styling

    /*if (!sessionToken) {
        createMsg.textContent = "Please login first.";
        return;
    }*/

     if (!keystoneToken || !keystoneToken.trim()) {
    createMsg.textContent = "Admin session not available.";
    return;
  }

    // Validate required fields
    const userData = {
        username: newUsername.value.trim(),
        email: newEmail.value.trim(),
        password: newPassword.value.trim(),
        description: newDescription.value.trim(),
        website: newWebsite.value.trim(),
        enabled: newEnable.checked
    };

    if (!userData.username || !userData.email || !userData.password) {
        createMsg.textContent = "Username, email and password are required.";
        return;
    }

    try {
        const resp = await fetch(`${KEYROCK_BASE}/v1/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Auth-Token": keystoneToken,
                //"Authorization": `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({ user: userData }),
        });

        if (resp.status === 201) {
            // Success
            createMsg.classList.remove("text-red-600");
            createMsg.classList.add("text-green-600");
            createMsg.textContent = "User created successfully!";
            createUserForm.reset();
            listUsers(); // Refresh the users list
            return;
        }

        // Error handling
        const err = await resp.json().catch(() => ({}));
        createMsg.textContent = "Error creating user: " + (err.error?.message || resp.statusText);

    } catch (e) {
        console.error("Error creating user:", e);
        createMsg.textContent = "Network error.";
    }
}

/**
 * Refresh the users list
 */
export function refreshUsersList() {
    listUsers();
}
