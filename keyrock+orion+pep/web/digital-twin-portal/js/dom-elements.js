/* ======================== DOM ELEMENTS ======================== */
/**
 * DOM Elements module - Centralized element references
 * All getElementById calls and element caching
 */

// Login Section Elements
export const loginSection = document.getElementById("loginSection");
export const emailInput = document.getElementById("email");
export const passwordInput = document.getElementById("password");
export const btnLogin = document.getElementById("btnLogin");
export const loginBtnText = document.getElementById("loginBtnText");
export const loginSpinner = document.getElementById("loginSpinner");
export const loginMsg = document.getElementById("loginMsg");

// User Menu Elements
export const userMenuWrapper = document.getElementById("userMenuWrapper");
export const userInfoBtn = document.getElementById("userInfo");
export const userDropdown = document.getElementById("userDropdown");
export const btnLogout = document.getElementById("btnLogout");
export const loggedInEmail = document.getElementById("loggedInEmail");

// Tab Navigation Elements
export const tabsNav = document.getElementById("tabsNav");
export const usersTab = document.getElementById("usersTab");
export const rolesTab = document.getElementById("rolesTab");
export const auditTab = document.getElementById("auditTab");
export const settingsTab = document.getElementById("settingsTab");
export const orionTab = document.getElementById("orionTab");
export const digitalTwinTab = document.getElementById("digitalTwinTab");

// Section Elements
export const usersSection = document.getElementById("usersSection");
export const rolesSection = document.getElementById("rolesSection");
export const auditSection = document.getElementById("auditSection");
export const settingsSection = document.getElementById("settingsSection");
export const orionSection = document.getElementById("orionSection");
export const digitalTwinSection  = document.getElementById("digitalTwinSection");

// User Management Elements
export const usersTableBody = document.getElementById("usersTableBody");
export const usersMessage = document.getElementById("usersMessage");
export const refreshUsers = document.getElementById("refreshUsers");

// Create User Form Elements
export const newUsername = document.getElementById("new_username");
export const newEmail = document.getElementById("new_email");
export const newPassword = document.getElementById("new_password");
export const newDescription = document.getElementById("new_description");
export const newWebsite = document.getElementById("new_website");
export const newEnable = document.getElementById("new_enable");
export const btnCreate = document.getElementById("btnCreate");
export const createMsg = document.getElementById("createMsg");

// Orion Logs Elements
export const logsTableBody = document.getElementById("logsTableBody");
export const logsMessage = document.getElementById("logsMessage");
export const refreshLogs = document.getElementById("refreshLogs");

// Filter Elements
export const deviceFilter = document.getElementById("deviceFilter");
export const attributeFilter = document.getElementById("attributeFilter");
export const btnApplyFilter = document.getElementById("btnApplyFilter");
export const btnClearFilter = document.getElementById("btnClearFilter");

// Password Toggle Elements (accessed by ID in functions)
export const togglePassword = document.getElementById("togglePassword");
export const toggleNewPassword = document.getElementById("toggleNewPassword");

// Create User Form Reference
export const createUserForm = document.getElementById("createUserForm");

// Machine and service gorup elements
export const inventoryTab = document.getElementById("inventoryTab");
export const inventorySection = document.getElementById("inventorySection");
export const serviceGroupForm = document.getElementById("serviceGroupForm");
export const serviceGroupApiKey = document.getElementById("serviceGroupApiKey");
export const serviceGroupCbroker = document.getElementById("serviceGroupCbroker");
export const serviceGroupResource = document.getElementById("serviceGroupResource");
export const serviceGroupEntityType = document.getElementById("serviceGroupEntityType");
export const serviceGroupName = document.getElementById("serviceGroupName");
export const serviceGroupDescription = document.getElementById("serviceGroupDescription");
export const serviceGroupMsg = document.getElementById("serviceGroupMsg");
export const serviceGroupsTableBody = document.getElementById("serviceGroupsTableBody");
export const serviceGroupCount = document.getElementById("serviceGroupCount");
export const machineForm = document.getElementById("machineForm");
export const machineDeviceId = document.getElementById("machineDeviceId");
export const machineName = document.getElementById("machineName");
export const machineModel = document.getElementById("machineModel");
export const machineDescription = document.getElementById("machineDescription");
export const machineServiceGroup = document.getElementById("machineServiceGroup");
export const machineStatus = document.getElementById("machineStatus");
export const attributeModeToggle = document.getElementById("attributeModeToggle");
export const attributeModeStatus = document.getElementById("attributeModeStatus");
export const attributeManualContainer = document.getElementById("attributeManualContainer");
export const attributeAutomaticContainer = document.getElementById("attributeAutomaticContainer");
export const machineAttributesManual = document.getElementById("machineAttributesManual");
export const attributeObjectId = document.getElementById("attributeObjectId");
export const attributeName = document.getElementById("attributeName");
export const attributeType = document.getElementById("attributeType");
export const attributeAddBtn = document.getElementById("attributeAddBtn");
export const attributeAutoList = document.getElementById("attributeAutoList");
export const staticAttributesModeToggle = document.getElementById("staticAttributesModeToggle");
export const staticAttributesModeStatus = document.getElementById("staticAttributesModeStatus");
export const staticAttributesManualContainer = document.getElementById("staticAttributesManualContainer");
export const machineStaticAttributesManual = document.getElementById("machineStaticAttributesManual");
export const staticAttributesAutomaticContainer = document.getElementById("staticAttributesAutomaticContainer");
export const staticAttributeName = document.getElementById("staticAttributeName");
export const staticAttributeType = document.getElementById("staticAttributeType");
export const staticAttributeValue = document.getElementById("staticAttributeValue");
export const staticAttributeAddBtn = document.getElementById("staticAttributeAddBtn");
export const staticAttributeAutoList = document.getElementById("staticAttributeAutoList");
export const machineMsg = document.getElementById("machineMsg");
export const machinesTableBody = document.getElementById("machinesTableBody");
export const machineCount = document.getElementById("machineCount");
