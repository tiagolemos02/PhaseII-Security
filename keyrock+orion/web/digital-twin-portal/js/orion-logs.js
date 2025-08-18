/* ======================== ORION LOGS ======================== */
/**
 * Orion Logs module - Orion API calls, logs fetching, and data processing
 * Handles device data retrieval, filtering, and rendering
 */

import { 
    ORION_BASE, FIWARE_SERVICE, FIWARE_SERVICEPATH, ENTITY_TYPE, sessionToken 
} from './config.js';
import {
    logsTableBody, logsMessage, deviceFilter, attributeFilter
} from './dom-elements.js';

// In-memory storage for logs filtering
let logsGrouped = [];
const expandedDeviceRows = new Set();

/**
 * Fetch and display logs from Orion Context Broker
 * Retrieves entity data and processes it for display
 */
export async function listLogs() {
    logsMessage.textContent = "";
    logsTableBody.innerHTML =
        "<tr><td colspan='5' class='px-6 py-4 text-center'><i class='fas fa-spinner loading-spinner text-indigo-600'></i></td></tr>";

    try {
        const t0 = performance.now();
        const resp = await fetch(
            `${ORION_BASE}/v2/entities?type=${ENTITY_TYPE}&options=keyValues`,
            {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "Fiware-Service": FIWARE_SERVICE,
                    "Fiware-ServicePath": FIWARE_SERVICEPATH,
                    ...(sessionToken && { "X-Auth-Token": sessionToken }),
                },
            }
        );

        const rtt = Math.round(performance.now() - t0); // Network RTT in ms

        if (!resp.ok) {
            logsMessage.textContent = `Orion error (HTTP ${resp.status})`;
            logsTableBody.innerHTML =
                "<tr><td colspan='5' class='px-6 py-4 text-center text-sm text-red-500'>Error loading logs</td></tr>";
            return;
        }

        const devices = await resp.json();

        if (!Array.isArray(devices) || !devices.length) {
            logsTableBody.innerHTML =
                "<tr><td colspan='5' class='px-6 py-4 text-center text-sm text-gray-500'>No devices found</td></tr>";
            return;
        }

        // Process and group the data
        logsGrouped = processDeviceData(devices);

        // Populate device filter dropdown
        populateDeviceFilter(logsGrouped);

        // Render the logs
        renderLogs(logsGrouped);

        // Show network performance info
        logsMessage.textContent = `Network RTT: ${rtt} ms`;
        logsMessage.className = "mt-3 text-sm text-gray-600";

    } catch (e) {
        console.error("Error fetching logs:", e);
        logsMessage.textContent = "Network error.";
        logsMessage.className = "mt-3 text-sm text-red-600";
        logsTableBody.innerHTML =
            "<tr><td colspan='5' class='px-6 py-4 text-center text-sm text-red-500'>Network error</td></tr>";
    }
}

/**
 * Process raw device data into grouped format for display
 * @param {Array} devices - Raw device data from Orion
 * @returns {Array} Processed device data with attributes
 */
function processDeviceData(devices) {
    const processed = [];
    const now = Date.now();

    devices.forEach((dev) => {
        const deviceEntry = { id: dev.id, attributes: [] };

        Object.entries(dev).forEach(([attr, val]) => {
            // Skip metadata fields
            if (["id", "type"].includes(attr)) return;
            if (attr.toLowerCase() === "timeinstant") return;

            // Extract timestamp information
            const attrTime = dev.TimeInstant ?? 
                (val.metadata && val.metadata.timestamp ? val.metadata.timestamp.value : null);

            const tsIso = attrTime ? new Date(attrTime).toISOString() : "-";
            const latency = attrTime ? Math.round(now - Date.parse(attrTime)) : "-";
            const value = val.value !== undefined ? val.value : val;

            deviceEntry.attributes.push({ 
                name: attr, 
                value, 
                time: tsIso, 
                latency 
            });
        });

        if (deviceEntry.attributes.length) {
            processed.push(deviceEntry);
        }
    });

    return processed;
}

/**
 * Populate the device filter dropdown with available devices
 * @param {Array} devices - Processed device data
 */
function populateDeviceFilter(devices) {
    deviceFilter.innerHTML = '<option value="">All devices</option>' +
        devices.map((d) => `<option value="${d.id}">${d.id}</option>`).join("");

    // Remove duplicate options
    const seen = new Set();
    [...deviceFilter.options].forEach((option) => {
        if (seen.has(option.value)) {
            option.remove();
        } else {
            seen.add(option.value);
        }
    });
}

/**
 * Render logs data in the table with expandable device rows
 * @param {Array} data - Processed device data to render
 */
export function renderLogs(data) {
    logsTableBody.innerHTML = "";

    if (!data.length) {
        logsTableBody.innerHTML =
            "<tr><td colspan='5' class='px-6 py-4 text-center text-sm text-gray-500'>No data</td></tr>";
        return;
    }

    data.forEach((device, idx) => {
        // Create device header row
        const deviceRow = createDeviceRow(device, idx);
        logsTableBody.appendChild(deviceRow);

        // Create attribute rows (initially hidden)
        device.attributes.forEach((attr) => {
            const attrRow = createAttributeRow(attr, idx);
            // Show if previously expanded
            if (expandedDeviceRows.has(idx)) {
                attrRow.classList.remove("hidden");
            }
            logsTableBody.appendChild(attrRow);
        });

        // Rotate arrow if expanded
        if (expandedDeviceRows.has(idx)) {
            setTimeout(() => {
                const arrow = document.getElementById(`arrow-${idx}`);
                arrow?.classList.add("rotate-90");
            }, 0);
        }
    });
}

/**
 * Create a device header row
 * @param {Object} device - Device data
 * @param {number} idx - Device index
 * @returns {HTMLElement} Device row element
 */
function createDeviceRow(device, idx) {
    const devRow = document.createElement("tr");
    devRow.classList.add("device-row", "bg-indigo-50");
    devRow.innerHTML = `
        <td colspan="5" class="px-6 py-4 font-medium text-sm">
            <i id="arrow-${idx}" class="fas fa-chevron-right arrow-icon mr-2"></i>${device.id}
        </td>`;

    // Add click handler for expand/collapse
    devRow.onclick = () => toggleDeviceAttributes(idx);

    return devRow;
}

/**
 * Create an attribute row
 * @param {Object} attr - Attribute data
 * @param {number} idx - Device index
 * @returns {HTMLElement} Attribute row element
 */
function createAttributeRow(attr, idx) {
    const attrRow = document.createElement("tr");
    attrRow.classList.add(`attr-${idx}`, "hidden");
    attrRow.innerHTML = `
        <td class='px-6 py-4 text-sm'></td>
        <td class='px-6 py-4 text-sm'>${attr.name}</td>
        <td class='px-6 py-4 text-sm'>${attr.value}</td>
        <td class='px-6 py-4 text-sm'>${attr.time}</td>
        <td class='px-6 py-4 text-sm'>${attr.latency}</td>`;

    return attrRow;
}

/**
 * Toggle visibility of device attributes
 * @param {number} idx - Device index
 */
function toggleDeviceAttributes(idx) {
    const isExpanded = expandedDeviceRows.has(idx);
    const rows = document.querySelectorAll(`.attr-${idx}`);
    const arrow = document.getElementById(`arrow-${idx}`);

    if (isExpanded) {
        rows.forEach(row => row.classList.add("hidden"));
        arrow?.classList.remove("rotate-90");
        expandedDeviceRows.delete(idx);
    } else {
        rows.forEach(row => row.classList.remove("hidden"));
        arrow?.classList.add("rotate-90");
        expandedDeviceRows.add(idx);
    }
}

/**
 * Apply filters to the logs display
 */
export function applyLogsFilter() {
    const deviceValue = deviceFilter.value;
    const attributeValue = attributeFilter.value.trim().toLowerCase();

    const filtered = logsGrouped
        .filter((device) => (!deviceValue || device.id === deviceValue))
        .map((device) => ({
            ...device,
            attributes: device.attributes.filter((attr) => 
                attr.name.toLowerCase().includes(attributeValue)
            ),
        }))
        .filter((device) => device.attributes.length);

    renderLogs(filtered);
}

/**
 * Clear all filters and show all logs
 */
export function clearLogsFilter() {
    deviceFilter.value = "";
    attributeFilter.value = "";
    renderLogs(logsGrouped);
}

/**
 * Refresh the logs data
 */
export function refreshLogsList() {
    listLogs();
}
