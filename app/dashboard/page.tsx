import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import SignOutButton from "./sign-out-button";

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

export default async function DashboardPage() {
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
    .gte("departure_date", todayString)
    .order("departure_date", { ascending: true });

  const upcomingCruises = (data ?? []) as Cruise[];
  const nextCruise = upcomingCruises[0] ?? null;

  const daysUntilSailing = nextCruise
    ? calculateDaysUntil(nextCruise.departure_date)
    : null;

  const { count: previousCruiseCount } = await supabase
    .from("cruises")
    .select("id", {
      count: "exact",
      head: true,
    })
    .lt("departure_date", todayString);

  const { count: totalCruiseCount } = await supabase
    .from("cruises")
    .select("id", {
      count: "exact",
      head: true,
    });

  return (
    <main className="relative min-h-screen bg-[url('/cruise-background.jpg')] bg-cover bg-center bg-fixed text-slate-900 before:absolute before:inset-0 before:bg-slate-950/65">
      <header className="relative z-10 border-b border-white/20 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
              Cruise Companion
            </p>

            <h1 className="text-2xl font-bold">
              My Cruise Dashboard
            </h1>

            <p className="mt-1 text-xs text-slate-500">
              Signed in as {user.email}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SignOutButton />

            <Link
              href="/dashboard/previous"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-center font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Previous cruises
            </Link>

            <Link
              href="/dashboard/import"
              className="rounded-xl border border-blue-700 bg-white px-5 py-3 text-center font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              Import spreadsheet
            </Link>

            <Link
              href="/dashboard/add"
              className="rounded-xl bg-blue-700 px-5 py-3 text-center font-semibold text-white transition hover:bg-blue-800"
            >
              Add a cruise
            </Link>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8">
        <section className="mb-8 text-white">
          <p className="text-sm font-medium text-blue-200">
            Welcome back
          </p>

          <h2 className="mt-1 text-3xl font-bold">
            {nextCruise
              ? `${nextCruise.ship_name} is your next voyage.`
              : "Your next voyage awaits."}
          </h2>

          <p className="mt-2 max-w-3xl text-slate-200">
            Keep your cruise bookings, costs, packages, excursions,
            receipts and travel documents organized in one private place.
          </p>
        </section>

        {error && (
          <section className="mb-6 rounded-2xl border border-red-300 bg-red-50 p-5 text-red-800 shadow-lg">
            <p className="font-bold">
              Cruises could not be loaded
            </p>

            <p className="mt-1 text-sm">
              {error.message}
            </p>
          </section>
        )}

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard
            title="Upcoming cruises"
            value={String(upcomingCruises.length)}
          />

          <DashboardCard
            title="Previous cruises"
            value={String(previousCruiseCount ?? 0)}
          />

          <DashboardCard
            title="Days until sailing"
            value={
              daysUntilSailing === null
                ? "—"
                : String(Math.max(daysUntilSailing, 0))
            }
          />

          <DashboardCard
            title="Total cruises"
            value={String(totalCruiseCount ?? 0)}
          />
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-white">
                Upcoming cruises
              </h2>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/dashboard/previous"
                  className="text-sm font-semibold text-blue-200 hover:text-white hover:underline"
                >
                  View previous cruises
                </Link>

                <Link
                  href="/dashboard/import"
                  className="text-sm font-semibold text-blue-200 hover:text-white hover:underline"
                >
                  Import cruises
                </Link>

                <Link
                  href="/dashboard/add"
                  className="text-sm font-semibold text-blue-200 hover:text-white hover:underline"
                >
                  Add another cruise
                </Link>
              </div>
            </div>

            {upcomingCruises.length === 0 ? (
              <EmptyCruises />
            ) : (
              <div className="space-y-5">
                {upcomingCruises.map((cruise) => (
                  <CruiseCard
                    key={cruise.id}
                    cruise={cruise}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-white/30 bg-white/95 p-6 shadow-xl backdrop-blur-md">
              <p className="text-sm font-bold uppercase tracking-wider text-blue-700">
                Next sailing
              </p>

              {nextCruise ? (
                <>
                  <div className="relative mt-4 h-48 overflow-hidden rounded-2xl bg-slate-200">
                    <Image
                      src={getCruiseLineImage(nextCruise.cruise_line)}
                      alt={`${nextCruise.cruise_line} cruise ship`}
                      fill
                      sizes="350px"
                      className="object-cover"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <p className="text-xs font-bold uppercase tracking-wider text-white/80">
                        {nextCruise.cruise_line}
                      </p>

                      <h2 className="mt-1 text-2xl font-bold">
                        {nextCruise.ship_name}
                      </h2>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    <SidebarDetail
                      label="Sailing from"
                      value={
                        nextCruise.sailing_from ||
                        "Not entered"
                      }
                    />

                    <SidebarDetail
                      label="Departure"
                      value={formatDate(
                        nextCruise.departure_date
                      )}
                    />

                    <SidebarDetail
                      label="Length"
                      value={
                        nextCruise.duration_nights
                          ? `${nextCruise.duration_nights} nights`
                          : "Not entered"
                      }
                    />

                    <SidebarDetail
                      label="Booking number"
                      value={
                        nextCruise.booking_number ||
                        "Not entered"
                      }
                    />

                    <SidebarDetail
                      label="Payment"
                      value={
                        nextCruise.paid_off
                          ? "Paid off"
                          : "Balance remaining"
                      }
                    />
                  </div>

                  <Link
                    href={`/dashboard/cruises/${nextCruise.id}`}
                    className="mt-6 block w-full rounded-xl bg-blue-700 px-4 py-3 text-center font-bold text-white transition hover:bg-blue-800"
                  >
                    Open cruise
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="mt-2 text-xl font-bold">
                    No upcoming cruise
                  </h2>

                  <p className="mt-2 text-sm text-slate-600">
                    Add your next booking or import your existing
                    spreadsheet.
                  </p>

                  <div className="mt-5 space-y-3">
                    <Link
                      href="/dashboard/add"
                      className="block rounded-xl bg-blue-700 px-4 py-3 text-center font-bold text-white transition hover:bg-blue-800"
                    >
                      Add a cruise
                    </Link>

                    <Link
                      href="/dashboard/import"
                      className="block rounded-xl border border-blue-700 px-4 py-3 text-center font-bold text-blue-700 transition hover:bg-blue-50"
                    >
                      Import spreadsheet
                    </Link>
                  </div>
                </>
              )}
            </section>

            <section className="rounded-2xl border border-white/20 bg-slate-900/90 p-6 text-white shadow-xl backdrop-blur-md">
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-300">
                Cruise history
              </p>

              <h2 className="mt-2 text-xl font-bold">
                Previous cruises
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                Past cruises are stored on a separate page so the main
                dashboard stays focused on upcoming trips.
              </p>

              <Link
                href="/dashboard/previous"
                className="mt-5 block rounded-xl bg-white px-4 py-3 text-center font-bold text-slate-900 transition hover:bg-slate-100"
              >
                View previous cruises
              </Link>
            </section>

            <section className="rounded-2xl border border-white/20 bg-slate-900/90 p-6 text-white shadow-xl backdrop-blur-md">
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-300">
                Cruise records
              </p>

              <h2 className="mt-2 text-xl font-bold">
                Keep everything together
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                Each cruise can include excursions, documents,
                receipts, package information and notes.
              </p>

              <div className="mt-5 space-y-3 text-sm">
                <FeatureRow text="Booking confirmations" />
                <FeatureRow text="Receipts and invoices" />
                <FeatureRow text="Excursion reservations" />
                <FeatureRow text="Drink and Wi-Fi packages" />
                <FeatureRow text="Payment status" />
                <FeatureRow text="Spreadsheet imports" />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function CruiseCard({
  cruise,
}: {
  cruise: Cruise;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/30 bg-white/95 shadow-xl backdrop-blur-md">
      <div className="relative h-56 w-full bg-slate-200">
        <Image
          src={getCruiseLineImage(cruise.cruise_line)}
          alt={`${cruise.cruise_line} cruise ship`}
          fill
          sizes="(max-width: 1024px) 100vw, 70vw"
          className="object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <p className="text-sm font-semibold uppercase tracking-wider text-white/80">
            {cruise.cruise_line}
          </p>

          <h3 className="mt-1 text-3xl font-bold">
            {cruise.ship_name}
          </h3>
        </div>
      </div>

      <div
        className={
          cruise.booking_status.toLowerCase() === "cancelled" ||
          cruise.booking_status.toLowerCase() === "canceled"
            ? "h-2 bg-red-600"
            : "h-2 bg-blue-700"
        }
      />

      <div className="p-6">
        <div className="flex flex-col justify-between gap-5 xl:flex-row">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={cruise.booking_status} />
          </div>

          <div className="xl:text-right">
            <p className="text-sm text-slate-500">
              Departure date
            </p>

            <p className="text-lg font-bold">
              {formatDate(cruise.departure_date)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 border-t border-slate-200 pt-5 sm:grid-cols-2 xl:grid-cols-4">
          <CruiseDetail
            label="Sailing from"
            value={
              cruise.sailing_from ||
              "Not entered"
            }
          />

          <CruiseDetail
            label="Length"
            value={
              cruise.duration_nights
                ? `${cruise.duration_nights} nights`
                : "Not entered"
            }
          />

          <CruiseDetail
            label="Booking number"
            value={
              cruise.booking_number ||
              "Not entered"
            }
          />

          <CruiseDetail
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

function EmptyCruises() {
  return (
    <section className="rounded-3xl border border-dashed border-white/40 bg-white/95 p-10 text-center shadow-xl backdrop-blur-md">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-3xl">
        ⚓
      </div>

      <h3 className="mt-5 text-2xl font-bold">
        No upcoming cruises
      </h3>

      <p className="mx-auto mt-2 max-w-lg text-slate-600">
        Add your next booking, import a spreadsheet or view your
        previous cruises.
      </p>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href="/dashboard/add"
          className="rounded-xl bg-blue-700 px-6 py-3 font-bold text-white transition hover:bg-blue-800"
        >
          Add a cruise
        </Link>

        <Link
          href="/dashboard/import"
          className="rounded-xl border border-blue-700 px-6 py-3 font-bold text-blue-700 transition hover:bg-blue-50"
        >
          Import spreadsheet
        </Link>

        <Link
          href="/dashboard/previous"
          className="rounded-xl border border-slate-300 px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-100"
        >
          Previous cruises
        </Link>
      </div>
    </section>
  );
}

function DashboardCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/30 bg-white/95 p-6 shadow-xl backdrop-blur-md">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>
    </div>
  );
}

function CruiseDetail({
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

function SidebarDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-slate-200 pb-3 last:border-0 last:pb-0">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words font-semibold text-slate-900">
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

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalizedStatus = status.toLowerCase();

  let classes =
    "rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800";

  if (
    normalizedStatus.includes("paid") ||
    normalizedStatus === "booked"
  ) {
    classes =
      "rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800";
  }

  if (
    normalizedStatus === "cancelled" ||
    normalizedStatus === "canceled"
  ) {
    classes =
      "rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800";
  }

  return (
    <span className={classes}>
      {status}
    </span>
  );
}

function FeatureRow({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
        ✓
      </span>

      <span>{text}</span>
    </div>
  );
}

function calculateDaysUntil(date: string) {
  const [year, month, day] = date
    .split("-")
    .map(Number);

  const departure = new Date(
    year,
    month - 1,
    day
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const difference =
    departure.getTime() -
    today.getTime();

  return Math.round(
    difference /
      (1000 * 60 * 60 * 24)
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(
    new Date(`${date}T00:00:00Z`)
  );
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

  const numberValue =
    typeof value === "number"
      ? value
      : Number.parseFloat(value);

  if (Number.isNaN(numberValue)) {
    return "Not entered";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    }
  ).format(numberValue);
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