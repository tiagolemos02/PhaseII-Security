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
  machineAttributes,
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

  applyServiceDefaults();
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
  if (!machinesTableBody) return;
  loadingMachines = true;
  setMachinesLoading();

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
    machines = entries.map(normalizeDevice);
    await syncMachineActivityData();
    updateMachineStatusesFromStore();
    hideMessage(machineMsg);
  } catch (error) {
    console.error('Error loading machines:', error);
    machines = [];
    renderMachinesError(error);
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
  const attributesRaw = machineAttributes?.value.trim() || '';

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

  let attributes = [];
  if (attributesRaw) {
    try {
      const parsed = JSON.parse(attributesRaw);
      if (!Array.isArray(parsed)) throw new Error('Attributes JSON must be an array.');
      attributes = parsed;
    } catch (error) {
      showMessage(machineMsg, `Attributes JSON error: ${error.message}`);
      return;
    }
  }

  const staticAttributes = buildStaticAttributes({
    friendlyName,
    model,
    description,
    status
  });

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
          <td class="px-5 py-3 text-sm font-semibold text-gray-800">${escapeHtml(group.apikey || 'N/A')}</td>
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
      "<tr><td colspan='5' class='px-5 py-4 text-center text-gray-500'>No machines registered.</td></tr>";
  } else {
    const rows = machines
      .slice()
      .sort((a, b) => a.deviceId.localeCompare(b.deviceId))
      .map((machine) => {
        const service =
          machine.serviceKey
            ? serviceGroups.find((svc) => svc.key === machine.serviceKey)
            : serviceGroups.find(
                (svc) =>
                  svc.apikey === machine.apikey &&
                  svc.resource === machine.resource
              );
        const serviceLabel =
          service ? getServiceLabel(service) : machine.apikey || machine.resource || 'N/A';
        const details = [];

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
          details.push(
            `<div class="text-xs text-gray-500 mt-2">Last data: ${escapeHtml(formatLastSeen(machine.lastSeen))}</div>`
          );
        }

        details.push(
          `<div class="text-xs text-gray-500">Attributes: ${machine.attributes.length}</div>`
        );

        return `
        <tr>
          <td class="px-5 py-3 text-sm font-medium text-gray-900">${escapeHtml(machine.deviceId)}</td>
          <td class="px-5 py-3 text-sm text-gray-700">
            <div class="font-semibold text-gray-800">${escapeHtml(machine.friendlyName || machine.entityName)}</div>
            ${
              machine.entityName
                ? `<div class="text-xs text-gray-500">${escapeHtml(machine.entityName)}</div>`
                : ''
            }
          </td>
          <td class="px-5 py-3 text-sm text-gray-700">${escapeHtml(serviceLabel)}</td>
          <td class="px-5 py-3 text-sm">${renderStatus(machine.currentStatus || machine.status || 'Unknown')}</td>
          <td class="px-5 py-3 text-sm text-gray-700">${details.join('')}</td>
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

/**
 * Create static attributes payload from form fields.
 */
function buildStaticAttributes({ friendlyName, model, description, status }) {
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
function normalizeDevice(entry = {}) {
  const staticMap = toAttributeMap(entry.static_attributes);
  const serviceInfo = entry.service || {};
  const apikey = serviceInfo.apikey ?? entry.apikey ?? '';
  const resource = serviceInfo.resource ?? entry.resource ?? '';
  const cbroker = serviceInfo.cbroker ?? entry.cbroker ?? '';
  const fiwareService = serviceInfo.service || entry.service || FIWARE_SERVICE;
  const subservice = serviceInfo.subservice || entry.subservice || FIWARE_SERVICEPATH || '/';
  const entityType = entry.entity_type || serviceInfo.entity_type || ENTITY_TYPE;
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
    serviceKey: createServiceKey({ apikey, resource, cbroker, fiwareService, subservice, entityType }),
    friendlyName: staticMap.get('friendlyName') || '',
    model: staticMap.get('model') || '',
    notes: staticMap.get('notes') || '',
    status: staticMap.get('operationalStatus') || '',
    raw: entry
  };
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
  return group.displayName || group.apikey || group.resource || 'Service';
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
    "<tr><td colspan='5' class='px-5 py-4 text-center'><i class='fas fa-spinner loading-spinner text-indigo-600'></i></td></tr>";
}

/**
 * Render error state for machines.
 */
function renderMachinesError(err) {
  if (!machinesTableBody) return;
  const message = escapeHtml(err.message || 'Unknown error');
  machinesTableBody.innerHTML = `<tr><td colspan='5' class='px-5 py-4 text-center text-sm text-red-500'>${message}</td></tr>`;
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
