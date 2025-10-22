import {
  serviceGroupForm,
  serviceGroupApiKey,
  serviceGroupCbroker,
  serviceGroupResource,
  serviceGroupEntityType,
  serviceGroupName,
  serviceGroupDescription,
  serviceGroupMsg,
  serviceGroupsTableBody,
  serviceGroupCount,
  machineForm,
  machineDeviceId,
  machineName,
  machineModel,
  machineDescription,
  machineServiceGroup,
  machineStatus,
  attributeModeToggle,
  attributeModeKnob,
  attributeManualContainer,
  attributeAutomaticContainer,
  machineAttributesManual,
  attributeObjectId,
  attributeName,
  attributeType,
  attributeAddBtn,
  attributeAutoList,
  staticAttributesModeToggle,
  staticAttributesModeKnob,
  staticAttributesManualContainer,
  machineStaticAttributesManual,
  staticAttributesAutomaticContainer,
  staticAttributeName,
  staticAttributeType,
  staticAttributeValue,
  staticAttributeAddBtn,
  staticAttributeAutoList,
  machineMsg,
  machinesTableBody,
  machineCount
} from './dom-elements.js';
import {
  IOT_AGENT_BASE,
  IOT_AGENT_CBROKER,
  IOT_AGENT_RESOURCE,
  IOT_AGENT_TRANSPORT,
  IOT_AGENT_PROTOCOL,
  FIWARE_SERVICE,
  FIWARE_SERVICEPATH,
  ENTITY_TYPE,
  sessionToken,
  keystoneToken
} from './config.js';
import {
  refreshDeviceActivity,
  getDeviceActivity,
  getLastActivityFetchTime
} from './device-activity.js';

let serviceGroups = [];
let machines = [];
let loadingServiceGroups = false;
let loadingMachines = false;
const ACTIVITY_REFRESH_MIN_INTERVAL_MS = 30 * 1000;
const MACHINE_STATUS_REFRESH_INTERVAL_MS = 60 * 1000;
let machineStatusIntervalId = null;
let telemetryAttributeEntries = [];
let staticAttributeEntries = [];
let telemetryInputMode = 'manual';
let staticAttributesInputModeState = 'manual';
const MANUAL_GRADIENT = ['#1E3A8A', '#4C51BF'];
const AUTOMATIC_GRADIENT = ['#10B981', '#34D399'];

const FIWARE_CONTEXT_BROKER_URLS = Array.from(
  new Set(
    [
      'http://orion:1026',
      'http://orion-v2:1026',
      'http://orion-ld:1026',
      'https://orion.lab.fiware.org:1026',
      'https://orion-ld.lab.fiware.org:1026',
      IOT_AGENT_CBROKER
    ]
      .filter(Boolean)
      .map((url) => url.trim())
  )
);

const NORMALIZED_ALLOWED_CBROKER_URLS = new Set(
  FIWARE_CONTEXT_BROKER_URLS.map((url) => normalizeCbrokerUrl(url))
);

const ALLOWED_CBROKER_DISPLAY = FIWARE_CONTEXT_BROKER_URLS.join(', ');

function getBrokerLabel(value) {
  if (!value) return '-';
  try {
    const parsed = new URL(value);
    return parsed.hostname || '-';
  } catch (_err) {
    const raw = String(value).replace(/^https?:\/\//i, '');
    const segment = raw.split(/[/:]/)[0];
    return segment || '-';
  }
}

/**
 * Initialise inventory module: load current state and wire form handlers.
 */
export function initInventory() {
  serviceGroupForm?.addEventListener('submit', handleServiceGroupSubmit);
  machineForm?.addEventListener('submit', handleMachineSubmit);
  serviceGroupName?.addEventListener('blur', populateApikeyFromName);
  serviceGroupsTableBody?.addEventListener('click', handleServiceGroupTableClick);
  machinesTableBody?.addEventListener('click', handleMachinesTableClick);
  if (typeof window !== 'undefined') {
    window.addEventListener('device-activity-updated', handleDeviceActivityUpdated);
  }
  setupToggleControl({
    toggleElement: attributeModeToggle,
    getMode: () => telemetryInputMode,
    setMode: (mode) => {
      updateAttributeInputMode(mode);
      hideMessage(machineMsg);
    },
    preview: previewTelemetryProgress
  });
  setupToggleControl({
    toggleElement: staticAttributesModeToggle,
    getMode: () => staticAttributesInputModeState,
    setMode: (mode) => {
      updateStaticAttributeInputMode(mode);
      hideMessage(machineMsg);
    },
    preview: previewStaticProgress
  });
  attributeAddBtn?.addEventListener('click', handleAddTelemetryAttribute);
  staticAttributeAddBtn?.addEventListener('click', handleAddStaticAttribute);
  attributeAutoList?.addEventListener('click', handleTelemetryAttributeListClick);
  staticAttributeAutoList?.addEventListener('click', handleStaticAttributeListClick);

  applyServiceDefaults();
  initializeAttributeInputs();
  startMachineStatusTicker();
  void loadInventory();
}

/**
 * Public helper to reload inventory data on demand.
 */
export function refreshInventory() {
  return loadInventory();
}

/**
 * Load service groups and devices from the IoT Agent.
 */
async function loadInventory() {
  if (!sessionToken) {
    renderLoginRequiredState();
    return;
  }

  await fetchServiceGroups();
  renderServiceGroups();
  refreshServiceGroupOptions();

  await fetchMachines();
  renderMachines();
}

function startMachineStatusTicker() {
  if (machineStatusIntervalId || typeof setInterval !== 'function') return;
  if (!machinesTableBody) return;

  machineStatusIntervalId = setInterval(() => {
    if (!machines.length || loadingMachines) return;
    renderMachines();
  }, MACHINE_STATUS_REFRESH_INTERVAL_MS);
}

/**
 * Render placeholder tables when authentication is missing.
 */
function renderLoginRequiredState() {
  serviceGroups = [];
  machines = [];
  updateCounts();

  if (serviceGroupsTableBody) {
    serviceGroupsTableBody.innerHTML =
      "<tr><td colspan='6' class='px-5 py-4 text-center text-sm text-gray-500'>Sign in to view service groups.</td></tr>";
  }

  if (machinesTableBody) {
    machinesTableBody.innerHTML =
      "<tr><td colspan='5' class='px-5 py-4 text-center text-sm text-gray-500'>Sign in to view IoT devices.</td></tr>";
  }

  hideMessage(serviceGroupMsg);
  hideMessage(machineMsg);
}

function clampProgress(value, min = 0, max = 1) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(color) {
  const cleaned = color.replace('#', '');
  const bigint = Number.parseInt(cleaned, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function mixColors(colorA, colorB, t) {
  const [r1, g1, b1] = hexToRgb(colorA);
  const [r2, g2, b2] = hexToRgb(colorB);
  const mix = (c1, c2) => Math.round(c1 + (c2 - c1) * t);
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
}

function applyToggleVisual({ toggle, progress, knob }) {
  if (!toggle) return;
  const clamped = clampProgress(progress);
  const progressValue = clamped.toFixed(3);
  const startColor = mixColors(MANUAL_GRADIENT[0], AUTOMATIC_GRADIENT[0], clamped);
  const endColor = mixColors(MANUAL_GRADIENT[1], AUTOMATIC_GRADIENT[1], clamped);
  toggle.style.background = `linear-gradient(to right, ${startColor}, ${endColor})`;
  toggle.style.setProperty('--toggle-progress', progressValue);

  if (knob) {
    const trackWidth = toggle.clientWidth || 0;
    const knobWidth = knob.offsetWidth || 0;
    const knobStyles =
      typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(knob) : null;
    const leftOffset = knobStyles ? Number.parseFloat(knobStyles.left) || 0 : 0;
    const maxShift = Math.max(0, trackWidth - knobWidth - leftOffset * 2);
    knob.style.transform = `translateX(${(maxShift * clamped).toFixed(2)}px)`;
  }
}

function previewTelemetryProgress(progress) {
  applyToggleVisual({
    toggle: attributeModeToggle,
    progress,
    knob: attributeModeKnob
  });
}

function previewStaticProgress(progress) {
  applyToggleVisual({
    toggle: staticAttributesModeToggle,
    progress,
    knob: staticAttributesModeKnob
  });
}

function setupToggleControl({ toggleElement, getMode, setMode, preview }) {
  if (!toggleElement) return;
  let dragging = false;
  let pointerId = null;
  let suppressClick = false;
  let startProgress = 0;
  let hasMoved = false;

  const computeProgress = (event) => {
    const rect = toggleElement.getBoundingClientRect();
    if (!rect.width) return getMode() === 'automatic' ? 1 : 0;
    const ratio = (event.clientX - rect.left) / rect.width;
    return clampProgress(ratio);
  };

  toggleElement.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    dragging = true;
    pointerId = event.pointerId;
    toggleElement.setPointerCapture(pointerId);
    suppressClick = true;
    startProgress = computeProgress(event);
    hasMoved = false;
    preview(startProgress);
  });

  toggleElement.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const current = computeProgress(event);
    if (!hasMoved && Math.abs(current - startProgress) > 0.05) {
      hasMoved = true;
    }
    preview(current);
  });

  const finishDrag = (event, cancelled = false) => {
    if (!dragging) return;
    const progress = cancelled ? (getMode() === 'automatic' ? 1 : 0) : computeProgress(event);
    if (pointerId !== null) {
      toggleElement.releasePointerCapture(pointerId);
    }
    dragging = false;
    pointerId = null;

    if (cancelled) {
      preview(getMode() === 'automatic' ? 1 : 0);
      suppressClick = false;
    } else {
      if (!hasMoved) {
        const nextMode = getMode() === 'manual' ? 'automatic' : 'manual';
        setMode(nextMode);
      } else {
        setMode(progress >= 0.5 ? 'automatic' : 'manual');
      }
      suppressClick = true;
      setTimeout(() => {
        suppressClick = false;
      }, 150);
    }
  };

  toggleElement.addEventListener('pointerup', (event) => finishDrag(event, false));
  toggleElement.addEventListener('pointercancel', (event) => finishDrag(event, true));

  toggleElement.addEventListener('click', (event) => {
    if (suppressClick) {
      event.preventDefault();
      suppressClick = false;
      return;
    }
    const nextMode = getMode() === 'manual' ? 'automatic' : 'manual';
    setMode(nextMode);
  });

  toggleElement.addEventListener('keydown', (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    const nextMode = getMode() === 'manual' ? 'automatic' : 'manual';
    setMode(nextMode);
  });
}

function initializeAttributeInputs() {
  resetAttributeInputs();
  attributeModeToggle?.setAttribute('aria-checked', 'false');
  staticAttributesModeToggle?.setAttribute('aria-checked', 'false');
}

function resetAttributeInputs() {
  telemetryAttributeEntries = [];
  staticAttributeEntries = [];
  if (machineAttributesManual) {
    machineAttributesManual.value = '';
  }
  if (machineStaticAttributesManual) {
    machineStaticAttributesManual.value = '';
  }
  clearTelemetryAttributeFields();
  clearStaticAttributeFields();
  updateAttributeInputMode('manual');
  updateStaticAttributeInputMode('manual');
  renderTelemetryAttributeList();
  renderStaticAttributeList();
}

function updateAttributeInputMode(mode = 'manual') {
  telemetryInputMode = mode === 'automatic' ? 'automatic' : 'manual';
  attributeManualContainer?.classList.toggle('hidden', telemetryInputMode === 'automatic');
  attributeAutomaticContainer?.classList.toggle('hidden', telemetryInputMode !== 'automatic');
  const isAutomatic = telemetryInputMode === 'automatic';

  if (attributeModeToggle) {
    attributeModeToggle.dataset.mode = telemetryInputMode;
    attributeModeToggle.setAttribute('aria-checked', isAutomatic ? 'true' : 'false');
  }
  applyToggleVisual({
    toggle: attributeModeToggle,
    progress: isAutomatic ? 1 : 0,
    knob: attributeModeKnob
  });
}

function updateStaticAttributeInputMode(mode = 'manual') {
  staticAttributesInputModeState = mode === 'automatic' ? 'automatic' : 'manual';
  const isAutomatic = staticAttributesInputModeState === 'automatic';

  staticAttributesManualContainer?.classList.toggle('hidden', isAutomatic);
  staticAttributesAutomaticContainer?.classList.toggle('hidden', !isAutomatic);

  if (staticAttributesModeToggle) {
    staticAttributesModeToggle.dataset.mode = staticAttributesInputModeState;
    staticAttributesModeToggle.setAttribute('aria-checked', isAutomatic ? 'true' : 'false');
  }
  applyToggleVisual({
    toggle: staticAttributesModeToggle,
    progress: isAutomatic ? 1 : 0,
    knob: staticAttributesModeKnob
  });
}

function toggleTelemetryMode() {
  const nextMode = telemetryInputMode === 'manual' ? 'automatic' : 'manual';
  updateAttributeInputMode(nextMode);
}

function toggleStaticAttributeMode() {
  const nextMode = staticAttributesInputModeState === 'manual' ? 'automatic' : 'manual';
  updateStaticAttributeInputMode(nextMode);
}

function clearTelemetryAttributeFields() {
  if (attributeObjectId) attributeObjectId.value = '';
  if (attributeName) attributeName.value = '';
  if (attributeType) attributeType.value = '';
}

function clearStaticAttributeFields() {
  if (staticAttributeName) staticAttributeName.value = '';
  if (staticAttributeType) staticAttributeType.value = '';
  if (staticAttributeValue) staticAttributeValue.value = '';
}

function handleAddTelemetryAttribute(event) {
  event.preventDefault();
  hideMessage(machineMsg);
  if (telemetryInputMode !== 'automatic') {
    showMessage(machineMsg, 'Toggle to Automatic builder to add telemetry attributes.');
    return;
  }

  const objectId = attributeObjectId?.value.trim() || '';
  const name = attributeName?.value.trim() || '';
  const type = attributeType?.value.trim() || '';

  if (!objectId || !name || !type) {
    showMessage(machineMsg, 'Provide object ID, name, and type for the telemetry attribute.');
    return;
  }

  telemetryAttributeEntries.push({ object_id: objectId, name, type });
  renderTelemetryAttributeList();
  clearTelemetryAttributeFields();
}

function handleTelemetryAttributeListClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest('[data-action="remove-telemetry-attribute"]');
  if (!button) return;
  event.preventDefault();
  const index = Number.parseInt(button.getAttribute('data-index') || '', 10);
  if (Number.isNaN(index)) return;

  telemetryAttributeEntries.splice(index, 1);
  renderTelemetryAttributeList();
}

function renderTelemetryAttributeList() {
  if (!attributeAutoList) return;
  if (!telemetryAttributeEntries.length) {
    attributeAutoList.innerHTML =
      '<li class="px-3 py-2 text-xs text-gray-500">No attributes added yet.</li>';
    return;
  }

  attributeAutoList.innerHTML = telemetryAttributeEntries
    .map((attr, index) => {
      const label = [
        `<span class="font-semibold text-gray-800">${escapeHtml(attr.name)}</span>`,
        `<span class="ml-2 text-xs text-gray-500">${escapeHtml(attr.object_id)}</span>`,
        `<span class="ml-2 text-xs text-indigo-600">${escapeHtml(attr.type)}</span>`
      ].join('');
      return `
        <li class="px-3 py-2 flex items-center justify-between">
          <span class="text-sm text-gray-700">${label}</span>
          <button
            type="button"
            class="text-xs text-red-600 hover:underline"
            data-action="remove-telemetry-attribute"
            data-index="${index}"
          >
            Remove
          </button>
        </li>`;
    })
    .join('');
}

function handleAddStaticAttribute(event) {
  event.preventDefault();
  hideMessage(machineMsg);
  if (staticAttributesInputModeState !== 'automatic') {
    showMessage(machineMsg, 'Toggle to Automatic builder to add static attributes.');
    return;
  }

  const name = staticAttributeName?.value.trim() || '';
  const type = staticAttributeType?.value.trim() || '';
  const value = staticAttributeValue?.value.trim() || '';

  if (!name || !type || !value) {
    showMessage(machineMsg, 'Provide name, type, and value for the static attribute.');
    return;
  }

  staticAttributeEntries.push({ name, type, value });
  renderStaticAttributeList();
  clearStaticAttributeFields();
}

function handleStaticAttributeListClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest('[data-action="remove-static-attribute"]');
  if (!button) return;
  event.preventDefault();
  const index = Number.parseInt(button.getAttribute('data-index') || '', 10);
  if (Number.isNaN(index)) return;

  staticAttributeEntries.splice(index, 1);
  renderStaticAttributeList();
}

function renderStaticAttributeList() {
  if (!staticAttributeAutoList) return;
  if (!staticAttributeEntries.length) {
    staticAttributeAutoList.innerHTML =
      '<li class="px-3 py-2 text-xs text-gray-500">No static attributes added yet.</li>';
    return;
  }

  staticAttributeAutoList.innerHTML = staticAttributeEntries
    .map((attr, index) => {
      const label = [
        `<span class="font-semibold text-gray-800">${escapeHtml(attr.name)}</span>`,
        `<span class="ml-2 text-xs text-indigo-600">${escapeHtml(attr.type)}</span>`,
        `<span class="ml-2 text-xs text-gray-500">${escapeHtml(attr.value)}</span>`
      ].join('');
      return `
        <li class="px-3 py-2 flex items-center justify-between">
          <span class="text-sm text-gray-700">${label}</span>
          <button
            type="button"
            class="text-xs text-red-600 hover:underline"
            data-action="remove-static-attribute"
            data-index="${index}"
          >
            Remove
          </button>
        </li>`;
    })
    .join('');
}

async function syncMachineActivityData() {
  if (!machines.length) return;
  const now = Date.now();
  if (now - getLastActivityFetchTime() < ACTIVITY_REFRESH_MIN_INTERVAL_MS) return;

  try {
    await refreshDeviceActivity({ now });
  } catch (error) {
    console.warn('Unable to refresh device activity:', error);
  }
}

/**
 * Fetch registered service groups.
 */
async function fetchServiceGroups() {
  if (!serviceGroupsTableBody) return;
  loadingServiceGroups = true;
  setServiceGroupLoading();

  try {
    const resp = await fetch(`${IOT_AGENT_BASE}/iot/services`, {
      method: 'GET',
      headers: buildHeaders()
    });

    if (!resp.ok) {
      throw new Error(await extractError(resp));
    }

    const payload = await resp.json().catch(() => ({}));
    const entries = Array.isArray(payload.services) ? payload.services : [];
    serviceGroups = entries.map(normalizeServiceGroup);
    hideMessage(serviceGroupMsg);
  } catch (error) {
    console.error('Error loading service groups:', error);
    serviceGroups = [];
    renderServiceGroupError(error);
    showMessage(serviceGroupMsg, `Error loading service groups: ${error.message}`);
  } finally {
    loadingServiceGroups = false;
  }
}

/**
 * Fetch registered IoT devices.
 */
async function fetchMachines() {
  loadingMachines = true;
  if (machinesTableBody) {
    setMachinesLoading();
  }

  try {
    const resp = await fetch(`${IOT_AGENT_BASE}/iot/devices`, {
      method: 'GET',
      headers: buildHeaders()
    });

    if (!resp.ok) {
      throw new Error(await extractError(resp));
    }

    const payload = await resp.json().catch(() => ({}));
    const entries = Array.isArray(payload.devices) ? payload.devices : [];
    const normalizedDevices = entries.map(normalizeDevice);
    machines = mergeDuplicateDevices(normalizedDevices);
    await syncMachineActivityData();
    updateMachineStatusesFromStore();
    hideMessage(machineMsg);
  } catch (error) {
    console.error('Error loading machines:', error);
    machines = [];
    if (machinesTableBody) {
      renderMachinesError(error);
    }
    showMessage(machineMsg, `Error loading machines: ${error.message}`);
  } finally {
    loadingMachines = false;
  }
}

/**
 * Handle service group submission by calling the IoT Agent.
 */
async function handleServiceGroupSubmit(event) {
  event.preventDefault();
  hideMessage(serviceGroupMsg);

  const apikey = serviceGroupApiKey?.value.trim() || '';
  const cbroker = serviceGroupCbroker?.value.trim() || '';
  const resource = serviceGroupResource?.value.trim() || '';
  const entityType = serviceGroupEntityType?.value.trim() || '';
  const displayName = serviceGroupName?.value.trim() || '';
  const notes = serviceGroupDescription?.value.trim() || '';

  if (!cbroker) {
    showMessage(serviceGroupMsg, 'Context Broker URL is required.');
    return;
  }

  const normalizedCbroker = normalizeCbrokerUrl(cbroker);
  if (!normalizedCbroker || !NORMALIZED_ALLOWED_CBROKER_URLS.has(normalizedCbroker)) {
    showMessage(
      serviceGroupMsg,
      `Context Broker URL must match a supported FIWARE endpoint (${ALLOWED_CBROKER_DISPLAY}).`
    );
    return;
  }

  if (!resource) {
    showMessage(serviceGroupMsg, 'Resource path is required.');
    return;
  }

  const normalizedResource = normalizeResourcePath(resource);
  if (
    serviceGroups.some(
      (group) => normalizeResourcePath(group.resource) === normalizedResource
    )
  ) {
    showMessage(
      serviceGroupMsg,
      `Resource path "${normalizedResource}" is already registered. Choose a unique path.`
    );
    return;
  }

  if (!entityType) {
    showMessage(serviceGroupMsg, 'Entity type is required.');
    return;
  }

  const metadata = displayName || notes ? { name: displayName, notes } : null;
  const serviceKey = createServiceKey({
    apikey,
    resource,
    cbroker,
    fiwareService: FIWARE_SERVICE,
    subservice: FIWARE_SERVICEPATH || '/',
    entityType
  });
  const payload = {
    services: [
      {
        apikey,
        cbroker,
        entity_type: entityType,
        resource,
        ...(metadata ? { description: JSON.stringify(metadata) } : {})
      }
    ]
  };

  const submitBtn = serviceGroupForm?.querySelector('button[type="submit"]');
  const originalText = submitBtn?.textContent;
  if (submitBtn) {
    submitBtn.textContent = 'Registering...';
    submitBtn.disabled = true;
  }

  try {
    const resp = await fetch(`${IOT_AGENT_BASE}/iot/services`, {
      method: 'POST',
      headers: buildHeaders({ includeJson: true }),
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      throw new Error(await extractError(resp));
    }

    serviceGroupForm?.reset();
    applyServiceDefaults();
    const feedbackLabel = displayName || apikey || resource || 'Service group';
    showMessage(serviceGroupMsg, `${feedbackLabel} registered successfully.`, false);

    await fetchServiceGroups();
    renderServiceGroups();
    refreshServiceGroupOptions(serviceKey);
  } catch (error) {
    console.error('Error creating service group:', error);
    showMessage(serviceGroupMsg, `Error creating service group: ${error.message}`);
  } finally {
    if (submitBtn) {
      submitBtn.textContent = originalText || 'Save Service Group';
      submitBtn.disabled = false;
    }
  }
}

/**
 * Handle service group table actions (delete).
 */
function handleServiceGroupTableClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const deleteBtn = target.closest('[data-action="delete-service"]');
  if (!deleteBtn) return;

  const button = deleteBtn instanceof HTMLButtonElement ? deleteBtn : null;
  if (!button) return;

  const serviceKey = button.getAttribute('data-service-key');
  if (!serviceKey) return;

  const group = serviceGroups.find((svc) => svc.key === serviceKey);
  if (!group) return;

  const label = getServiceLabel(group);
  if (typeof window !== 'undefined' && !window.confirm(`Delete service group "${label}"? This cannot be undone.`)) {
    return;
  }

  void handleDeleteServiceGroup(button, group);
}

/**
 * Delete a service group via the IoT Agent API.
 */
async function handleDeleteServiceGroup(button, group) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Deleting...';

  try {
    const params = new URLSearchParams();
    const resourceValue = group.resource || '';
    const apikeyValue = group.apikey ?? '';

    if (!resourceValue) {
      throw new Error('Missing service group resource identifier.');
    }

    params.set('resource', resourceValue);
    params.set('apikey', apikeyValue || '');

    const url = `${IOT_AGENT_BASE}/iot/services?${params.toString()}`;
    const headers = buildHeaders();

    const resp = await fetch(url, {
      method: 'DELETE',
      headers
    });

    if (!resp.ok) {
      throw new Error(await extractError(resp));
    }

    showMessage(serviceGroupMsg, `${getServiceLabel(group)} deleted successfully.`, false);

    await fetchServiceGroups();
    renderServiceGroups();
    refreshServiceGroupOptions();

    await fetchMachines();
    renderMachines();
  } catch (error) {
    console.error('Error deleting service group:', error);
    const message = error instanceof Error ? error.message : String(error);
    showMessage(serviceGroupMsg, `Error deleting service group: ${message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText || 'Delete';
  }
}

function handleMachinesTableClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const deleteBtn = target.closest('[data-action="delete-machine"]');
  if (!deleteBtn) return;

  const button = deleteBtn instanceof HTMLButtonElement ? deleteBtn : null;
  if (!button) return;

  const deviceId = button.getAttribute('data-device-id');
  if (!deviceId) return;

  const machine = machines.find((entry) => entry.deviceId === deviceId);
  if (!machine) return;

  if (
    typeof window !== 'undefined' &&
    !window.confirm(`Delete machine "${deviceId}"? This cannot be undone.`)
  ) {
    return;
  }

  void handleDeleteMachine(button, machine);
}

async function handleDeleteMachine(button, machine) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Deleting...';

  try {
    const url = `${IOT_AGENT_BASE}/iot/devices/${encodeURIComponent(machine.deviceId)}`;
    const headers = buildHeaders();

    const resp = await fetch(url, {
      method: 'DELETE',
      headers
    });

    if (!resp.ok) {
      throw new Error(await extractError(resp));
    }

    showMessage(machineMsg, `Machine ${machine.deviceId} deleted successfully.`, false);

    await fetchMachines();
    renderMachines();
  } catch (error) {
    console.error('Error deleting machine:', error);
    const message = error instanceof Error ? error.message : String(error);
    showMessage(machineMsg, `Error deleting machine: ${message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText || 'Delete';
  }
}

function handleDeviceActivityUpdated() {
  if (loadingMachines || !machinesTableBody) return;
  if (!machines.length) return;
  renderMachines();
}

/**
 * Handle machine submission by calling the IoT Agent.
 */
async function handleMachineSubmit(event) {
  event.preventDefault();
  hideMessage(machineMsg);

  if (!serviceGroups.length) {
    showMessage(machineMsg, 'Register a service group before adding machines.');
    return;
  }

  const deviceId = machineDeviceId?.value.trim() || '';
  const friendlyName = machineName?.value.trim() || '';
  const model = machineModel?.value.trim() || '';
  const description = machineDescription?.value.trim() || '';
  const selectedServiceKey = machineServiceGroup?.value || '';
  const status = machineStatus?.value || '';

  if (!deviceId) {
    showMessage(machineMsg, 'Device ID is required.');
    return;
  }

  if (!selectedServiceKey) {
    showMessage(machineMsg, 'Select the service group responsible for this machine.');
    return;
  }

  const targetService = serviceGroups.find((svc) => svc.key === selectedServiceKey);
  if (!targetService) {
    showMessage(machineMsg, 'Selected service group is no longer available. Reload and try again.');
    return;
  }

  // Use the entity type defined by the selected service group
  const entityType = targetService?.entityType || 'Thing';

  const attributes = collectTelemetryAttributes();
  if (attributes === null) {
    return;
  }

  const defaultStaticAttributes = buildDefaultStaticAttributes({
    friendlyName,
    model,
    description,
    status,
    serviceKey: targetService.key,
    serviceApikey: targetService.apikey,
    serviceResource: targetService.resource,
    serviceFiware: targetService.fiwareService,
    serviceSubservice: targetService.subservice
  });
  const customStaticAttributes = collectStaticAttributesInput();
  if (customStaticAttributes === null) {
    return;
  }
  const staticAttributes = [...defaultStaticAttributes, ...customStaticAttributes];

  const payload = {
    devices: [
      {
        device_id: deviceId,
        entity_name: buildEntityName(deviceId, entityType),
        entity_type: entityType,
        transport: IOT_AGENT_TRANSPORT,
        protocol: IOT_AGENT_PROTOCOL,
        service: {
          apikey: targetService.apikey || '',
          resource: targetService.resource || IOT_AGENT_RESOURCE
        },
        attributes,
        commands: [],
        static_attributes: staticAttributes
      }
    ]
  };

  const submitBtn = machineForm?.querySelector('button[type="submit"]');
  const originalText = submitBtn?.textContent;
  if (submitBtn) {
    submitBtn.textContent = 'Registering...';
    submitBtn.disabled = true;
  }

  try {
    const resp = await fetch(`${IOT_AGENT_BASE}/iot/devices`, {
      method: 'POST',
      headers: buildHeaders({ includeJson: true }),
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      throw new Error(await extractError(resp));
    }

    const lastSelection = machineServiceGroup?.value;
    machineForm?.reset();
    if (machineServiceGroup && lastSelection) {
      machineServiceGroup.value = lastSelection;
    }
    resetAttributeInputs();
    if (machineStatus) {
      machineStatus.value = status || 'Online';
    }
    showMessage(machineMsg, `Machine ${deviceId} registered successfully.`, false);

    await fetchMachines();
    renderMachines();
  } catch (error) {
    console.error('Error creating machine:', error);
    showMessage(machineMsg, `Error creating machine: ${error.message}`);
  } finally {
    if (submitBtn) {
      submitBtn.textContent = originalText || 'Save Machine';
      submitBtn.disabled = false;
    }
  }
}

/**
 * Render the service groups table.
 */
function renderServiceGroups() {
  if (!serviceGroupsTableBody) return;
  if (loadingServiceGroups) return;

  if (!serviceGroups.length) {
    serviceGroupsTableBody.innerHTML =
      "<tr><td colspan='6' class='px-5 py-4 text-center text-gray-500'>No service groups registered.</td></tr>";
  } else {
    const rows = serviceGroups
      .slice()
      .sort((a, b) => getServiceLabel(a).localeCompare(getServiceLabel(b)))
      .map(
        (group) => `
        <tr>
          <td class="px-5 py-3 text-sm font-semibold text-gray-800">${escapeHtml(
            group.apikey ? group.apikey : 'N/A'
          )}</td>
          <td class="px-5 py-3 text-sm text-gray-700">
            ${
              group.displayName
                ? `<div class="font-semibold text-gray-800">${escapeHtml(group.displayName)}</div>`
                : `<div class="text-sm text-gray-400 italic">Not set</div>`
            }
            ${
              group.notes
                ? `<div class="text-xs text-gray-500 mt-1">${escapeHtml(group.notes)}</div>`
                : ''
            }
          </td>
          <td class="px-5 py-3 text-sm text-gray-700">
            <div>${escapeHtml(group.resource || IOT_AGENT_RESOURCE)}</div>
            <div class="text-xs text-gray-500">Service: ${escapeHtml(group.fiwareService)}</div>
          </td>
          <td class="px-5 py-3 text-sm text-gray-700">
            <div>${escapeHtml(group.entityType)}</div>
          </td>
          <td class="px-5 py-3 text-sm text-gray-700">
            ${renderServiceGroupBroker(group, { includeUrl: false })}
            ${
              group.subservice && group.subservice !== '/'
                ? `<div class="text-xs text-gray-500 mt-1">Path: ${escapeHtml(group.subservice)}</div>`
                : ''
            }
          </td>
          <td class="px-5 py-3 text-sm text-right">
            <button
              type="button"
              class="inline-flex items-center rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              data-action="delete-service"
              data-service-key="${escapeHtml(group.key)}"
            >
              <i class="fas fa-trash-alt mr-1"></i>Delete
            </button>
          </td>
        </tr>`
      )
      .join('');
    serviceGroupsTableBody.innerHTML = rows;
  }

  updateCounts();
}

/**
 * Render the machines table.
 */
function updateMachineStatusesFromStore() {
  if (!machines.length) return;
  const now = Date.now();

  machines.forEach((machine) => {
    const activity =
      getDeviceActivity(machine.entityName, { now }) ||
      getDeviceActivity(machine.deviceId, { now });

    const staticStatus = machine.status ? String(machine.status).trim() : '';
    const staticStatusLower = staticStatus.toLowerCase();

    if (activity) {
      machine.lastSeen = activity.lastUpdateIso || '';
      machine.lastSeenAttribute = activity.lastUpdateAttribute || '';
      machine.dynamicStatus = activity.status;
      machine.activityAgeMs = activity.ageMs ?? null;

      if (activity.offline) {
        machine.currentStatus = 'Offline';
      } else if (staticStatus && staticStatusLower !== 'offline') {
        machine.currentStatus = staticStatus;
      } else {
        machine.currentStatus = activity.status;
      }
    } else {
      machine.lastSeen = '';
      machine.lastSeenAttribute = '';
      machine.dynamicStatus = '';
      machine.activityAgeMs = null;
      machine.currentStatus = staticStatus || '';
    }

    if (!machine.currentStatus) {
      machine.currentStatus = activity && !activity.offline ? 'Online' : 'Unknown';
    }
  });
}

function renderMachines() {
  if (!machinesTableBody) return;
  if (loadingMachines) return;
  updateMachineStatusesFromStore();

  if (!machines.length) {
    machinesTableBody.innerHTML =
      "<tr><td colspan='6' class='px-5 py-4 text-center text-gray-500'>No machines registered.</td></tr>";
  } else {
    const rows = machines
      .slice()
      .sort((a, b) => a.deviceId.localeCompare(b.deviceId))
      .map((machine) => {
        const service = findServiceGroupForMachine(machine);
        const serviceLabel = service ? getServiceLabel(service) : getMachineServiceFallback(machine);
        const details = [];

        const deviceMetaParts = [];
        if (machine.model) deviceMetaParts.push(machine.model);
        if (machine.assetId) deviceMetaParts.push(machine.assetId);
        const deviceMeta = deviceMetaParts.join(' / ');

        if (machine.model) {
          details.push(`<div>Model: ${escapeHtml(machine.model)}</div>`);
        }

        if (machine.notes) {
          details.push(`<div class="text-xs text-gray-500 mt-1">${escapeHtml(machine.notes)}</div>`);
        }

        const proto = [machine.transport, machine.protocol].filter(Boolean).join(' / ');
        if (proto) {
          details.push(`<div class="text-xs text-gray-500 mt-2">${escapeHtml(proto)}</div>`);
        }

        if (machine.lastSeen) {
          const lastSeenTime = formatLastSeen(machine.lastSeen);
          const attributeLabel = asNonEmptyString(machine.lastSeenAttribute)
            ? ` (${escapeHtml(machine.lastSeenAttribute)})`
            : '';
          details.push(
            `<div class="text-xs text-gray-500 mt-2">Last data${attributeLabel}: ${escapeHtml(
              lastSeenTime
            )}</div>`
          );
        }

        const attributeCount =
          (Array.isArray(machine.attributes) ? machine.attributes.length : 0) +
          (Array.isArray(machine.staticAttributes) ? machine.staticAttributes.length : 0);

        details.push(
          `<div class="text-xs text-gray-500">Attributes: ${attributeCount}</div>`
        );

        const serviceDetails = [];
        if (service && asNonEmptyString(service.resource)) {
          serviceDetails.push(
            `<div class="text-xs text-gray-500">${escapeHtml(normalizeResourcePath(service.resource))}</div>`
          );
        } else {
          const machineResource = asNonEmptyString(machine.resource);
          if (machineResource) {
            serviceDetails.push(
              `<div class="text-xs text-gray-500">${escapeHtml(normalizeResourcePath(machineResource))}</div>`
            );
          }
        }

        return `
        <tr>
          <td class="px-5 py-3 text-sm font-medium text-gray-900">
            <div>${escapeHtml(machine.deviceId)}</div>
            ${
              deviceMeta
                ? `<div class="text-xs text-gray-500">${escapeHtml(deviceMeta)}</div>`
                : ''
            }
          </td>
          <td class="px-5 py-3 text-sm text-gray-700">
            <div class="font-semibold text-gray-800">${escapeHtml(machine.friendlyName || machine.entityName)}</div>
            ${
              machine.entityName
                ? `<div class="text-xs text-gray-500">${escapeHtml(machine.entityName)}</div>`
                : ''
            }
          </td>
          <td class="px-5 py-3 text-sm text-gray-700">
            <div>${escapeHtml(serviceLabel)}</div>
            ${serviceDetails.join('')}
          </td>
          <td class="px-5 py-3 text-sm">${renderStatus(machine.currentStatus || machine.status || 'Unknown')}</td>
          <td class="px-5 py-3 text-sm text-gray-700">${details.join('')}</td>
          <td class="px-5 py-3 text-sm text-right">
            <button
              type="button"
              class="inline-flex items-center rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              data-action="delete-machine"
              data-device-id="${escapeHtml(machine.deviceId)}"
            >
              <i class="fas fa-trash-alt mr-1"></i>Delete
            </button>
          </td>
        </tr>`;
      })
      .join('');
    machinesTableBody.innerHTML = rows;
  }

  updateCounts();
}

/**
 * Populate machine service group select options.
 */
function refreshServiceGroupOptions(selectedKey = '') {
  if (!machineServiceGroup) return;

  if (!serviceGroups.length) {
    machineServiceGroup.innerHTML = '<option value="">Add a service group first</option>';
    machineServiceGroup.disabled = true;
    return;
  }

  const options = [
    '<option value="">Select a service group</option>',
    ...serviceGroups
      .slice()
      .sort((a, b) => getServiceLabel(a).localeCompare(getServiceLabel(b)))
      .map(
        (group) =>
          `<option value="${escapeHtml(group.key)}" ${
            group.key === selectedKey ? 'selected' : ''
          }>${escapeHtml(getServiceLabel(group))}</option>`
      )
  ];

  machineServiceGroup.innerHTML = options.join('');
  machineServiceGroup.disabled = false;
}

/**
 * Update counters for current entities.
 */
function updateCounts() {
  if (serviceGroupCount) {
    serviceGroupCount.textContent = serviceGroups.length
      ? `${serviceGroups.length} registered`
      : '0 recorded';
  }
  if (machineCount) {
    machineCount.textContent = machines.length ? `${machines.length} registered` : '0 recorded';
  }
}

/**
 * Apply default IoT Agent values when inputs are empty.
 */
function applyServiceDefaults() {
  if (serviceGroupCbroker && !serviceGroupCbroker.value) {
    serviceGroupCbroker.value = IOT_AGENT_CBROKER;
  }
  if (serviceGroupResource && !serviceGroupResource.value) {
    serviceGroupResource.value = IOT_AGENT_RESOURCE;
  }
  if (serviceGroupEntityType && !serviceGroupEntityType.value) {
    serviceGroupEntityType.value = 'Machine';
  }
}

/**
 * Auto-fill the API key from the display name when empty.
 */
function populateApikeyFromName() {
  if (!serviceGroupApiKey || !serviceGroupName) return;
  if (serviceGroupApiKey.value.trim()) return;
  const suggestion = serviceGroupName.value.trim();
  if (!suggestion) return;
  serviceGroupApiKey.value = suggestion
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function collectTelemetryAttributes() {
  if (telemetryInputMode === 'automatic') {
    return telemetryAttributeEntries.map((entry) => ({ ...entry }));
  }

  const raw = machineAttributesManual?.value.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('Attributes JSON must be an array.');
    }
    return parsed;
  } catch (error) {
    showMessage(machineMsg, `Attributes JSON error: ${error.message}`);
    return null;
  }
}

function collectStaticAttributesInput() {
  if (staticAttributesInputModeState === 'automatic') {
    return staticAttributeEntries.map((entry) => ({ ...entry }));
  }

  const raw = machineStaticAttributesManual?.value.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('Static attributes JSON must be an array.');
    }
    return parsed;
  } catch (error) {
    showMessage(machineMsg, `Static attributes JSON error: ${error.message}`);
    return null;
  }
}

/**
 * Create static attributes payload from form fields.
 */
function buildDefaultStaticAttributes({
  friendlyName,
  model,
  description,
  status,
  serviceKey = '',
  serviceApikey = '',
  serviceResource = '',
  serviceFiware = '',
  serviceSubservice = ''
}) {
  const attrs = [];

  if (friendlyName) {
    attrs.push({ name: 'friendlyName', type: 'Text', value: friendlyName });
  }
  if (model) {
    attrs.push({ name: 'model', type: 'Text', value: model });
  }
  if (description) {
    attrs.push({ name: 'notes', type: 'Text', value: description });
  }
  if (status) {
    attrs.push({ name: 'operationalStatus', type: 'Text', value: status });
  }
  if (serviceKey) {
    attrs.push({ name: 'serviceGroupKey', type: 'Text', value: serviceKey });
  }
  if (serviceResource) {
    attrs.push({ name: 'serviceGroupResource', type: 'Text', value: serviceResource });
  }
  if (serviceApikey) {
    attrs.push({ name: 'serviceGroupApikey', type: 'Text', value: serviceApikey });
  }
  if (serviceFiware) {
    attrs.push({ name: 'serviceGroupFiware', type: 'Text', value: serviceFiware });
  }
  if (serviceSubservice) {
    attrs.push({ name: 'serviceGroupSubservice', type: 'Text', value: serviceSubservice });
  }

  return attrs;
}

/**
 * Derive a URN for the Orion entity from the device identifier.
 */
function buildEntityName(deviceId, type = 'Thing') {
  const sanitized = deviceId.replace(/[^A-Za-z0-9:-]/g, '-').replace(/:+/g, '-');
  return `urn:ngsi-ld:${type}:${sanitized}`;
}

/**
 * Normalise IoT Agent service response.
 */
function normalizeServiceGroup(entry = {}) {
  const metadata = decodeMetadata(entry.description);
  const apikey = entry.apikey || '';
  const resource = entry.resource || '';
  const cbroker = extractBrokerFromSource(entry) || '';
  const fiwareService = entry.service || FIWARE_SERVICE;
  const subservice = entry.subservice || FIWARE_SERVICEPATH || '/';
  const entityType = entry.entity_type || 'Thing';

  return {
    key: createServiceKey({ apikey, resource, cbroker, fiwareService, subservice, entityType }),
    apikey,
    resource,
    cbroker,
    entityType,
    fiwareService,
    subservice,
    displayName: metadata.name || '',
    notes: metadata.notes || '',
    raw: entry
  };
}

/**
 * Normalise IoT Agent device response.
 */
function firstNonEmpty(...values) {
  for (const value of values) {
    const str = asNonEmptyString(value);
    if (str) return str;
  }
  return '';
}

function normalizeDevice(entry = {}) {
  const staticMap = toAttributeMap(entry.static_attributes);
  const serviceInfo = entry.service || {};
  const storedServiceKey = asNonEmptyString(staticMap.get('serviceGroupKey'));
  const storedResource = asNonEmptyString(staticMap.get('serviceGroupResource'));
  const storedApikey = asNonEmptyString(staticMap.get('serviceGroupApikey'));
  const apikey = firstNonEmpty(
    serviceInfo.apikey,
    serviceInfo.apiKey,
    serviceInfo.api_key,
    entry.apikey,
    entry.apiKey,
    entry.api_key,
    storedApikey
  );
  const resource = firstNonEmpty(
    serviceInfo.resource,
    serviceInfo.resourcePath,
    serviceInfo.resource_path,
    entry.resource,
    entry.resourcePath,
    entry.resource_path,
    storedResource
  );
  const cbroker = firstNonEmpty(
    serviceInfo.cbroker,
    serviceInfo.cbBroker,
    serviceInfo.cBroker,
    entry.cbroker,
    entry.cbBroker,
    entry.cBroker
  );
  const fiwareService = firstNonEmpty(
    serviceInfo.service,
    serviceInfo.fiwareService,
    entry.service,
    entry.fiwareService,
    storedServiceKey ? storedServiceKey.split('|')[3] : '',
    FIWARE_SERVICE
  );
  const subservice = firstNonEmpty(
    serviceInfo.subservice,
    serviceInfo.servicePath,
    entry.subservice,
    entry.servicePath,
    FIWARE_SERVICEPATH,
    '/'
  );
  const entityType =
    firstNonEmpty(serviceInfo.entity_type, serviceInfo.entityType, entry.entity_type, entry.entityType) ||
    ENTITY_TYPE;
  const assetId =
    entry.asset_id ||
    entry.assetId ||
    entry.assetID ||
    staticMap.get('asset_id') ||
    staticMap.get('assetId') ||
    staticMap.get('assetID') ||
    '';
  const computedServiceKey = createServiceKey({
    apikey,
    resource,
    cbroker,
    fiwareService,
    subservice,
    entityType
  });
  const resolvedServiceKey = storedServiceKey || computedServiceKey;
  return {
    deviceId: entry.device_id || '',
    entityName: entry.entity_name || '',
    entityType,
    transport: entry.transport || '',
    protocol: entry.protocol || '',
    attributes: Array.isArray(entry.attributes) ? entry.attributes : [],
    staticAttributes: Array.isArray(entry.static_attributes) ? entry.static_attributes : [],
    apikey,
    resource,
    cbroker,
    fiwareService,
    subservice,
    serviceKey: resolvedServiceKey,
    friendlyName: staticMap.get('friendlyName') || '',
    model: staticMap.get('model') || '',
    assetId,
    notes: staticMap.get('notes') || '',
    status: staticMap.get('operationalStatus') || '',
    raw: entry
  };
}

function mergeDuplicateDevices(devices = []) {
  const deduped = new Map();
  let fallbackIndex = 0;

  devices.forEach((device) => {
    if (!device || typeof device !== 'object') return;
    const deviceId = asNonEmptyString(device.deviceId);
    const entityName = asNonEmptyString(device.entityName);
    const serviceKey = asNonEmptyString(device.serviceKey);
    const dedupeKey =
      deviceId || entityName
        ? [deviceId, entityName, serviceKey].join('|')
        : `__device_${fallbackIndex++}`;

    if (!deduped.has(dedupeKey)) {
      deduped.set(dedupeKey, {
        ...device,
        attributes: Array.isArray(device.attributes) ? [...device.attributes] : [],
        staticAttributes: Array.isArray(device.staticAttributes)
          ? [...device.staticAttributes]
          : []
      });
      return;
    }

    const existing = deduped.get(dedupeKey);
    existing.attributes = mergeAttributeList(existing.attributes, device.attributes);
    existing.staticAttributes = mergeAttributeList(existing.staticAttributes, device.staticAttributes);

    existing.apikey = asNonEmptyString(existing.apikey) || asNonEmptyString(device.apikey) || '';

    const nextResource = asNonEmptyString(device.resource);
    const currentResource = asNonEmptyString(existing.resource);
    if (nextResource && (!currentResource || isDefaultResourceValue(currentResource))) {
      existing.resource = nextResource;
    }

    const nextCbroker = asNonEmptyString(device.cbroker);
    if (nextCbroker && !asNonEmptyString(existing.cbroker)) {
      existing.cbroker = nextCbroker;
    }

    const nextFiwareService = asNonEmptyString(device.fiwareService);
    if (
      nextFiwareService &&
      (!asNonEmptyString(existing.fiwareService) || existing.fiwareService === FIWARE_SERVICE)
    ) {
      existing.fiwareService = nextFiwareService;
    }

    const nextSubservice = asNonEmptyString(device.subservice);
    if (nextSubservice && (!asNonEmptyString(existing.subservice) || existing.subservice === '/')) {
      existing.subservice = nextSubservice;
    }

    if (serviceKeyScore(device.serviceKey) > serviceKeyScore(existing.serviceKey)) {
      existing.serviceKey = device.serviceKey;
    }

    if (asNonEmptyString(device.friendlyName) && !asNonEmptyString(existing.friendlyName)) {
      existing.friendlyName = device.friendlyName;
    }
    if (asNonEmptyString(device.model) && !asNonEmptyString(existing.model)) {
      existing.model = device.model;
    }
    if (asNonEmptyString(device.assetId) && !asNonEmptyString(existing.assetId)) {
      existing.assetId = device.assetId;
    }
    if (asNonEmptyString(device.notes) && !asNonEmptyString(existing.notes)) {
      existing.notes = device.notes;
    }
    if (asNonEmptyString(device.status) && !asNonEmptyString(existing.status)) {
      existing.status = device.status;
    }
    existing.raw = existing.raw || device.raw;
  });

  return Array.from(deduped.values());
}

function mergeAttributeList(target = [], source = []) {
  const base = Array.isArray(target) ? [...target] : [];
  const seen = new Set(base.map(attributeIdentity));

  (Array.isArray(source) ? source : []).forEach((attr) => {
    const key = attributeIdentity(attr);
    if (!seen.has(key)) {
      base.push(attr);
      seen.add(key);
    }
  });

  return base;
}

function attributeIdentity(attr = {}) {
  const objectId = asNonEmptyString(attr.object_id || attr.objectId);
  const name = asNonEmptyString(attr.name);
  if (objectId || name) {
    return `${objectId}::${name}`;
  }
  const type = asNonEmptyString(attr.type);
  const value = attr.value != null ? JSON.stringify(attr.value) : '';
  return `anon::${type}::${value}`;
}

function isDefaultResourceValue(value) {
  const normalized = asNonEmptyString(value);
  if (!normalized) return true;
  return normalizeResourcePath(normalized) === '/';
}

function serviceKeyScore(value) {
  const normalized = asNonEmptyString(value);
  if (!normalized) return 0;
  const parts = normalized.split('|');
  let score = 0;
  if (asNonEmptyString(parts[0])) score += 4;
  if (asNonEmptyString(parts[1])) score += 4;
  if (asNonEmptyString(parts[2])) score += 1;
  if (asNonEmptyString(parts[3])) score += 1;
  if (asNonEmptyString(parts[4])) score += 1;
  if (asNonEmptyString(parts[5])) score += 1;
  return score;
}

/**L
 * Build headers for IoT Agent requests.
 */
function buildHeaders({ includeJson = false } = {}) {
  const headers = {
    Accept: 'application/json',
    'Fiware-Service': FIWARE_SERVICE,
    'Fiware-ServicePath': FIWARE_SERVICEPATH || '/'
  };

  if (includeJson) { headers['Content-Type'] = 'application/json'; }
  /*if (keystoneToken) {
    headers['X-Auth-Token'] = keystoneToken;
  }*/
  if (sessionToken) {
    headers['X-Auth-Token'] = sessionToken;
    //headers.Authorization = `Bearer ${sessionToken}`;
  }
  return headers;
}

/**
 * Decode JSON metadata persisted in a service description.
 */
function decodeMetadata(value) {
  if (!value) return { name: '', notes: '' };
  if (typeof value !== 'string') return { name: '', notes: '' };

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return {
        name: typeof parsed.name === 'string' ? parsed.name : '',
        notes: typeof parsed.notes === 'string' ? parsed.notes : ''
      };
    }
  } catch (_err) {
    return { name: '', notes: value };
  }

  return { name: '', notes: '' };
}

/**
 * Build a deterministic key representing a service group combination.
 */
function createServiceKey({
  apikey = '',
  resource = '',
  cbroker = '',
  fiwareService = FIWARE_SERVICE,
  subservice = FIWARE_SERVICEPATH || '/',
  entityType = ENTITY_TYPE
} = {}) {
  return [apikey, resource, cbroker, fiwareService, subservice || '/', entityType]
    .map((part) => (part == null ? '' : String(part)))
    .join('|');
}

/**
 * Convert static attributes array into a map for quick lookups.
 */
function toAttributeMap(list) {
  const map = new Map();
  if (!Array.isArray(list)) return map;
  list.forEach((attr) => {
    if (!attr || typeof attr !== 'object') return;
    const key = attr.name || attr.object_id;
    if (!key) return;
    map.set(key, attr.value ?? attr.object_id ?? '');
  });
  return map;
}

/**
 * Return a clean label for a service group.
 */
function getServiceLabel(group) {
  if (!group || typeof group !== 'object') return 'Service';
  const displayName = asNonEmptyString(group.displayName);
  if (displayName) return displayName;
  const resource = asNonEmptyString(group.resource);
  if (resource) return resource;
  const apikey = asNonEmptyString(group.apikey);
  if (apikey) return apikey;
  return 'Service';
}

function findServiceGroupForMachine(machine = {}) {
  if (!serviceGroups.length) return null;
  const candidates = collectMachineServiceCandidates(machine);
  for (const candidate of candidates) {
    const match = serviceGroups.find((group) => serviceGroupMatchesCandidate(group, candidate));
    if (match) return match;
  }
  return null;
}

function collectMachineServiceCandidates(machine = {}) {
  const seen = new Map();

  const registerCandidate = (candidate = {}) => {
    const apikey = asNonEmptyString(candidate.apikey ?? candidate.apiKey ?? candidate.api_key);
    const resource = cleanResourceCandidate(candidate.resource ?? candidate.resource_path ?? candidate.resourcePath);
    const fiwareService = asNonEmptyString(candidate.fiwareService ?? candidate.service);
    const subservice = cleanSubserviceCandidate(candidate.subservice ?? candidate.servicePath);
    const entityType = asNonEmptyString(candidate.entityType ?? candidate.entity_type ?? candidate.type);

    if (!apikey && !resource && !fiwareService && subservice === undefined && !entityType) {
      return;
    }

    const key = [apikey || '', resource || '', fiwareService || '', subservice ?? '', entityType || ''].join('|');
    if (!seen.has(key)) {
      seen.set(key, { apikey, resource, fiwareService, subservice, entityType });
    }
  };

  registerCandidate(machine);

  if (machine.raw && typeof machine.raw === 'object') {
    registerCandidate(machine.raw);
    if (machine.raw.service && typeof machine.raw.service === 'object') {
      registerCandidate(machine.raw.service);
    }
  }

  if (typeof machine.serviceKey === 'string' && machine.serviceKey) {
    const keyCandidate = candidateFromServiceKey(machine.serviceKey);
    if (keyCandidate) registerCandidate(keyCandidate);
  }

  const staticMap = Array.isArray(machine.staticAttributes)
    ? toAttributeMap(machine.staticAttributes)
    : new Map();
  if (staticMap.size) {
    registerCandidate({
      apikey: staticMap.get('serviceGroupApikey'),
      resource: staticMap.get('serviceGroupResource'),
      subservice: staticMap.get('serviceGroupSubservice'),
      fiwareService: staticMap.get('serviceGroupFiware'),
      entityType: staticMap.get('serviceGroupEntityType')
    });
    const staticKey = asNonEmptyString(staticMap.get('serviceGroupKey'));
    if (staticKey) {
      const parsed = candidateFromServiceKey(staticKey);
      if (parsed) registerCandidate(parsed);
    }
  }

  const candidates = Array.from(seen.values()).sort(
    (a, b) => scoreServiceCandidate(b) - scoreServiceCandidate(a)
  );
  return candidates;
}

function candidateFromServiceKey(serviceKey) {
  if (!serviceKey) return null;
  const parts = String(serviceKey).split('|');
  if (!parts.length) return null;
  return {
    apikey: parts[0],
    resource: parts[1],
    fiwareService: parts[3],
    subservice: parts[4],
    entityType: parts[5]
  };
}

function scoreServiceCandidate(candidate = {}) {
  let score = 0;
  if (asNonEmptyString(candidate.apikey)) score += 4;
  if (asNonEmptyString(candidate.resource)) score += 4;
  if (asNonEmptyString(candidate.fiwareService)) score += 1;
  if (candidate.subservice !== undefined && candidate.subservice !== null) score += 1;
  if (asNonEmptyString(candidate.entityType)) score += 1;
  return score;
}

function serviceGroupMatchesCandidate(group, candidate) {
  if (!group || !candidate) return false;
  if (candidate.apikey && asNonEmptyString(group.apikey) !== candidate.apikey) return false;
  if (candidate.resource) {
    const groupResource = cleanResourceCandidate(group.resource);
    if (groupResource !== candidate.resource) return false;
  }
  if (candidate.fiwareService && asNonEmptyString(group.fiwareService) !== candidate.fiwareService) {
    return false;
  }
  if (candidate.subservice !== undefined) {
    const groupSubservice = cleanSubserviceCandidate(group.subservice);
    if (groupSubservice !== candidate.subservice) return false;
  }
  if (candidate.entityType && asNonEmptyString(group.entityType) !== candidate.entityType) {
    return false;
  }
  return true;
}

function cleanResourceCandidate(value) {
  const str = asNonEmptyString(value);
  if (!str) return undefined;
  return normalizeResourcePath(str);
}

function cleanSubserviceCandidate(value) {
  const str = asNonEmptyString(value);
  if (str == null) return undefined;
  if (!str) return undefined;
  return normalizeResourcePath(str) || '/';
}

function getMachineServiceFallback(machine = {}) {
  const candidates = collectMachineServiceCandidates(machine);
  if (candidates.length) {
    const best = candidates[0];
    if (best.resource) return best.resource;
    if (best.apikey) return best.apikey;
    if (best.fiwareService) return `${best.fiwareService}${best.subservice ? ` ${best.subservice}` : ''}`;
  }
  return 'N/A';
}

/**
 * Render loading state for service groups.
 */
function setServiceGroupLoading() {
  if (!serviceGroupsTableBody) return;
  serviceGroupsTableBody.innerHTML =
    "<tr><td colspan='6' class='px-5 py-4 text-center'><i class='fas fa-spinner loading-spinner text-indigo-600'></i></td></tr>";
}

/**
 * Render error state for service groups.
 */
function renderServiceGroupError(err) {
  if (!serviceGroupsTableBody) return;
  const message = escapeHtml(err.message || 'Unknown error');
  serviceGroupsTableBody.innerHTML = `<tr><td colspan='6' class='px-5 py-4 text-center text-sm text-red-500'>${message}</td></tr>`;
}

/**
 * Render loading state for machines.
 */
function setMachinesLoading() {
  if (!machinesTableBody) return;
  machinesTableBody.innerHTML =
    "<tr><td colspan='6' class='px-5 py-4 text-center'><i class='fas fa-spinner loading-spinner text-indigo-600'></i></td></tr>";
}

/**
 * Render error state for machines.
 */
function renderMachinesError(err) {
  if (!machinesTableBody) return;
  const message = escapeHtml(err.message || 'Unknown error');
  machinesTableBody.innerHTML = `<tr><td colspan='6' class='px-5 py-4 text-center text-sm text-red-500'>${message}</td></tr>`;
}

/**
 * Build an error string from an IoT Agent response.
 */
async function extractError(resp) {
  const text = await resp.text();
  if (!text) return resp.statusText || `HTTP ${resp.status}`;
  try {
    const data = JSON.parse(text);
    return data.description || data.error || data.message || text;
  } catch (_err) {
    return text;
  }
}

/**
 * Normalise Context Broker URLs for comparison.
 */
function normalizeCbrokerUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    const pathname = url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${url.host}${pathname}`.toLowerCase();
  } catch (_err) {
    return String(value).trim().replace(/\/+$/, '').toLowerCase();
  }
}

/**
 * Normalise resource paths while keeping case sensitivity.
 */
function normalizeResourcePath(value) {
  if (!value) return '/';
  const trimmed = String(value).trim();
  const withoutTrailing = trimmed.replace(/\/+$/, '');
  return withoutTrailing || '/';
}

function renderServiceGroupBroker(group, { includeUrl = true } = {}) {
  const brokerUrl = resolveServiceGroupBroker(group);
  if (!brokerUrl) {
    return '<div class="text-xs text-gray-500 italic">Not configured</div>';
  }

  const label = escapeHtml(getBrokerLabel(brokerUrl));

  if (!includeUrl) {
    return `<div class="font-semibold text-gray-800">${label}</div>`;
  }

  return `
    <div class="font-semibold text-gray-800">${label}</div>
    <div class="text-xs text-gray-500">${escapeHtml(brokerUrl)}</div>
  `.trim();
}

function resolveServiceGroupBroker(group) {
  if (!group || typeof group !== 'object') return '';

  const direct = asNonEmptyString(group.cbroker);
  if (direct) return direct;

  const fallback = extractBrokerFromSource(group.raw);
  if (fallback) return fallback;

  return asNonEmptyString(IOT_AGENT_CBROKER);
}

function extractBrokerFromSource(source) {
  if (!source) return '';

  const candidates = [
    source.cbroker,
    source.cBroker,
    source.cbBroker,
    source.url,
    source.endpoint
  ];

  for (const candidate of candidates) {
    const value = normalizeBrokerCandidate(candidate);
    if (value) return value;
  }

  return '';
}

function normalizeBrokerCandidate(candidate) {
  if (!candidate) return '';

  if (typeof candidate === 'string') {
    return asNonEmptyString(candidate);
  }

  if (typeof candidate === 'object') {
    if (typeof candidate.url === 'string') {
      const normalized = asNonEmptyString(candidate.url);
      if (normalized) return normalized;
    }
    if (typeof candidate.host === 'string') {
      const protocol = asNonEmptyString(candidate.protocol) || 'http';
      const host = candidate.host.trim();
      if (!host) return '';
      const port = candidate.port ? `:${candidate.port}` : '';
      return `${protocol}://${host}${port}`;
    }
  }

  return '';
}

function asNonEmptyString(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed || '';
}

/**
 * Escape HTML entities for safe rendering.
 */
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Display success/error helper.
 */
function showMessage(node, text, isError = true) {
  if (!node) return;
  node.textContent = text;
  node.classList.remove('hidden', 'text-red-600', 'text-green-600');
  node.classList.add(isError ? 'text-red-600' : 'text-green-600');
}

/**
 * Hide helper message.
 */
function hideMessage(node) {
  if (!node) return;
  node.textContent = '';
  node.classList.add('hidden');
}

/**
 * Render status badge for machines.
 */
function renderStatus(status) {
  const label = status || 'Unknown';
  let style = 'bg-gray-100 text-gray-600';
  if (label.toLowerCase() === 'online') style = 'bg-green-100 text-green-700';
  if (label.toLowerCase() === 'maintenance') style = 'bg-amber-100 text-amber-700';
  if (label.toLowerCase() === 'offline') style = 'bg-red-100 text-red-700';
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}">${escapeHtml(
    label
  )}</span>`;
}

function formatLastSeen(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString();
}
