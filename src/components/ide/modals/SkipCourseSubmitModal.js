'use client';

import { useCallback, useEffect, useState } from 'react';
import { CloudUpload, ExternalLink, Loader2, LogIn, Save } from 'lucide-react';
import {
  clearSkipCourseSession,
  connectSkipCourseAccount,
  getSkipCourseSession,
} from '../../../lib/skipcourse-session';
import { buildProjectZip } from '../../../lib/project-zip';
import { slugifyProjectName } from '../../../lib/ide-utils';

async function readAgenticNdjson(response, onEvent) {
  if (!response.body) {
    throw new Error('Submission returned an empty response body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;
  let streamError = null;

  const handleLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      return;
    }

    if (event.type === 'status' || event.type === 'tool_call') {
      onEvent?.(event);
      return;
    }
    if (event.type === 'error') {
      streamError = event.error || 'Submission failed.';
      onEvent?.(event);
      return;
    }
    if (event.type === 'result') {
      result = event;
      onEvent?.(event);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      handleLine(line);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    handleLine(buffer);
  }

  if (streamError) {
    throw new Error(streamError);
  }
  if (!result) {
    throw new Error('Submission completed without a result.');
  }
  return result;
}

export default function SkipCourseSubmitModal({
  open,
  theme,
  project,
  onClose,
}) {
  const [session, setSession] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [toolCalls, setToolCalls] = useState([]);
  const [jobResult, setJobResult] = useState(null);

  const projectName = project?.name || 'project';
  const projectSlug = slugifyProjectName(project?.slug || projectName || project?.id || 'project');

  const resetFlow = useCallback(() => {
    setError('');
    setStatusMessage('');
    setToolCalls([]);
    setJobResult(null);
    setSubmitting(false);
    setConnecting(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    resetFlow();
    setSession(getSkipCourseSession());
  }, [open, resetFlow]);

  const handleConnect = async () => {
    setError('');
    setConnecting(true);
    try {
      const nextSession = await connectSkipCourseAccount();
      setSession(nextSession);
    } catch (connectError) {
      setError(connectError?.message || 'Could not connect SkipCourse account.');
    } finally {
      setConnecting(false);
    }
  };

  const handleChangeAccount = () => {
    clearSkipCourseSession();
    setSession(null);
    setJobResult(null);
    setError('');
    setStatusMessage('');
    setToolCalls([]);
  };

  const handleSubmit = async () => {
    const activeSession = session || getSkipCourseSession();
    if (!activeSession?.uid) {
      setError('Connect your SkipCourse account before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');
    setJobResult(null);
    setToolCalls([]);
    setStatusMessage('Packaging project files...');

    try {
      const files = Array.isArray(project?.files) ? project.files : [];
      const zipPackage = await buildProjectZip(files, projectSlug);

      setStatusMessage(`Uploading ${zipPackage.includedCount} files (${Math.round(zipPackage.sizeBytes / 1024)} KB)...`);

      const formData = new FormData();
      formData.append('file', zipPackage.blob, zipPackage.filename);
      formData.append('student_id', activeSession.uid);
      formData.append('essay_name', projectName);
      formData.append('description', `Submitted from YouthDevs IDE: ${projectName}`);
      formData.append('stream', '1');

      const response = await fetch('/api/agentic-preprocess', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'SkipCourse rejected the submission.');
      }

      const result = await readAgenticNdjson(response, (event) => {
        if (event.type === 'status') {
          setStatusMessage(event.message || 'Processing...');
          return;
        }
        if (event.type === 'tool_call') {
          const entry = {
            id: `${Date.now()}-${event.name}`,
            summary: event.summary || event.name,
          };
          setToolCalls((prev) => [...prev, entry].slice(-8));
          setStatusMessage(entry.summary);
        }
      });

      setJobResult(result);
      setStatusMessage('Submission complete!');
    } catch (submitError) {
      setError(submitError?.message || 'Failed to submit to SkipCourse.');
      setStatusMessage('');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const cardClass = theme === 'dark'
    ? 'bg-[#08140d] border-emerald-900/30 text-slate-200'
    : 'bg-white border-emerald-200 text-slate-900';

  return (
    <div className="fixed inset-0 bg-[#050b08]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className={`w-full max-w-lg border p-6 rounded-2xl shadow-2xl transition-all ${cardClass}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-500">
            <Save size={16} />
          </div>
          <div>
            <h3 className="text-base font-bold">Send to SkipCourse</h3>
            <p className="text-[11px] text-slate-500">{projectName}</p>
          </div>
        </div>

        {jobResult ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-sm font-semibold text-emerald-600">Project submitted for assessment</p>
              <p className="text-xs text-slate-500 mt-1 font-mono">Job ID: {jobResult.job_id}</p>
            </div>
            <div className="flex gap-2 justify-end">
              <a
                href="https://skipcourse.com/projects"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
              >
                <ExternalLink size={14} />
                View on SkipCourse
              </a>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg border border-emerald-900/30 hover:bg-[#0b1810] text-slate-300 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!session ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Sign in with your SkipCourse student account to submit this project for assessment.
                </p>
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold py-2.5 rounded-lg transition"
                >
                  {connecting ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                  {connecting ? 'Waiting for sign-in...' : 'Log in with SkipCourse'}
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3 text-xs">
                <p className="font-semibold text-emerald-600">Connected</p>
                <p className="text-slate-500 mt-1">{session.email || session.uid}</p>
                <button
                  type="button"
                  onClick={handleChangeAccount}
                  disabled={submitting}
                  className="mt-2 text-[11px] text-emerald-600 hover:underline"
                >
                  Change account
                </button>
              </div>
            )}

            {statusMessage && (
              <div className="flex items-start gap-2 text-xs text-slate-500">
                {submitting && <Loader2 size={14} className="animate-spin shrink-0 mt-0.5" />}
                <span>{statusMessage}</span>
              </div>
            )}

            {toolCalls.length > 0 && (
              <div className="rounded-lg border border-emerald-900/20 bg-[#050b08]/40 p-3 space-y-1 max-h-28 overflow-y-auto">
                {toolCalls.map((entry) => (
                  <p key={entry.id} className="text-[10px] font-mono text-slate-500 truncate">
                    {entry.summary}
                  </p>
                ))}
              </div>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-2 justify-end text-xs font-bold">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2.5 rounded-lg border transition border-emerald-900/30 hover:bg-[#0b1810] text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!session || submitting || connecting}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg transition shadow-md shadow-emerald-950/20"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />}
                {submitting ? 'Submitting...' : 'Submit project'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
