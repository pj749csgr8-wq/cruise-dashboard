import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../../lib/supabase/server";
import {
  deleteCruiseDocument,
  uploadCruiseDocument,
} from "./actions";

const BUCKET_NAME = "cruise-documents";

type Cruise = {
  id: string;
  cruise_line: string;
  ship_name: string;
  departure_date: string;
};

type CruiseDocument = {
  id: string;
  file_name: string;
  file_path: string;
  document_type: string;
  description: string | null;
  uploaded_at: string;
  signedUrl: string | null;
};

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: cruise, error: cruiseError } = await supabase
    .from("cruises")
    .select("id, cruise_line, ship_name, departure_date")
    .eq("id", id)
    .single();

  if (cruiseError || !cruise) {
    notFound();
  }

  const { data: documentData, error: documentError } =
    await supabase
      .from("cruise_documents")
      .select(
        `
          id,
          file_name,
          file_path,
          document_type,
          description,
          uploaded_at
        `
      )
      .eq("cruise_id", id)
      .order("uploaded_at", { ascending: false });

  const documentsWithUrls: CruiseDocument[] = await Promise.all(
    (documentData ?? []).map(async (document) => {
      const { data } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(document.file_path, 3600, {
          download: document.file_name,
        });

      return {
        ...document,
        signedUrl: data?.signedUrl ?? null,
      };
    })
  );

  const typedCruise = cruise as Cruise;
  const uploadForCruise = uploadCruiseDocument.bind(null, id);

  return (
    <main className="relative min-h-screen bg-[url('/cruise-background.jpg')] bg-cover bg-center bg-fixed px-6 py-10 text-slate-900 before:absolute before:inset-0 before:bg-slate-950/70">
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-6">
          <Link
            href={`/dashboard/cruises/${id}`}
            className="inline-flex rounded-xl border border-white/30 bg-white/10 px-4 py-2 font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            ← Back to cruise overview
          </Link>
        </div>

        <section className="overflow-hidden rounded-3xl border border-white/20 bg-white/95 shadow-2xl backdrop-blur-md">
          <div className="h-3 bg-blue-700" />

          <div className="p-6 sm:p-10">
            <header className="border-b border-slate-200 pb-7">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
                {typedCruise.cruise_line}
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                {typedCruise.ship_name} Documents
              </h1>

              <p className="mt-2 text-slate-600">
                Sailing {formatDate(typedCruise.departure_date)}
              </p>
            </header>

            <nav className="mt-8 grid gap-3 sm:grid-cols-3">
              <TabLink
                href={`/dashboard/cruises/${id}`}
                label="Overview"
              />

              <TabLink
                href={`/dashboard/cruises/${id}/excursions`}
                label="Excursions"
              />

              <TabLink
                href={`/dashboard/cruises/${id}/documents`}
                label="Documents & Receipts"
                active
              />
            </nav>

            {documentError && (
              <div className="mt-8 rounded-2xl border border-red-300 bg-red-50 p-5 text-red-800">
                <p className="font-bold">
                  Documents could not be loaded
                </p>

                <p className="mt-1 text-sm">
                  {documentError.message}
                </p>
              </div>
            )}

            <section className="mt-8">
              <h2 className="text-2xl font-bold">
                Uploaded documents
              </h2>

              {documentsWithUrls.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <h3 className="text-xl font-bold">
                    No documents uploaded
                  </h3>

                  <p className="mt-2 text-slate-600">
                    Upload a confirmation, invoice, receipt or other
                    cruise document below.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  {documentsWithUrls.map((document) => (
                    <DocumentCard
                      key={document.id}
                      cruiseId={id}
                      document={document}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10 border-t border-slate-200 pt-8">
              <h2 className="text-2xl font-bold">
                Upload a document
              </h2>

              <p className="mt-2 text-slate-600">
                Maximum file size: 10 MB. Supported files include PDF,
                images, Word documents, Excel spreadsheets and text
                files.
              </p>

              <form
                action={uploadForCruise}
                className="mt-6 space-y-6"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="document_type"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Document type
                    </label>

                    <select
                      id="document_type"
                      name="document_type"
                      defaultValue="Booking confirmation"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    >
                      <option>Booking confirmation</option>
                      <option>Receipt</option>
                      <option>Invoice</option>
                      <option>Payment confirmation</option>
                      <option>Travel insurance</option>
                      <option>Excursion confirmation</option>
                      <option>Flight document</option>
                      <option>Hotel document</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="file"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      File
                    </label>

                    <input
                      id="file"
                      name="file"
                      type="file"
                      required
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx,.xls,.xlsx"
                      className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-blue-100 file:px-4 file:py-2 file:font-bold file:text-blue-800"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Description
                  </label>

                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    placeholder="Optional notes explaining this document."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <button
                  type="submit"
                  className="rounded-xl bg-blue-700 px-6 py-3 font-bold text-white transition hover:bg-blue-800"
                >
                  Upload document
                </button>
              </form>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function DocumentCard({
  cruiseId,
  document,
}: {
  cruiseId: string;
  document: CruiseDocument;
}) {
  const deleteThisDocument = deleteCruiseDocument.bind(
    null,
    cruiseId,
    document.id
  );

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-2xl">
          📄
        </div>

        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
            {document.document_type}
          </p>

          <h3 className="mt-1 break-words text-lg font-bold">
            {document.file_name}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Uploaded {formatDateTime(document.uploaded_at)}
          </p>
        </div>
      </div>

      {document.description && (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {document.description}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {document.signedUrl ? (
          <a
            href={document.signedUrl}
            className="rounded-xl bg-blue-700 px-4 py-2 font-bold text-white transition hover:bg-blue-800"
          >
            Download
          </a>
        ) : (
          <span className="rounded-xl bg-slate-200 px-4 py-2 font-bold text-slate-500">
            Download unavailable
          </span>
        )}

        <form action={deleteThisDocument}>
          <button
            type="submit"
            className="rounded-xl border border-red-300 px-4 py-2 font-bold text-red-700 transition hover:bg-red-50"
          >
            Delete
          </button>
        </form>
      </div>
    </article>
  );
}

function TabLink({
  href,
  label,
  active = false,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-xl bg-blue-700 px-4 py-3 text-center font-bold text-white"
          : "rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-bold text-slate-700 transition hover:bg-slate-100"
      }
    >
      {label}
    </Link>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}