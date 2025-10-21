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
export const KEYROCK_CLIENT_ID = "43507ed7-6eb9-4d85-820a-28fe8b8451f9";
export const KEYROCK_CLIENT_SECRET = "8a1b818a-3e8e-4e85-8ae8-636eaa0b5808";

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

// State setters (to maintain encapsulation)
export function setSessionToken(token) {
    sessionToken = token;
}

export function setCurrentUserEmail(email) {
    currentUserEmail = email;
}

export function setKeystoneToken(token) {
    keystoneToken = token || "";
}

export function clearSession() {
    sessionToken = "";
    currentUserEmail = "";
    keystoneToken = "";
}
