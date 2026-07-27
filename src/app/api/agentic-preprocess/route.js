import { NextResponse } from 'next/server';

const DEFAULT_AGENTIC_URL =
  'https://us-central1-skip-class-slsru4.cloudfunctions.net/agentic-pre-processor';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const studentId = String(formData.get('student_id') || '').trim();

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'A ZIP archive is required.' }, { status: 400 });
    }
    if (!studentId) {
      return NextResponse.json({ error: 'student_id is required.' }, { status: 400 });
    }

    const upstreamForm = new FormData();
    upstreamForm.append('file', file, file.name || 'project.zip');
    upstreamForm.append('student_id', studentId);

    const essayName = String(formData.get('essay_name') || '').trim();
    if (essayName) upstreamForm.append('essay_name', essayName);

    const description = String(formData.get('description') || '').trim();
    if (description) upstreamForm.append('description', description);

    upstreamForm.append('stream', '1');

    const upstreamUrl = process.env.AGENTIC_PREPROCESSOR_URL || DEFAULT_AGENTIC_URL;
    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/x-ndjson',
      },
      body: upstreamForm,
    });

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text().catch(() => '');
      return NextResponse.json(
        { error: errorText || 'Agentic pre-processor rejected the submission.' },
        { status: upstreamResponse.status },
      );
    }

    const contentType = upstreamResponse.headers.get('content-type') || 'application/x-ndjson';
    const body = upstreamResponse.body;

    if (!body) {
      const text = await upstreamResponse.text();
      return new NextResponse(text, {
        status: upstreamResponse.status,
        headers: { 'Content-Type': contentType },
      });
    }

    return new NextResponse(body, {
      status: upstreamResponse.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Agentic pre-processor proxy failed:', error);
    return NextResponse.json(
      { error: error?.message || 'Unable to reach the agentic pre-processor.' },
      { status: 502 },
    );
  }
}
