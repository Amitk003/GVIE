import type { Metadata } from 'next';
import { CaptureForm } from '../components/CaptureForm';
import { readApiBase, requestUploadSignature } from '../lib/api';

export const metadata: Metadata = {
  title: 'GVIE: proof of work',
  description: 'Send a photo that can be trusted, and see the proof of what changed.',
};

/**
 * The field page.
 *
 * The browser asks our API for a signature, then sends the file straight to
 * Cloudinary. Cloudinary keys never reach the browser. If the API is not
 * running, the page still loads and the worker sees a clear message instead of
 * a broken screen.
 */
export default async function CapturePage() {
  const apiBase = readApiBase();

  async function send(body: Record<string, unknown>) {
    'use server';
    await requestUploadSignature(apiBase, body);
  }

  return (
    <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <CaptureForm onSend={send} />
    </main>
  );
}
