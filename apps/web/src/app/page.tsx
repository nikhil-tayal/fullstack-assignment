import { UploadForm } from '@/components/upload/upload-form';

export default function UploadPage() {
  return (
    <main className="shell py-10">
      <header className="max-w-2xl">
        <h1 className="font-display text-title tracking-tight">Upload the registry</h1>
        <p className="mt-2 text-ink-soft">
          Entities, ownership and filings, read and checked together. If anything is wrong,
          every problem is reported at once with the file, the line and the column, and nothing
          is stored until they are fixed.
        </p>
      </header>

      <div className="mt-8">
        <UploadForm />
      </div>
    </main>
  );
}
