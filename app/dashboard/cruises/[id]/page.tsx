import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { deleteCruise } from "./edit/actions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Cruise = {
  id: string;
  cruise_line: string;
  sailing_from: string | null;
  ship_name: string;
  departure_date: string;
  booking_number: string | null;
  total_cost: number | string | null;
  notes: string | null;
  duration_nights: number | null;
  drink_package: boolean;
  wifi_package: boolean;
  paid_off: boolean;
  booking_status: string;
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

export default async function CruiseDetailsPage({
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

  const { data, error } = await supabase
    .from("cruises")
    .select(
      `
        id,
        cruise_line,
        sailing_from,
        ship_name,
        departure_date,
        booking_number,
        total_cost,
        notes,
        duration_nights,
        drink_package,
        wifi_package,
        paid_off,
        booking_status
      `
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    notFound();
  }

  const cruise = data as Cruise;

  const [
    travelItemsResult,
    excursionCountResult,
    cruiseDocumentCountResult,
  ] = await Promise.all([
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
      .eq("cruise_id", cruise.id)
      .eq("user_id", user.id)
      .order("start_date", {
        ascending: true,
        nullsFirst: false,
      })
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("excursions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("cruise_id", cruise.id)
      .eq("user_id", user.id),

    supabase
      .from("cruise_documents")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("cruise_id", cruise.id)
      .eq("user_id", user.id),
  ]);

  if (travelItemsResult.error) {
    console.error(
      "Could not load travel items:",
      travelItemsResult.error
    );
  }

  if (excursionCountResult.error) {
    console.error(
      "Could not count excursions:",
      excursionCountResult.error
    );
  }

  if (cruiseDocumentCountResult.error) {
    console.error(
      "Could not count cruise documents:",
      cruiseDocumentCountResult.error
    );
  }

  const travelItems = await addSignedFileUrls(
    supabase,
    (travelItemsResult.data || []) as TravelItem[]
  );

  const excursionCount =
    excursionCountResult.count ?? 0;

  const cruiseDocumentCount =
    cruiseDocumentCountResult.count ?? 0;

  const travelDocumentCount =
    travelItems.filter(
      (item) => Boolean(item.file_path)
    ).length;

  const totalDocumentCount =
    cruiseDocumentCount +
    travelDocumentCount;

  const travelCost = travelItems.reduce(
    (total, item) =>
      total + parseMoney(item.cost),
    0
  );

  const cruiseCost = parseMoney(
    cruise.total_cost
  );

  const knownTripTotal =
    cruiseCost + travelCost;

  const normalizedStatus =
    cruise.booking_status.toLowerCase();

  const isCancelled =
    normalizedStatus === "cancelled" ||
    normalizedStatus === "canceled";

  const isPrevious =
    dateFromDatabase(
      cruise.departure_date
    ).getTime() < startOfToday().getTime();

  return (
    <main className="relative min-h-screen bg-[url('/cruise-background.jpg')] bg-cover bg-center bg-fixed px-6 py-10 text-slate-900 before:absolute before:inset-0 before:bg-slate-950/70">
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href={
              isPrevious
                ? "/dashboard/previous"
                : "/dashboard"
            }
            className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            ←{" "}
            {isPrevious
              ? "Previous cruises"
              : "Dashboard"}
          </Link>

          <Link
            href="/dashboard"
            className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            Upcoming cruises
          </Link>
        </div>

        <section className="overflow-hidden rounded-3xl border border-white/20 bg-white/95 shadow-2xl backdrop-blur-md">
          <div
            className={
              isCancelled
                ? "h-3 bg-red-600"
                : isPrevious
                  ? "h-3 bg-slate-500"
                  : "h-3 bg-blue-700"
            }
          />

          <header className="border-b border-slate-200 p-6 sm:p-10">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
                  Cruise details
                </p>

                <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                  {cruise.ship_name}
                </h1>

                <p className="mt-2 text-lg font-semibold text-slate-600">
                  {cruise.cruise_line}
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <StatusBadge
                    status={
                      isPrevious
                        ? "Completed"
                        : cruise.booking_status
                    }
                  />

                  <PackageBadge
                    label="Paid off"
                    purchased={cruise.paid_off}
                  />

                  <PackageBadge
                    label="Drink package"
                    purchased={
                      cruise.drink_package
                    }
                  />

                  <PackageBadge
                    label="Wi-Fi"
                    purchased={
                      cruise.wifi_package
                    }
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-6 py-5 lg:min-w-64 lg:text-right">
                <p className="text-sm font-bold uppercase tracking-wider text-blue-700">
                  Departure
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {formatDate(
                    cruise.departure_date
                  )}
                </p>

                {!isPrevious &&
                  !isCancelled && (
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      {formatDaysUntil(
                        calculateDaysUntil(
                          cruise.departure_date
                        )
                      )}
                    </p>
                  )}
              </div>
            </div>
          </header>

          <div className="p-6 sm:p-10">
            <section>
              <h2 className="text-xl font-bold">
                Booking information
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailCard
                  label="Sailing from"
                  value={
                    cruise.sailing_from ||
                    "Not entered"
                  }
                />

                <DetailCard
                  label="Length"
                  value={
                    cruise.duration_nights
                      ? `${cruise.duration_nights} nights`
                      : "Not entered"
                  }
                />

                <DetailCard
                  label="Booking number"
                  value={
                    cruise.booking_number ||
                    "Not entered"
                  }
                />

                <DetailCard
                  label="Cruise cost"
                  value={formatCurrency(
                    cruise.total_cost
                  )}
                />
              </div>
            </section>

            <section className="mt-9 border-t border-slate-200 pt-8">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
                    Trip overview
                  </p>

                  <h2 className="mt-2 text-2xl font-bold">
                    Everything booked for this cruise
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Cruise details, hotels,
                    transportation, excursions and
                    saved documents.
                  </p>
                </div>

                <Link
                  href={`/dashboard/cruises/${cruise.id}/travel`}
                  className="rounded-xl bg-violet-700 px-5 py-3 text-center font-bold text-white transition hover:bg-violet-800"
                >
                  Add travel booking
                </Link>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <OverviewCard
                  label="Travel bookings"
                  value={`${travelItems.length}`}
                  description="Hotels, flights and transportation"
                />

                <OverviewCard
                  label="Excursions"
                  value={`${excursionCount}`}
                  description="Saved port activities"
                />

                <OverviewCard
                  label="Documents"
                  value={`${totalDocumentCount}`}
                  description="Receipts and travel confirmations"
                />

                <OverviewCard
                  label="Known trip total"
                  value={formatMoneyNumber(
                    knownTripTotal
                  )}
                  description="Cruise plus saved travel costs"
                />
              </div>

              {travelItems.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center">
                  <p className="font-bold text-slate-800">
                    No hotel or transportation
                    bookings saved
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Use AI travel upload to add hotel,
                    flight, train, taxi or transfer
                    confirmations.
                  </p>

                  <Link
                    href={`/dashboard/cruises/${cruise.id}/travel`}
                    className="mt-5 inline-block rounded-xl bg-blue-700 px-5 py-3 font-bold text-white transition hover:bg-blue-800"
                  >
                    Open AI travel upload
                  </Link>
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  {travelItems.map((item) => (
                    <TravelOverviewCard
                      key={item.id}
                      item={item}
                    />
                  ))}
                </div>
              )}

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Link
                  href={`/dashboard/cruises/${cruise.id}/excursions`}
                  className="rounded-2xl border border-blue-200 bg-blue-50 p-5 transition hover:bg-blue-100"
                >
                  <p className="text-lg font-bold text-blue-900">
                    Excursions
                  </p>

                  <p className="mt-2 text-sm leading-6 text-blue-800">
                    {excursionCount === 0
                      ? "No excursions saved yet."
                      : `${excursionCount} ${
                          excursionCount === 1
                            ? "excursion"
                            : "excursions"
                        } saved.`}
                  </p>

                  <p className="mt-4 font-bold text-blue-800">
                    Manage excursions →
                  </p>
                </Link>

                <Link
                  href={`/dashboard/cruises/${cruise.id}/documents`}
                  className="rounded-2xl border border-slate-300 bg-slate-50 p-5 transition hover:bg-slate-100"
                >
                  <p className="text-lg font-bold text-slate-900">
                    Documents and receipts
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {totalDocumentCount === 0
                      ? "No documents or travel confirmations saved yet."
                      : `${totalDocumentCount} ${
                          totalDocumentCount === 1
                            ? "document or travel confirmation"
                            : "documents and travel confirmations"
                        } saved.`}
                  </p>

                  <p className="mt-4 font-bold text-slate-800">
                    Manage documents →
                  </p>
                </Link>
              </div>
            </section>

            {cruise.notes && (
              <section className="mt-8">
                <h2 className="text-xl font-bold">
                  Notes
                </h2>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="whitespace-pre-wrap leading-7 text-slate-700">
                    {cruise.notes}
                  </p>
                </div>
              </section>
            )}

            <section className="mt-9 border-t border-slate-200 pt-8">
              <h2 className="text-xl font-bold">
                Cruise planning
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Add excursions, upload documents and
                use AI to read flight, hotel, taxi,
                transfer and excursion confirmations.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <PlanningCard
                  href={`/dashboard/cruises/${cruise.id}/travel`}
                  title="AI travel upload"
                  description="Upload a travel document and let AI identify and extract its details."
                  buttonText="Analyze travel document"
                  accent="violet"
                />

                <PlanningCard
                  href={`/dashboard/cruises/${cruise.id}/excursions`}
                  title="Excursions"
                  description="Add and organize excursions, ports, providers, costs and confirmation numbers."
                  buttonText="Manage excursions"
                  accent="blue"
                />

                <PlanningCard
                  href={`/dashboard/cruises/${cruise.id}/documents`}
                  title="Documents & receipts"
                  description="Store booking confirmations, receipts, invoices and other cruise files."
                  buttonText="Manage documents"
                  accent="slate"
                />
              </div>
            </section>

            <section className="mt-9 border-t border-slate-200 pt-8">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-bold">
                    Manage this cruise
                  </h2>

                  <p className="mt-2 text-sm text-slate-600">
                    Update the booking details or
                    permanently delete the cruise.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={`/dashboard/cruises/${cruise.id}/edit`}
                    className="rounded-xl bg-blue-700 px-6 py-3 text-center font-bold text-white transition hover:bg-blue-800"
                  >
                    Edit cruise
                  </Link>

                  <form
                    action={deleteCruise.bind(
                      null,
                      cruise.id
                    )}
                  >
                    <button
                      type="submit"
                      className="w-full rounded-xl border border-red-300 bg-white px-6 py-3 font-bold text-red-700 transition hover:bg-red-50"
                    >
                      Delete cruise
                    </button>
                  </form>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function TravelOverviewCard({
  item,
}: {
  item: TravelItemWithFile;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-800">
                {formatItemType(
                  item.item_type
                )}
              </span>

              {item.status && (
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-green-800">
                  {formatItemType(
                    item.status
                  )}
                </span>
              )}
            </div>

            <h3 className="mt-3 text-xl font-bold text-slate-900">
              {item.title ||
                formatItemType(
                  item.item_type
                )}
            </h3>

            {item.company_name && (
              <p className="mt-1 font-semibold text-slate-600">
                {item.company_name}
              </p>
            )}
          </div>

          <div className="md:text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Date
            </p>

            <p className="mt-1 font-bold text-slate-900">
              {formatDateRange(
                item.start_date,
                item.end_date
              )}
            </p>

            {(item.start_time ||
              item.end_time) && (
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

      <div className="p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MiniDetail
            label="Confirmation"
            value={
              item.confirmation_number ||
              item.reference_number
            }
          />

          <MiniDetail
            label="Cost"
            value={formatTravelCost(
              item.cost,
              item.currency
            )}
          />

          {item.departure_location && (
            <MiniDetail
              label="Departure or pickup"
              value={
                item.departure_location
              }
            />
          )}

          {item.arrival_location && (
            <MiniDetail
              label="Arrival or destination"
              value={
                item.arrival_location
              }
            />
          )}

          {item.address && (
            <MiniDetail
              label="Address"
              value={item.address}
            />
          )}

          {item.flight_number && (
            <MiniDetail
              label="Flight number"
              value={item.flight_number}
            />
          )}

          {item.terminal && (
            <MiniDetail
              label="Terminal"
              value={item.terminal}
            />
          )}

          {item.gate && (
            <MiniDetail
              label="Gate"
              value={item.gate}
            />
          )}
        </div>

        {item.ai_summary && (
          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="font-bold text-blue-900">
              Booking summary
            </p>

            <p className="mt-2 text-sm leading-6 text-blue-900">
              {item.ai_summary}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          {item.file_url && (
            <a
              href={item.file_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-slate-800 px-5 py-3 text-center font-bold text-white transition hover:bg-slate-900"
            >
              Open confirmation
            </a>
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

function OverviewCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>

      <p className="mt-1 text-sm leading-5 text-slate-600">
        {description}
      </p>
    </article>
  );
}

function MiniDetail({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words font-semibold text-slate-900">
        {value || "Not entered"}
      </p>
    </div>
  );
}

function PlanningCard({
  href,
  title,
  description,
  buttonText,
  accent,
}: {
  href: string;
  title: string;
  description: string;
  buttonText: string;
  accent:
    | "violet"
    | "blue"
    | "slate";
}) {
  const buttonClasses = {
    violet:
      "bg-violet-700 text-white hover:bg-violet-800",
    blue:
      "bg-blue-700 text-white hover:bg-blue-800",
    slate:
      "bg-slate-800 text-white hover:bg-slate-900",
  };

  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-lg font-bold">
        {title}
      </h3>

      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
        {description}
      </p>

      <Link
        href={href}
        className={`mt-5 rounded-xl px-5 py-3 text-center font-bold transition ${buttonClasses[accent]}`}
      >
        {buttonText}
      </Link>
    </article>
  );
}

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words text-lg font-semibold text-slate-900">
        {value}
      </p>
    </article>
  );
}

function PackageBadge({
  label,
  purchased,
}: {
  label: string;
  purchased: boolean;
}) {
  return (
    <span
      className={
        purchased
          ? "rounded-full bg-green-100 px-4 py-2 text-sm font-bold text-green-800"
          : "rounded-full bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
      }
    >
      {label}:{" "}
      {purchased ? "Yes" : "No"}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalizedStatus =
    status.toLowerCase();

  let classes =
    "rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-800";

  if (
    normalizedStatus === "booked" ||
    normalizedStatus.includes(
      "confirmed"
    )
  ) {
    classes =
      "rounded-full bg-green-100 px-4 py-2 text-sm font-bold text-green-800";
  }

  if (
    normalizedStatus === "cancelled" ||
    normalizedStatus === "canceled"
  ) {
    classes =
      "rounded-full bg-red-100 px-4 py-2 text-sm font-bold text-red-800";
  }

  if (
    normalizedStatus === "completed"
  ) {
    classes =
      "rounded-full bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700";
  }

  return (
    <span className={classes}>
      {status}
    </span>
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

      if (
        error ||
        !data?.signedUrl
      ) {
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

function startOfToday() {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return today;
}

function dateFromDatabase(
  date: string
) {
  const [year, month, day] = date
    .split("-")
    .map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
}

function calculateDaysUntil(
  date: string
) {
  const departure =
    dateFromDatabase(date);

  const today =
    startOfToday();

  return Math.round(
    (departure.getTime() -
      today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function formatDaysUntil(
  days: number
) {
  if (days === 0) {
    return "Sails today";
  }

  if (days === 1) {
    return "Sails tomorrow";
  }

  return `${days} days until sailing`;
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
    new Date(
      `${date}T00:00:00Z`
    )
  );
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

  if (
    startDate === endDate
  ) {
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
  )} – ${formatTime(
    endTime as string
  )}`;
}

function formatTime(time: string) {
  const [hourText, minuteText] =
    time.split(":");

  const hour = Number(hourText);
  const minute = Number(
    minuteText
  );

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return time;
  }

  const date = new Date();

  date.setHours(
    hour,
    minute,
    0,
    0
  );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
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

function parseMoney(
  value: number | string | null
) {
  if (
    value === null ||
    value === ""
  ) {
    return 0;
  }

  const amount =
    typeof value === "number"
      ? value
      : Number.parseFloat(value);

  return Number.isNaN(amount)
    ? 0
    : amount;
}

function formatCurrency(
  value: number | string | null
) {
  if (
    value === null ||
    value === ""
  ) {
    return "Not entered";
  }

  return formatMoneyNumber(
    parseMoney(value)
  );
}

function formatMoneyNumber(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    }
  ).format(value);
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
    parseMoney(value);

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