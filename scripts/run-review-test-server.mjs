// Disposable fictional profile and deterministic OCR companion for browser tests.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
const profile = mkdtempSync(join(tmpdir(), 'shiftlens-review-e2e-'));
mkdirSync(join(profile, 'data'));
mkdirSync(join(profile, 'photo-inbox'));
await sharp({ create: { width: 600, height: 1200, channels: 3, background: '#fff' } }).png().toFile(join(profile, 'photo-inbox/paper.png'));
const employees = ['one', 'two'].map((id) => ({ id, displayName: `Fictional ${id}`, aliases: [] }));
const extraction = { providerName: 'fixture', extractedAt: '2026-07-06T00:00:00Z', imageWidth: 600, imageHeight: 1200, rawEmployeeName: 'Fictional one', rawDate: null, rawStartTime: '09:00', rawFinishTime: '17:00', rawBreak: '0', confidences: { employee: 1, start: 1, finish: 1, break: 1 }, coordinates: { employee: { x: 30, y: 600, width: 60, height: 30 }, start: null, finish: null, break: null } };
const weeks = ['lifecycle', 'network', 'add', 'geometry', 'concurrency', 'failure'].map((id) => ({ id, weekStarting: '2026-07-06', status: 'open', documents: [{ id: `paper-${id}`, documentType: 'daily_sheet', documentDate: '2026-07-06', filename: 'paper.png', path: 'photo-inbox/paper.png', qualityWarnings: [] }], photoAssignments: [], employees, shifts: [{ id: `ocr-${id}`, employeeId: 'one', employeeName: 'Fictional one', date: '2026-07-06', startTime: '09:00', finishTime: '17:00', breakMinutes: 0, status: 'uncertain', sourceDocument: 'paper.png', sourceDocumentId: `paper-${id}`, sourceRowId: '3', extraction, corrections: [] }], payroll: [], reviewItems: [] }));
writeFileSync(join(profile, 'data/local-week.json'), JSON.stringify(weeks[0]));
writeFileSync(join(profile, 'data/local-extra-weeks.json'), JSON.stringify(weeks.slice(1)));
const ocr = createServer(async (req, res) => {
  res.setHeader('content-type', 'application/json');
  if (req.url === '/health') return res.end(JSON.stringify({ ocrEngineAvailable: true }));
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const cell = (rawValue) => ({ rawValue, normalisedValue: rawValue, confidence: 1 });
  res.end(JSON.stringify({ documentType: 'daily_sheet', date: body.expectedDate, providerName: 'fixture', imageWidth: 600, imageHeight: 1200, qualityWarnings: [], detectedText: [], unresolvedFields: [], rows: [{ rowIndex: 99, rawEmployeeName: 'Fictional one', matchedEmployeeId: 'one', employeeMatchConfidence: 1, start: cell('10:00'), finish: cell('18:00'), break: { ...cell('0'), minutes: 0 }, reviewRequired: true, reviewReasons: [] }] }));
});
await new Promise((resolve) => ocr.listen(0, '127.0.0.1', resolve));
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3101'], { stdio: 'inherit', env: {
  ...process.env, SHIFT_LENS_DATA_MODE: 'local', SHIFT_LENS_PROFILE_DIR: profile,
  SHIFT_LENS_BACKUP_DIR: join(profile, 'backups'), OCR_SERVICE_URL: `http://127.0.0.1:${ocr.address().port}`,
  // Empty values also prevent Next's .env.local loader from restoring real credentials.
  // Fictional review fixtures must never publish to the configured production site.
  SHIFT_LENS_SYNC_URL: '', SHIFT_LENS_SYNC_TOKEN: '', SHIFT_LENS_SYNC_SOURCE_ID: '',
  TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: '', BETTER_AUTH_URL: '', BETTER_AUTH_SECRET: '',
  SHIFT_LENS_HOSTED_COMPANY_ID: '', SHIFT_LENS_HOSTED_OWNER_EMAIL: '',
  OPENAI_API_KEY: '', OPENAI_VISION_MODEL: ''
} });
let stopping = false;
function stop() { if (stopping) return; stopping = true; child.kill('SIGTERM'); }
process.on('SIGTERM', stop); process.on('SIGINT', stop);
child.on('exit', (code) => { ocr.close(); rmSync(profile, { recursive: true, force: true }); process.exit(code ?? 0); });
