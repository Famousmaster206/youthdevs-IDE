import JSZip from 'jszip';

const EXCLUDED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.pdf', '.zip', '.tar', '.gz',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.db', '.sqlite', '.sqlite3',
  '.bin', '.exe', '.dll', '.so', '.dylib', '.class', '.pyc', '.pyo',
  '.woff', '.woff2', '.eot', '.ttf', '.svg', '.lock', '.log', '.map',
]);

const EXCLUDED_FILENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'poetry.lock',
  '.ds_store',
  '.gitignore',
  '.env',
  '.env.local',
  '.env.production',
]);

const EXCLUDED_DIR_SEGMENTS = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', 'target',
  '.venv', 'venv', '__pycache__', '.idea', '.vscode', '.next', '.turbo',
  'coverage', '.gradle', 'bin', 'obj', 'tmp', 'temp',
]);

const MAX_FILE_BYTES = 300 * 1024;
const MAX_ZIP_BYTES = 40 * 1024 * 1024;

function normalizePath(rawPath, fallbackName) {
  const path = String(rawPath || fallbackName || '').replace(/^\/+/, '').replace(/\\/g, '/');
  return path || fallbackName || 'unknown.txt';
}

function shouldSkipFile(relPath, byteLength) {
  const segments = relPath.split('/');
  if (segments.some((segment) => EXCLUDED_DIR_SEGMENTS.has(segment.toLowerCase()))) {
    return 'excluded directory';
  }

  const base = segments[segments.length - 1]?.toLowerCase() || '';
  const ext = base.includes('.') ? `.${base.split('.').pop()}` : '';

  if (EXCLUDED_FILENAMES.has(base)) return 'excluded filename';
  if (EXCLUDED_EXTENSIONS.has(ext)) return 'excluded extension';
  if (byteLength > MAX_FILE_BYTES) return 'file too large';
  return null;
}

export async function buildProjectZip(projectFiles, projectSlug = 'project') {
  if (!Array.isArray(projectFiles) || projectFiles.length === 0) {
    throw new Error('No project files were available to package.');
  }

  const zip = new JSZip();
  let includedCount = 0;
  let skippedCount = 0;

  for (const file of projectFiles) {
    const relPath = normalizePath(file?.path || file?.name, file?.name);
    const content = typeof file?.content === 'string' ? file.content : '';
    const byteLength = new TextEncoder().encode(content).length;
    const skipReason = shouldSkipFile(relPath, byteLength);

    if (skipReason) {
      skippedCount += 1;
      continue;
    }

    zip.file(relPath, content);
    includedCount += 1;
  }

  if (includedCount === 0) {
    throw new Error('No eligible project files remained after filtering noise and large binaries.');
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  if (blob.size > MAX_ZIP_BYTES) {
    throw new Error('Project archive exceeds the 40 MB upload limit.');
  }

  const safeSlug = String(projectSlug || 'project').replace(/[^a-zA-Z0-9._-]/g, '_');

  return {
    blob,
    filename: `${safeSlug}.zip`,
    includedCount,
    skippedCount,
    sizeBytes: blob.size,
  };
}
