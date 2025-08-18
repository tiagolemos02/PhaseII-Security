/* ======================== CONFIGURATION ======================== */
/**
 * Configuration file for Digital Twin Security Portal
 * Contains all API endpoints, service parameters, and global constants
 */

// API Base URLs
export const KEYROCK_BASE = "http://localhost:3005";
export const ORION_BASE = "http://localhost:1026"; // in the future will be Wilma on 1027

// FIWARE Service Configuration
export const FIWARE_SERVICE = "openiot"; // change if needed
export const FIWARE_SERVICEPATH = "/";

// Entity Configuration
export const ENTITY_TYPE = "Machine";

// Application State
export let sessionToken = "";
export let currentUserEmail = "";

// State setters (to maintain encapsulation)
export function setSessionToken(token) {
    sessionToken = token;
}

export function setCurrentUserEmail(email) {
    currentUserEmail = email;
}

export function clearSession() {
    sessionToken = "";
    currentUserEmail = "";
}
