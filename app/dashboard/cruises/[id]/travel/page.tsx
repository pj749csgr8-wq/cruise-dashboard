import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../../lib/supabase/server";
import TravelAnalyzer from "./travel-analyzer";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Cruise = {
  id: string;
  cruise_line: string;
  ship_name: string;
  departure_date: string;
};

type TravelItem = {
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

  flight_number: string | null;
  terminal: string | null;
  gate: string | null;

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
};

type TravelItemWithFile = TravelItem & {
  file_url: string | null;
};

export default async function TravelPage({
  params,
}: PageProps) {
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

  const { data: travelItems, error: travelItemsError } =
    await supabase
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
          flight_number,
          terminal,
          gate,
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
      .order("start_date", {
        ascending: true,
        nullsFirst: false,
      })
      .order("created_at", {
        ascending: false,
      });

  if (travelItemsError) {
    console.error(
      "Could not load saved travel items:",
      travelItemsError
    );
  }

  const savedTravelItems =
    await addSignedFileUrls(
      supabase,
      (travelItems || []) as TravelItem[]
    );

  return (
    <main className="relative min-h-screen bg-[url('/cruise-background.jpg')] bg-cover bg-center bg-fixed px-6 py-10 text-slate-900 before:absolute before:inset-0 before:bg-slate-950/70">
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href={`/dashboard/cruises/${cruise.id}`}
            className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            ← Back to cruise
          </Link>

          <Link
            href="/dashboard"
            className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            Dashboard
          </Link>
        </div>

        <section className="overflow-hidden rounded-3xl border border-white/20 bg-white/95 shadow-2xl backdrop-blur-md">
          <header className="border-b border-slate-200 p-6 sm:p-10">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
              AI travel organizer
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              {cruise.ship_name}
            </h1>

            <p className="mt-2 text-lg font-semibold text-slate-600">
              {cruise.cruise_line}
            </p>

            <p className="mt-4 max-w-3xl leading-7 text-slate-600">
              Upload hotel, flight, taxi, transfer,
              train, excursion, rental-car or other
              travel confirmations. AI will extract the
              details before you save them to this
              cruise.
            </p>

            <div className="mt-5 inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-800">
              Cruise departure:{" "}
              {formatDate(cruise.departure_date)}
            </div>
          </header>

          <TravelAnalyzer cruiseId={cruise.id} />
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/20 bg-white/95 shadow-2xl backdrop-blur-md">
          <header className="border-b border-slate-200 p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
                  Saved travel plans
                </p>

                <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                  Hotels, transportation and bookings
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  These items have been saved to this
                  cruise.
                </p>
              </div>

              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                {savedTravelItems.length}{" "}
                {savedTravelItems.length === 1
                  ? "saved item"
                  : "saved items"}
              </div>
            </div>
          </header>

          <div className="p-6 sm:p-8">
            {savedTravelItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-lg font-bold text-slate-800">
                  No travel plans saved yet
                </p>

                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Upload and analyze a travel document
                  above, then choose the green save
                  button.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {savedTravelItems.map((item) => (
                  <TravelItemCard
                    key={item.id}
                    item={item}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function TravelItemCard({
  item,
}: {
  item: TravelItemWithFile;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-800">
                {formatItemType(item.item_type)}
              </span>

              {item.status && (
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-green-800">
                  {formatItemType(item.status)}
                </span>
              )}
            </div>

            <h3 className="mt-3 text-2xl font-bold text-slate-900">
              {item.title ||
                formatItemType(item.item_type)}
            </h3>

            {item.company_name && (
              <p className="mt-1 font-semibold text-slate-600">
                {item.company_name}
              </p>
            )}
          </div>

          <div className="sm:text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Date
            </p>

            <p className="mt-1 font-bold text-slate-900">
              {formatDateRange(
                item.start_date,
                item.end_date
              )}
            </p>

            {(item.start_time || item.end_time) && (
              <p className="mt-1 text-sm text-slate-600">
                {formatTimeRange(
                  item.start_time,
                  item.end_time
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailBox
            label="Confirmation"
            value={
              item.confirmation_number ||
              item.reference_number
            }
          />

          <DetailBox
            label="Cost"
            value={formatCost(
              item.cost,
              item.currency
            )}
          />

          <DetailBox
            label="Departure or pickup"
            value={item.departure_location}
          />

          <DetailBox
            label="Arrival or destination"
            value={item.arrival_location}
          />

          {item.address && (
            <DetailBox
              label="Address"
              value={item.address}
            />
          )}

          {item.flight_number && (
            <DetailBox
              label="Flight number"
              value={item.flight_number}
            />
          )}

          {item.terminal && (
            <DetailBox
              label="Terminal"
              value={item.terminal}
            />
          )}

          {item.gate && (
            <DetailBox
              label="Gate"
              value={item.gate}
            />
          )}
        </div>

        {item.ai_summary && (
          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <p className="font-bold text-blue-900">
                AI summary
              </p>

              {item.ai_confidence !== null && (
                <p className="text-sm font-bold text-blue-800">
                  {Math.round(
                    Number(item.ai_confidence)
                  )}
                  % confidence
                </p>
              )}
            </div>

            <p className="mt-2 leading-6 text-blue-900">
              {item.ai_summary}
            </p>
          </div>
        )}

        {item.notes && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Additional details
            </p>

            <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">
              {item.notes}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {item.file_url ? (
            <a
              href={item.file_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-slate-800 px-5 py-3 text-center font-bold text-white transition hover:bg-slate-900"
            >
              Open saved document
            </a>
          ) : (
            <span className="rounded-xl bg-slate-100 px-5 py-3 text-center font-semibold text-slate-500">
              Saved document unavailable
            </span>
          )}

          {item.file_name && (
            <p className="break-all text-sm text-slate-500">
              {item.file_name}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function DetailBox({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words font-semibold text-slate-900">
        {value || "Not entered"}
      </p>
    </div>
  );
}

async function addSignedFileUrls(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  items: TravelItem[]
): Promise<TravelItemWithFile[]> {
  return Promise.all(
    items.map(async (item) => {
      if (!item.file_path) {
        return {
          ...item,
          file_url: null,
        };
      }

      const { data, error } =
        await supabase.storage
          .from("travel-documents")
          .createSignedUrl(
            item.file_path,
            60 * 60
          );

      if (error || !data?.signedUrl) {
        console.error(
          `Could not create signed URL for ${item.file_path}:`,
          error
        );

        return {
          ...item,
          file_url: null,
        };
      }

      return {
        ...item,
        file_url: data.signedUrl,
      };
    })
  );
}

function formatItemType(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function formatDate(date: string) {
  const parsedDate = new Date(
    `${date}T00:00:00Z`
  );

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsedDate);
}

function formatDateRange(
  startDate: string | null,
  endDate: string | null
) {
  if (!startDate && !endDate) {
    return "Date not entered";
  }

  if (startDate && !endDate) {
    return formatDate(startDate);
  }

  if (!startDate && endDate) {
    return formatDate(endDate);
  }

  if (startDate === endDate) {
    return formatDate(startDate as string);
  }

  return `${formatDate(
    startDate as string
  )} – ${formatDate(endDate as string)}`;
}

function formatTimeRange(
  startTime: string | null,
  endTime: string | null
) {
  if (!startTime && !endTime) {
    return "";
  }

  if (startTime && !endTime) {
    return formatTime(startTime);
  }

  if (!startTime && endTime) {
    return formatTime(endTime);
  }

  return `${formatTime(
    startTime as string
  )} – ${formatTime(endTime as string)}`;
}

function formatTime(time: string) {
  const [hourText, minuteText] =
    time.split(":");

  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return time;
  }

  const date = new Date();

  date.setHours(hour, minute, 0, 0);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatCost(
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
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  } catch {
    return `${
      currency || "USD"
    } ${amount.toFixed(2)}`;
  }
}