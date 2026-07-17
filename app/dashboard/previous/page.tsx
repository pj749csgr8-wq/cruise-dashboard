import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

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

export default async function PreviousCruisesPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const today = new Date();

  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

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
    .lt("departure_date", todayString)
    .order("departure_date", { ascending: false });

  const cruises = (data ?? []) as Cruise[];

  return (
    <main className="relative min-h-screen bg-[url('/cruise-background.jpg')] bg-cover bg-center bg-fixed px-6 py-10 text-slate-900 before:absolute before:inset-0 before:bg-slate-950/70">
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            ← Upcoming cruises
          </Link>

          <Link
            href="/dashboard/previous"
            className="rounded-xl bg-white px-4 py-2 font-bold text-blue-700"
          >
            Previous cruises
          </Link>
        </div>

        <section className="rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-md sm:p-10">
          <header className="border-b border-slate-200 pb-7">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
              Cruise Companion
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Previous Cruises
            </h1>

            <p className="mt-2 text-slate-600">
              View cruises whose departure dates have already passed.
            </p>
          </header>

          {error && (
            <div className="mt-7 rounded-2xl border border-red-300 bg-red-50 p-5 text-red-800">
              <p className="font-bold">
                Previous cruises could not be loaded
              </p>

              <p className="mt-1 text-sm">
                {error.message}
              </p>
            </div>
          )}

          {cruises.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <h2 className="text-2xl font-bold">
                No previous cruises found
              </h2>

              <p className="mt-2 text-slate-600">
                Past cruises will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-6">
              {cruises.map((cruise) => (
                <PreviousCruiseCard
                  key={cruise.id}
                  cruise={cruise}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function PreviousCruiseCard({
  cruise,
}: {
  cruise: Cruise;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
      <div className="relative h-56 w-full bg-slate-200">
        <Image
          src={getCruiseLineImage(cruise.cruise_line)}
          alt={`${cruise.cruise_line} cruise ship`}
          fill
          sizes="(max-width: 1024px) 100vw, 900px"
          className="object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <p className="text-sm font-semibold uppercase tracking-wider text-white/80">
            {cruise.cruise_line}
          </p>

          <h2 className="mt-1 text-3xl font-bold">
            {cruise.ship_name}
          </h2>
        </div>
      </div>

      <div className="h-2 bg-slate-500" />

      <div className="p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row">
          <div>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
              Completed
            </span>
          </div>

          <div className="lg:text-right">
            <p className="text-sm text-slate-500">
              Departure date
            </p>

            <p className="text-lg font-bold">
              {formatDate(cruise.departure_date)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 border-t border-slate-200 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Detail
            label="Sailing from"
            value={cruise.sailing_from || "Not entered"}
          />

          <Detail
            label="Length"
            value={
              cruise.duration_nights
                ? `${cruise.duration_nights} nights`
                : "Not entered"
            }
          />

          <Detail
            label="Booking number"
            value={cruise.booking_number || "Not entered"}
          />

          <Detail
            label="Cost"
            value={formatCurrency(cruise.total_cost)}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <PackageBadge
            label="Drink package"
            purchased={cruise.drink_package}
          />

          <PackageBadge
            label="Wi-Fi"
            purchased={cruise.wifi_package}
          />

          <PackageBadge
            label="Paid off"
            purchased={cruise.paid_off}
          />
        </div>

        {cruise.notes && (
          <div className="mt-5 rounded-xl bg-slate-100 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Notes
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {cruise.notes}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:flex-wrap">
          <Link
            href={`/dashboard/cruises/${cruise.id}`}
            className="rounded-xl bg-blue-700 px-5 py-3 text-center font-bold text-white transition hover:bg-blue-800"
          >
            Open cruise details
          </Link>

          <Link
            href={`/dashboard/cruises/${cruise.id}/excursions`}
            className="rounded-xl border border-blue-700 px-5 py-3 text-center font-bold text-blue-700 transition hover:bg-blue-50"
          >
            Excursions
          </Link>

          <Link
            href={`/dashboard/cruises/${cruise.id}/documents`}
            className="rounded-xl border border-slate-300 px-5 py-3 text-center font-bold text-slate-700 transition hover:bg-slate-100"
          >
            Documents & receipts
          </Link>
        </div>
      </div>
    </article>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words font-semibold">
        {value}
      </p>
    </div>
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
      {label}: {purchased ? "Yes" : "No"}
    </span>
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

function formatCurrency(
  value: number | string | null
) {
  if (value === null || value === "") {
    return "Not entered";
  }

  const numberValue =
    typeof value === "number"
      ? value
      : Number.parseFloat(value);

  if (Number.isNaN(numberValue)) {
    return "Not entered";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numberValue);
}

function getCruiseLineImage(cruiseLine: string) {
  const normalized = cruiseLine
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (normalized.includes("virgin")) {
    return "/cruise-lines/virgin-voyages.jpg";
  }

  if (normalized.includes("carnival")) {
    return "/cruise-lines/carnival.jpg";
  }

  if (
    normalized.includes("royal caribbean") ||
    normalized === "rcl"
  ) {
    return "/cruise-lines/royal-caribbean.jpg";
  }

  if (
    normalized.includes("norwegian") ||
    normalized === "ncl"
  ) {
    return "/cruise-lines/norwegian.jpg";
  }

  if (normalized.includes("msc")) {
    return "/cruise-lines/msc.jpg";
  }

  if (normalized.includes("celebrity")) {
    return "/cruise-lines/celebrity.jpg";
  }

  if (normalized.includes("princess")) {
    return "/cruise-lines/princess.jpg";
  }

  if (normalized.includes("holland america")) {
    return "/cruise-lines/holland-america.jpg";
  }

  if (normalized.includes("disney")) {
    return "/cruise-lines/disney.jpg";
  }

  return "/cruise-lines/default.jpg";
}