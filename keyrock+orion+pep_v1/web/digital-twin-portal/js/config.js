/* ======================== CONFIGURATION ======================== */
/**
 * Configuration file for Digital Twin Security Portal
 * Contains all API endpoints, service parameters, and global constants
 */

// API Base URLs
export const KEYROCK_BASE = "http://localhost:3005";
export const ORION_BASE = "http://localhost:1027";

// IoT Agent configuration (HTTP bindings)
export const IOT_AGENT_BASE = "http://localhost:4042";
export const IOT_AGENT_CBROKER = "http://orion-v2:1026"; // internal URL the IoT Agent sees
export const IOT_AGENT_RESOURCE = "/iot/json"; // default only (actual resource comes from service group)
export const IOT_AGENT_TRANSPORT = "MQTT";
export const IOT_AGENT_PROTOCOL = "IoTA-JSON";

// OAuth2 client from Keyrock → OAuth2 Credentials
export const KEYROCK_CLIENT_ID = "YOUR_KEYROCK_CLIENT_ID";
export const KEYROCK_CLIENT_SECRET = "YOUR_KEYROCK_CLIENT_SECRET";

// FIWARE Service Configuration
export const FIWARE_SERVICE = "openiot"; // change if needed
export const FIWARE_SERVICEPATH = "/";

// Entity Configuration
export const ENTITY_TYPE = "Machine"; // default only (actual resource comes from service group)

// Application State
export let sessionToken = "";
export let currentUserEmail = "";

// NEW: keystone admin token (X-Subject_Token)
export let keystoneToken = "";

const STORAGE_KEYS = {
    sessionToken: "dtp.sessionToken",
    userEmail: "dtp.userEmail",
    keystoneToken: "dtp.keystoneToken"
};

const storageRef = (() => {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage;
    } catch (_err) {
        return null;
    }
})();

function storageAvailable() {
    return Boolean(storageRef);
}

function persistValue(key, value) {
    if (!storageAvailable()) return;
    try {
        if (value !== undefined && value !== null && String(value).length) {
            storageRef.setItem(key, String(value));
        } else {
            storageRef.removeItem(key);
        }
    } catch (err) {
        console.warn("Unable to persist session data:", err);
    }
}

function readValue(key) {
    if (!storageAvailable()) return "";
    try {
        return storageRef.getItem(key) || "";
    } catch (err) {
        console.warn("Unable to read session data:", err);
        return "";
    }
}

// State setters (to maintain encapsulation)
export function setSessionToken(token) {
    sessionToken = token ? String(token) : "";
    persistValue(STORAGE_KEYS.sessionToken, sessionToken);
}

export function setCurrentUserEmail(email) {
    currentUserEmail = email ? String(email) : "";
    persistValue(STORAGE_KEYS.userEmail, currentUserEmail);
}

export function setKeystoneToken(token) {
    keystoneToken = token ? String(token) : "";
    persistValue(STORAGE_KEYS.keystoneToken, keystoneToken);
}

export function clearSession() {
    sessionToken = "";
    currentUserEmail = "";
    keystoneToken = "";
    if (!storageAvailable()) return;
    try {
        storageRef.removeItem(STORAGE_KEYS.sessionToken);
        storageRef.removeItem(STORAGE_KEYS.userEmail);
        storageRef.removeItem(STORAGE_KEYS.keystoneToken);
    } catch (err) {
        console.warn("Unable to clear persisted session data:", err);
    }
}

export function restoreSessionFromStorage() {
    if (!storageAvailable()) {
        return { sessionToken, currentUserEmail, keystoneToken };
    }

    const storedToken = readValue(STORAGE_KEYS.sessionToken);
    const storedEmail = readValue(STORAGE_KEYS.userEmail);
    const storedKeystone = readValue(STORAGE_KEYS.keystoneToken);

    setSessionToken(storedToken);
    setCurrentUserEmail(storedEmail);
    setKeystoneToken(storedKeystone);

    return {
        sessionToken,
        currentUserEmail,
        keystoneToken
    };
}
