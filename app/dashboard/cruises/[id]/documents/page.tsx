import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../../lib/supabase/server";
import {
  deleteCruiseDocument,
  uploadCruiseDocument,
} from "./actions";
import {
  deleteTravelDocument,
  updateTravelDocument,
} from "./travel-actions";

const CRUISE_DOCUMENTS_BUCKET =
  "cruise-documents";

const TRAVEL_DOCUMENTS_BUCKET =
  "travel-documents";

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

type TravelDocument = {
  id: string;
  item_type: string;
  title: string | null;
  company_name: string | null;
  confirmation_number: string | null;
  reference_number: string | null;

  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;

  departure_location: string | null;
  arrival_location: string | null;
  address: string | null;

  cost: number | string | null;
  currency: string | null;

  notes: string | null;
  ai_summary: string | null;
  ai_confidence: number | string | null;

  file_name: string | null;
  file_path: string | null;
  mime_type: string | null;

  status: string | null;
  created_at: string;
  signedUrl: string | null;
};

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
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

  const { data: cruise, error: cruiseError } =
    await supabase
      .from("cruises")
      .select(
        "id, cruise_line, ship_name, departure_date"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

  if (cruiseError || !cruise) {
    notFound();
  }

  const [
    cruiseDocumentResult,
    travelDocumentResult,
  ] = await Promise.all([
    supabase
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
      .eq("user_id", user.id)
      .order("uploaded_at", {
        ascending: false,
      }),

    supabase
      .from("travel_items")
      .select(
        `
          id,
          item_type,
          title,
          company_name,
          confirmation_number,
          reference_number,
          start_date,
          start_time,
          end_date,
          end_time,
          departure_location,
          arrival_location,
          address,
          cost,
          currency,
          notes,
          ai_summary,
          ai_confidence,
          file_name,
          file_path,
          mime_type,
          status,
          created_at
        `
      )
      .eq("cruise_id", id)
      .eq("user_id", user.id)
      .not("file_path", "is", null)
      .order("created_at", {
        ascending: false,
      }),
  ]);

  const documentsWithUrls:
    CruiseDocument[] = await Promise.all(
    (
      cruiseDocumentResult.data ?? []
    ).map(async (document) => {
      const { data } =
        await supabase.storage
          .from(CRUISE_DOCUMENTS_BUCKET)
          .createSignedUrl(
            document.file_path,
            3600,
            {
              download: document.file_name,
            }
          );

      return {
        ...document,
        signedUrl:
          data?.signedUrl ?? null,
      };
    })
  );

  const travelDocumentsWithUrls:
    TravelDocument[] = await Promise.all(
    (
      travelDocumentResult.data ?? []
    ).map(async (document) => {
      if (!document.file_path) {
        return {
          ...document,
          signedUrl: null,
        };
      }

      const { data } =
        await supabase.storage
          .from(TRAVEL_DOCUMENTS_BUCKET)
          .createSignedUrl(
            document.file_path,
            3600,
            document.file_name
              ? {
                  download:
                    document.file_name,
                }
              : undefined
          );

      return {
        ...document,
        signedUrl:
          data?.signedUrl ?? null,
      };
    })
  );

  const typedCruise = cruise as Cruise;

  const uploadForCruise =
    uploadCruiseDocument.bind(null, id);

  const totalDocumentCount =
    documentsWithUrls.length +
    travelDocumentsWithUrls.length;

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

              <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <h1 className="text-3xl font-bold">
                    {typedCruise.ship_name}{" "}
                    Documents
                  </h1>

                  <p className="mt-2 text-slate-600">
                    Sailing{" "}
                    {formatDate(
                      typedCruise.departure_date
                    )}
                  </p>
                </div>

                <div className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-800">
                  {totalDocumentCount}{" "}
                  {totalDocumentCount === 1
                    ? "document"
                    : "documents"}
                </div>
              </div>
            </header>

            <nav className="mt-8 grid gap-3 sm:grid-cols-4">
              <TabLink
                href={`/dashboard/cruises/${id}`}
                label="Overview"
              />

              <TabLink
                href={`/dashboard/cruises/${id}/travel`}
                label="Travel"
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

            {cruiseDocumentResult.error && (
              <ErrorBox
                title="Uploaded documents could not be loaded"
                message={
                  cruiseDocumentResult.error
                    .message
                }
              />
            )}

            {travelDocumentResult.error && (
              <ErrorBox
                title="Travel documents could not be loaded"
                message={
                  travelDocumentResult.error
                    .message
                }
              />
            )}

            <section className="mt-8">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-700">
                    Travel confirmations
                  </p>

                  <h2 className="mt-2 text-2xl font-bold">
                    Hotels, flights and
                    transportation
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Documents saved through the AI
                    travel uploader.
                  </p>
                </div>

                <Link
                  href={`/dashboard/cruises/${id}/travel`}
                  className="rounded-xl bg-violet-700 px-5 py-3 text-center font-bold text-white transition hover:bg-violet-800"
                >
                  Add travel document
                </Link>
              </div>

              {travelDocumentsWithUrls.length ===
              0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <h3 className="text-xl font-bold">
                    No travel confirmations
                  </h3>

                  <p className="mt-2 text-slate-600">
                    Hotel, flight, transfer, taxi and
                    train confirmations saved through
                    AI will appear here.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  {travelDocumentsWithUrls.map(
                    (document) => (
                      <TravelDocumentCard
                        key={document.id}
                        cruiseId={id}
                        document={document}
                      />
                    )
                  )}
                </div>
              )}
            </section>

            <section className="mt-10 border-t border-slate-200 pt-8">
              <h2 className="text-2xl font-bold">
                Other uploaded documents
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Receipts, invoices, insurance files,
                payment confirmations and other
                manually uploaded cruise documents.
              </p>

              {documentsWithUrls.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <h3 className="text-xl font-bold">
                    No other documents uploaded
                  </h3>

                  <p className="mt-2 text-slate-600">
                    Upload a receipt, invoice,
                    confirmation or other cruise
                    document below.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  {documentsWithUrls.map(
                    (document) => (
                      <DocumentCard
                        key={document.id}
                        cruiseId={id}
                        document={document}
                      />
                    )
                  )}
                </div>
              )}
            </section>

            <section className="mt-10 border-t border-slate-200 pt-8">
              <h2 className="text-2xl font-bold">
                Upload another document
              </h2>

              <p className="mt-2 text-slate-600">
                Maximum file size: 10 MB. Supported
                files include PDF, images, Word
                documents, Excel spreadsheets and
                text files.
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
                      <option>
                        Booking confirmation
                      </option>

                      <option>
                        Receipt
                      </option>

                      <option>
                        Invoice
                      </option>

                      <option>
                        Payment confirmation
                      </option>

                      <option>
                        Travel insurance
                      </option>

                      <option>
                        Excursion confirmation
                      </option>

                      <option>
                        Flight document
                      </option>

                      <option>
                        Hotel document
                      </option>

                      <option>
                        Other
                      </option>
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

function TravelDocumentCard({
  cruiseId,
  document,
}: {
  cruiseId: string;
  document: TravelDocument;
}) {
  const confirmationNumber =
    document.confirmation_number ||
    document.reference_number;

  const updateThisDocument =
    updateTravelDocument.bind(
      null,
      cruiseId,
      document.id
    );

  const deleteThisDocument =
    deleteTravelDocument.bind(
      null,
      cruiseId,
      document.id
    );

  return (
    <article className="rounded-2xl border border-violet-200 bg-violet-50/50 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-2xl">
          {travelIcon(document.item_type)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-800">
              {formatItemType(
                document.item_type
              )}
            </span>

            {document.status && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-green-800">
                {formatItemType(
                  document.status
                )}
              </span>
            )}
          </div>

          <h3 className="mt-3 break-words text-xl font-bold">
            {document.title ||
              document.file_name ||
              formatItemType(
                document.item_type
              )}
          </h3>

          {document.company_name && (
            <p className="mt-1 font-semibold text-slate-600">
              {document.company_name}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <DocumentDetail
          label="Dates"
          value={formatDateRange(
            document.start_date,
            document.end_date
          )}
        />

        <DocumentDetail
          label="Confirmation"
          value={confirmationNumber}
        />

        {document.address && (
          <DocumentDetail
            label="Address"
            value={document.address}
          />
        )}

        {(document.departure_location ||
          document.arrival_location) && (
          <DocumentDetail
            label="Route"
            value={formatRoute(
              document.departure_location,
              document.arrival_location
            )}
          />
        )}

        <DocumentDetail
          label="Cost"
          value={formatTravelCost(
            document.cost,
            document.currency
          )}
        />

        <DocumentDetail
          label="AI confidence"
          value={formatConfidence(
            document.ai_confidence
          )}
        />
      </div>

      {document.ai_summary && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Booking summary
          </p>

          <p className="mt-2 text-sm leading-6 text-blue-900">
            {document.ai_summary}
          </p>
        </div>
      )}

      {document.notes && (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {document.notes}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {document.signedUrl ? (
          <a
            href={document.signedUrl}
            className="rounded-xl bg-violet-700 px-4 py-2 font-bold text-white transition hover:bg-violet-800"
          >
            Download
          </a>
        ) : (
          <span className="rounded-xl bg-slate-200 px-4 py-2 font-bold text-slate-500">
            Download unavailable
          </span>
        )}

        <details className="w-full sm:w-auto">
          <summary className="cursor-pointer list-none rounded-xl border border-blue-300 bg-white px-4 py-2 text-center font-bold text-blue-700 transition hover:bg-blue-50">
            Edit
          </summary>

          <form
            action={updateThisDocument}
            className="mt-4 space-y-4 rounded-2xl border border-blue-200 bg-white p-5 sm:min-w-[520px]"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <EditField
                label="Title"
                name="title"
                defaultValue={document.title}
              />

              <EditField
                label="Hotel or company"
                name="company_name"
                defaultValue={
                  document.company_name
                }
              />

              <EditField
                label="Confirmation number"
                name="confirmation_number"
                defaultValue={
                  document.confirmation_number
                }
              />

              <EditField
                label="Reference number"
                name="reference_number"
                defaultValue={
                  document.reference_number
                }
              />

              <EditField
                label="Check-in or start date"
                name="start_date"
                type="date"
                defaultValue={
                  document.start_date
                }
              />

              <EditField
                label="Check-out or end date"
                name="end_date"
                type="date"
                defaultValue={
                  document.end_date
                }
              />

              <EditField
                label="Cost"
                name="cost"
                type="number"
                step="0.01"
                defaultValue={
                  document.cost === null
                    ? null
                    : String(document.cost)
                }
              />

              <EditField
                label="Currency"
                name="currency"
                defaultValue={
                  document.currency || "USD"
                }
              />
            </div>

            <div>
              <label
                htmlFor={`address-${document.id}`}
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Address
              </label>

              <input
                id={`address-${document.id}`}
                name="address"
                defaultValue={
                  document.address || ""
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor={`status-${document.id}`}
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Status
              </label>

              <select
                id={`status-${document.id}`}
                name="status"
                defaultValue={
                  document.status || "confirmed"
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              >
                <option value="confirmed">
                  Confirmed
                </option>

                <option value="pending">
                  Pending
                </option>

                <option value="cancelled">
                  Cancelled
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor={`notes-${document.id}`}
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Notes
              </label>

              <textarea
                id={`notes-${document.id}`}
                name="notes"
                rows={4}
                defaultValue={
                  document.notes || ""
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <button
              type="submit"
              className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white transition hover:bg-blue-800"
            >
              Save changes
            </button>
          </form>
        </details>

        <form action={deleteThisDocument}>
          <button
            type="submit"
            className="rounded-xl border border-red-300 bg-white px-4 py-2 font-bold text-red-700 transition hover:bg-red-50"
          >
            Delete
          </button>
        </form>
      </div>

      {document.file_name && (
        <p className="mt-3 break-all text-xs text-slate-500">
          {document.file_name}
        </p>
      )}
    </article>
  );
}

function EditField({
  label,
  name,
  defaultValue,
  type = "text",
  step,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  type?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </label>

      <input
        name={name}
        type={type}
        step={step}
        defaultValue={
          defaultValue || ""
        }
        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

function DocumentCard({
  cruiseId,
  document,
}: {
  cruiseId: string;
  document: CruiseDocument;
}) {
  const deleteThisDocument =
    deleteCruiseDocument.bind(
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
            Uploaded{" "}
            {formatDateTime(
              document.uploaded_at
            )}
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

function DocumentDetail({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words font-semibold text-slate-900">
        {value || "Not entered"}
      </p>
    </div>
  );
}

function ErrorBox({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-red-300 bg-red-50 p-5 text-red-800">
      <p className="font-bold">
        {title}
      </p>

      <p className="mt-1 text-sm">
        {message}
      </p>
    </div>
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

function travelIcon(
  itemType: string
) {
  switch (itemType) {
    case "hotel":
      return "🏨";

    case "flight":
      return "✈️";

    case "train":
      return "🚆";

    case "taxi":
      return "🚕";

    case "transfer":
      return "🚌";

    case "rental_car":
      return "🚗";

    case "restaurant":
      return "🍽️";

    case "excursion":
      return "🗺️";

    default:
      return "📄";
  }
}

function formatItemType(
  value: string
) {
  return value
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(
    new Date(`${date}T00:00:00Z`)
  );
}

function formatDateRange(
  startDate: string | null,
  endDate: string | null
) {
  if (!startDate && !endDate) {
    return null;
  }

  if (startDate && !endDate) {
    return formatDate(startDate);
  }

  if (!startDate && endDate) {
    return formatDate(endDate);
  }

  if (startDate === endDate) {
    return formatDate(
      startDate as string
    );
  }

  return `${formatDate(
    startDate as string
  )} – ${formatDate(
    endDate as string
  )}`;
}

function formatRoute(
  departure: string | null,
  arrival: string | null
) {
  if (departure && arrival) {
    return `${departure} → ${arrival}`;
  }

  return departure || arrival;
}

function formatTravelCost(
  value: number | string | null,
  currency: string | null
) {
  if (
    value === null ||
    value === ""
  ) {
    return null;
  }

  const amount =
    typeof value === "number"
      ? value
      : Number.parseFloat(value);

  if (Number.isNaN(amount)) {
    return null;
  }

  try {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency:
          currency || "USD",
      }
    ).format(amount);
  } catch {
    return `${
      currency || "USD"
    } ${amount.toFixed(2)}`;
  }
}

function formatConfidence(
  value: number | string | null
) {
  if (
    value === null ||
    value === ""
  ) {
    return null;
  }

  const confidence = Number(value);

  if (!Number.isFinite(confidence)) {
    return null;
  }

  const percentage =
    confidence <= 1
      ? confidence * 100
      : confidence;

  return `${Math.round(
    percentage
  )}%`;
}

function formatDateTime(
  date: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(new Date(date));
}