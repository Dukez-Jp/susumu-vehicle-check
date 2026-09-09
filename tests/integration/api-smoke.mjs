import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

// Build a structurally valid tiny PNG with correct CRCs instead of trusting copied fixture bytes.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const content = Buffer.concat([Buffer.from(type), data]);
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(content));
  return Buffer.concat([size, content, crc]);
}
const pngHeader = Buffer.alloc(13);
pngHeader.writeUInt32BE(1, 0); pngHeader.writeUInt32BE(1, 4); pngHeader[8] = 8; pngHeader[9] = 6;
const fixturePng = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', pngHeader),
  pngChunk('IDAT', deflateSync(Buffer.from([0, 0, 60, 130, 255]))), pngChunk('IEND', Buffer.alloc(0)),
]);

// Explicitly destructive only to new synthetic records in a local DEV API.
const base = new URL(process.env.SUSUMU_API_URL ?? 'http://127.0.0.1:5080/api/v1/');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) {
  throw new Error('Integration smoke permits loopback DEV targets only.');
}
const username = process.env.SUSUMU_TEST_USERNAME;
const password = process.env.SUSUMU_TEST_PASSWORD;
if (!username || !password) throw new Error('Set SUSUMU_TEST_USERNAME/PASSWORD in the process environment.');
const deviceId = `integration-${randomUUID()}`;
const checks = [];
let token;
async function request(path, { body, method = body === undefined ? 'GET' : 'POST', auth = true, headers = {} } = {}) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: { ...(auth && token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  return response;
}
async function json(path, options, expected = 200) {
  const response = await request(path, options);
  if (response.status !== expected) {
    const problem = await response.text();
    throw new Error(`${options?.method ?? (options?.body ? 'POST' : 'GET')} ${path}: expected ${expected}, received ${response.status}; ${problem.slice(0, 1000)}`);
  }
  return response.json();
}
async function check(name, action) {
  const started = performance.now();
  await action();
  checks.push({ name, status: 'passed', milliseconds: Math.round(performance.now() - started) });
  process.stdout.write(`PASS ${name}\n`);
}
let bootstrap, vehicle, template, draft, firstOperation;
await check('unauthenticated resource rejected', async () => {
  assert.equal((await request('vehicles', { auth: false })).status, 401);
});
await check('invalid password rejected', async () => {
  const result = await request('auth/login', { auth: false, body: { username, password: `invalid-${randomUUID()}`, deviceId } });
  assert.equal(result.status, 401);
});
await check('login and authenticated vehicle 714 path', async () => {
  const login = await json('auth/login', { auth: false, body: { username, password, deviceId } });
  assert.ok(login.accessToken && Date.parse(login.expiresAt) > Date.now());
  token = login.accessToken;
  bootstrap = await json('bootstrap');
  vehicle = bootstrap.vehicles.find(v => v.internalNumber === '714');
  assert.ok(vehicle, 'DEV seed must include synthetic vehicle 714');
  const found = await json(`vehicles/${vehicle.id}`);
  assert.equal(found.id, vehicle.id);
  template = bootstrap.templates.find(t => t.published && t.vehicleType === vehicle.type && !t.requiresSignature);
  assert.ok(template, 'DEV seed must include compatible published template without required signature');
  assert.ok(template.sections.flatMap(section => section.items).every(item => ['status', 'measurement'].includes(item.responseType)), 'responseType must use exact lowercase wire values');
});
await check('create draft persisted with server version 1', async () => {
  draft = {
    id: randomUUID(), vehicleId: vehicle.id, templateId: template.id, templateVersion: template.version,
    deviceId, odometerKm: vehicle.currentOdometerKm ?? 0, state: 'Draft', startedAt: new Date().toISOString(),
    finalizedAt: null, items: [], notes: 'Synthetic integration smoke', supersedesInspectionId: null, correctionReason: null, version: 0,
  };
  firstOperation = { operationId: randomUUID(), expectedVersion: 0, inspection: structuredClone(draft) };
  const receipt = await json('sync/inspections', { body: firstOperation });
  assert.equal(receipt.inspectionId, draft.id);
  assert.equal(receipt.version, 1);
  assert.equal((await json(`inspections/${draft.id}`)).state, 'Draft');
});
await check('exact retry returns same version without duplication', async () => {
  const receipt = await json('sync/inspections', { body: firstOperation });
  assert.equal(receipt.version, 1);
  const rows = await json(`inspections?vehicleId=${vehicle.id}`);
  assert.equal(rows.filter(i => i.id === draft.id).length, 1);
});
await check('same operation with different payload rejected', async () => {
  const altered = structuredClone(firstOperation);
  altered.inspection.notes = 'conflicting payload';
  assert.equal((await request('sync/inspections', { body: altered })).status, 409);
});
await check('stale optimistic version rejected', async () => {
  const altered = { ...structuredClone(firstOperation), operationId: randomUUID() };
  assert.equal((await request('sync/inspections', { body: altered })).status, 409);
});
const photoId = randomUUID();
await check('finalization validates answers and records pending photo', async () => {
  const invalid = { ...structuredClone(draft), state: 'Finalized', finalizedAt: new Date().toISOString(), version: 1 };
  const invalidResponse = await request('sync/inspections', { body: { operationId: randomUUID(), expectedVersion: 1, inspection: invalid } });
  assert.equal(invalidResponse.status, 400);
  const definitions = template.sections.flatMap(s => s.items);
  draft.items = definitions.map((item, index) => ({
    itemId: item.id, status: 'OK', value: item.responseType === 'measurement' ? (item.minValue ?? Math.min(item.maxValue ?? 1, 1)) : null,
    notes: 'Verificado em teste sintético', photoIds: index === 0 ? [photoId] : [],
  }));
  draft.state = 'Finalized'; draft.finalizedAt = new Date().toISOString(); draft.version = 1;
  const finalOperation = { operationId: randomUUID(), expectedVersion: 1, inspection: structuredClone(draft) };
  const receipt = await json('sync/inspections', { body: finalOperation });
  assert.equal(receipt.version, 2); assert.equal(receipt.state, 'Finalized');
  assert.equal(receipt.photoUploadState, 'Pending');
  assert.equal((await json('sync/inspections', { body: finalOperation })).version, 2);
});
await check('finalized inspection cannot be changed', async () => {
  const attempted = { ...structuredClone(draft), notes: 'Must not replace original', version: 2 };
  assert.equal((await request('sync/inspections', { body: { operationId: randomUUID(), expectedVersion: 2, inspection: attempted } })).status, 409);
  assert.equal((await json(`inspections/${draft.id}`)).notes, 'Synthetic integration smoke');
});
await check('immutable original upload and authorized read', async () => {
  const bytes = fixturePng;
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const metadata = { id: photoId, inspectionId: draft.id, itemId: draft.items[0].itemId, kind: 'Original', originalPhotoId: null, contentType: 'image/png', sha256, sizeBytes: bytes.length, createdAt: new Date().toISOString() };
  const upload = () => { const form = new FormData(); form.set('file', new Blob([bytes], { type: 'image/png' }), 'synthetic.png'); form.set('metadata', JSON.stringify(metadata)); return form; };
  const response = await request(`inspections/${draft.id}/photos/${photoId}`, { body: upload() });
  assert.ok([200, 201].includes(response.status), `Upload status ${response.status}: ${await response.text()}`);
  assert.ok([200, 201].includes((await request(`inspections/${draft.id}/photos/${photoId}`, { body: upload() })).status));
  const download = await request(`inspections/${draft.id}/photos/${photoId}`);
  assert.equal(download.status, 200);
  assert.equal(createHash('sha256').update(Buffer.from(await download.arrayBuffer())).digest('hex'), sha256);
  assert.equal((await request(`inspections/${draft.id}/photos/${photoId}`, { auth: false })).status, 401);
  assert.equal((await json(`inspections/${draft.id}`)).photoUploadState, 'Complete');
});
await check('dashboard, audit, history and CSV expose accepted work', async () => {
  assert.ok((await json('dashboard')).finalized >= 1);
  assert.ok((await json(`audit?inspectionId=${draft.id}`)).length >= 2);
  const csv = await request('exports/inspections.csv');
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.ok((await csv.text()).includes('714'));
});
await check('inspector cannot administer users or templates', async () => {
  const temporaryPassword = `T3st-${randomUUID()}!`;
  const newUsername = `smoke-${randomUUID().slice(0, 8)}`;
  const created = await request('users', { body: { name: 'Synthetic Inspector', username: newUsername, password: temporaryPassword, role: 'Inspector', locationId: bootstrap.user.locationId } });
  assert.ok([200, 201].includes(created.status), `Create user returned ${created.status}`);
  const previousToken = token;
  const login = await json('auth/login', { auth: false, body: { username: newUsername, password: temporaryPassword, deviceId: randomUUID() } });
  token = login.accessToken;
  assert.equal((await request('users')).status, 403);
  assert.equal((await request('templates', { body: { name: 'Forbidden', vehicleType: vehicle.type, sections: [] } })).status, 403);
  assert.equal((await request('company')).status, 403);
  assert.equal((await request('employees')).status, 403);
  assert.equal((await request('vehicle-types')).status, 200);
  assert.equal((await request('vehicle-types', { body: { code: 'Forbidden', name: 'Forbidden' } })).status, 403);
  token = previousToken;
});

async function createdJson(path, body) {
  const response = await request(path, { body });
  const text = await response.text();
  assert.ok([200, 201].includes(response.status), `${path}: ${response.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}
await check('company, location and employee administration preserve records', async () => {
  assert.equal((await json('company')).id, bootstrap.user.companyId);
  const suffix = randomUUID().slice(0, 8);
  const location = await createdJson('locations', { name: `Synthetic workshop ${suffix}` });
  const employee = await createdJson('employees', {
    userId: null, employeeNumber: `SM-${suffix}`, name: 'Synthetic Employee', locationId: location.id, active: true,
  });
  assert.equal(employee.locationId, location.id);
  await json(`employees/${employee.id}`, { method: 'PUT', body: {
    userId: null, employeeNumber: employee.employeeNumber, name: employee.name, locationId: location.id, active: false,
  } });
  assert.equal((await json('employees')).find(row => row.id === employee.id).active, false);
  await json(`locations/${location.id}`, { method: 'PUT', body: { name: location.name, active: false } });
  assert.equal((await json('locations')).find(row => row.id === location.id).active, false);
});

let signatureTemplate, signedDraft;
await check('publish signature policy and persist offline signature declaration', async () => {
  signatureTemplate = await createdJson('templates', {
    name: `Synthetic signature ${randomUUID().slice(0, 8)}`, vehicleType: vehicle.type, requiresSignature: true,
    sections: [{ title: 'Synthetic section', items: [{ label: 'Visual check', responseType: 'status', required: true }] }],
  });
  await json(`templates/${signatureTemplate.id}/publish`, { method: 'POST' });
  signatureTemplate = (await json('templates')).find(row => row.id === signatureTemplate.id);
  assert.equal(signatureTemplate.requiresSignature, true);
  signedDraft = {
    ...structuredClone(draft), id: randomUUID(), templateId: signatureTemplate.id, templateVersion: signatureTemplate.version,
    state: 'Draft', finalizedAt: null, startedAt: new Date().toISOString(), version: 0, notes: 'Synthetic signed inspection',
    items: [{ itemId: signatureTemplate.sections[0].items[0].id, status: 'OK', value: null, notes: '', photoIds: [] }],
    signaturePhotoId: null,
  };
  assert.equal((await json('sync/inspections', { body: { operationId: randomUUID(), expectedVersion: 0, inspection: signedDraft } })).version, 1);
  const finalized = { ...structuredClone(signedDraft), state: 'Finalized', finalizedAt: new Date().toISOString(), version: 1 };
  assert.equal((await request('sync/inspections', { body: { operationId: randomUUID(), expectedVersion: 1, inspection: finalized } })).status, 400);
  signedDraft = { ...finalized, signaturePhotoId: randomUUID() };
});
await check('retired template stays in history and accepts previously saved work', async () => {
  const retired = await request(`templates/${signatureTemplate.id}/retire`, { method: 'POST' });
  assert.ok([200, 204].includes(retired.status));
  assert.ok(!(await json('bootstrap')).templates.some(row => row.id === signatureTemplate.id));
  assert.equal((await json('templates')).find(row => row.id === signatureTemplate.id).active, false);
  const receipt = await json('sync/inspections', { body: { operationId: randomUUID(), expectedVersion: 1, inspection: signedDraft } });
  assert.equal(receipt.state, 'Finalized'); assert.equal(receipt.photoUploadState, 'Pending');
});
await check('declared signature uploads after finalization, undeclared signature rejected', async () => {
  const bytes = fixturePng;
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const upload = id => {
    const form = new FormData(); form.set('file', new Blob([bytes], { type: 'image/png' }), 'signature.png');
    form.set('metadata', JSON.stringify({ id, itemId: null, kind: 'Signature', originalPhotoId: null, contentType: 'image/png', sha256, sizeBytes: bytes.length }));
    return form;
  };
  const id = signedDraft.signaturePhotoId;
  assert.ok([200, 201].includes((await request(`inspections/${signedDraft.id}/photos/${id}`, { body: upload(id) })).status));
  assert.equal((await json(`inspections/${signedDraft.id}`)).photoUploadState, 'Complete');
  const undeclared = randomUUID();
  assert.equal((await request(`inspections/${signedDraft.id}/photos/${undeclared}`, { body: upload(undeclared) })).status, 409);
});
await check('history pagination retrieves distinct records and rejects invalid offset', async () => {
  const page1 = await json(`inspections?vehicleId=${vehicle.id}&offset=0&limit=1`);
  const page2 = await json(`inspections?vehicleId=${vehicle.id}&offset=1&limit=1`);
  assert.equal(page1.length, 1); assert.equal(page2.length, 1); assert.notEqual(page1[0].id, page2[0].id);
  assert.equal((await request('inspections?offset=-1')).status, 400);
});

let catalogType, catalogVehicle, optionsTemplate, optionsDraft;
await check('vehicle type catalog preserves stable codes and rejects duplicate aliases', async () => {
  const suffix = randomUUID().slice(0, 8);
  catalogType = await createdJson('vehicle-types', { code: `SM-${suffix}`, name: 'Synthetic type' });
  assert.equal((await json('vehicle-types')).find(row => row.id === catalogType.id).active, true);
  assert.equal((await request('vehicle-types', { body: { code: catalogType.code.toLowerCase(), name: 'Duplicate alias' } })).status, 409);
  catalogVehicle = await createdJson('vehicles', {
    internalNumber: `TYPE-${suffix}`, plate: null, type: catalogType.code,
    locationId: bootstrap.user.locationId, currentOdometerKm: 0, active: true,
  });
  assert.equal(catalogVehicle.type, catalogType.code);
});
await check('configured answer options persist and constrain finalization without blocking drafts', async () => {
  const definition = {
    name: `Synthetic options ${randomUUID().slice(0, 8)}`, vehicleType: catalogType.code, requiresSignature: false,
    sections: [{ title: 'Options', items: [{ label: 'Condition', responseType: 'status', required: true, allowedStatuses: ['OK', 'Repair'] }] }],
  };
  const invalid = structuredClone(definition); invalid.sections[0].items[0].allowedStatuses = [];
  assert.equal((await request('templates', { body: invalid })).status, 400);
  optionsTemplate = await createdJson('templates', definition);
  await json(`templates/${optionsTemplate.id}/publish`, { method: 'POST' });
  const pinned = await json(`templates/${optionsTemplate.id}`);
  assert.deepEqual(pinned.sections[0].items[0].allowedStatuses, ['OK', 'Repair']);
  optionsDraft = {
    id: randomUUID(), vehicleId: catalogVehicle.id, templateId: pinned.id, templateVersion: pinned.version,
    deviceId, odometerKm: 0, state: 'Draft', startedAt: new Date().toISOString(), finalizedAt: null,
    items: [{ itemId: pinned.sections[0].items[0].id, status: 'NotApplicable', value: null, notes: '', photoIds: [] }],
    notes: 'Synthetic configurable-option inspection', version: 0,
  };
  assert.equal((await json('sync/inspections', { body: { operationId: randomUUID(), expectedVersion: 0, inspection: optionsDraft } })).version, 1);
  const rejected = { ...structuredClone(optionsDraft), state: 'Finalized', finalizedAt: new Date().toISOString(), version: 1 };
  rejected.items[0].status = 'Attention';
  assert.equal((await request('sync/inspections', { body: { operationId: randomUUID(), expectedVersion: 1, inspection: rejected } })).status, 400);
  rejected.items[0].status = 'Repair';
  assert.equal((await json('sync/inspections', { body: { operationId: randomUUID(), expectedVersion: 1, inspection: rejected } })).state, 'Finalized');
});
await check('retired vehicle types retain existing history but reject new assignments and templates', async () => {
  const retired = await json(`vehicle-types/${catalogType.id}`, { method: 'PUT', body: { name: 'Synthetic retired type', active: false } });
  assert.equal(retired.code, catalogType.code); assert.equal(retired.active, false);
  assert.equal((await request('vehicles', { body: { internalNumber: `BLOCKED-${randomUUID().slice(0, 8)}`, type: catalogType.code, locationId: bootstrap.user.locationId, active: true } })).status, 400);
  assert.equal((await json(`vehicles/${catalogVehicle.id}`, { method: 'PUT', body: { type: catalogType.code, plate: 'SYNTHETIC' } })).type, catalogType.code);
  assert.equal((await request('templates', { body: {
    name: `Rejected retired type ${randomUUID().slice(0, 8)}`, vehicleType: catalogType.code,
    sections: [{ title: 'New', items: [{ label: 'New', responseType: 'status', required: false }] }],
  } })).status, 400);
  assert.equal((await json(`inspections/${optionsDraft.id}`)).state, 'Finalized');
  assert.deepEqual((await json(`templates/${optionsTemplate.id}`)).sections[0].items[0].allowedStatuses, ['OK', 'Repair']);
});
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/api-smoke.json', JSON.stringify({ at: new Date().toISOString(), checks, inspectionId: draft.id, vehicle: '714', fixtureOnly: true }, null, 2));
process.stdout.write(`Passed ${checks.length} API integration checks against real local PostgreSQL.\n`);
