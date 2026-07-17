import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";

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

export default async function CruiseDetailsPage({
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

  const { data: cruise, error } = await supabase
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
    .single();

  if (error || !cruise) {
    notFound();
  }

  const typedCruise = cruise as Cruise;

  return (
    <main className="relative min-h-screen bg-[url('/cruise-background.jpg')] bg-cover bg-center bg-fixed px-6 py-10 text-slate-900 before:absolute before:inset-0 before:bg-slate-950/70">
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            ← Back to dashboard
          </Link>

          <Link
            href={`/dashboard/cruises/${typedCruise.id}/edit`}
            className="rounded-xl bg-white px-5 py-3 font-bold text-slate-900 transition hover:bg-slate-100"
          >
            Edit cruise
          </Link>
        </div>

        <section className="overflow-hidden rounded-3xl border border-white/20 bg-white/95 shadow-2xl backdrop-blur-md">
          <div className="h-3 bg-blue-700" />

          <div className="p-6 sm:p-10">
            <div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-8 lg:flex-row">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
                  {typedCruise.cruise_line}
                </p>

                <h1 className="mt-2 text-4xl font-bold">
                  {typedCruise.ship_name}
                </h1>

                <p className="mt-3 text-lg text-slate-600">
                  Sailing from{" "}
                  <span className="font-semibold text-slate-900">
                    {typedCruise.sailing_from || "Not entered"}
                  </span>
                </p>
              </div>

              <div className="lg:text-right">
                <p className="text-sm font-semibold text-slate-500">
                  Departure
                </p>

                <p className="mt-1 text-2xl font-bold">
                  {formatDate(typedCruise.departure_date)}
                </p>

                <span className="mt-3 inline-block rounded-full bg-green-100 px-4 py-2 text-sm font-bold text-green-800">
                  {typedCruise.booking_status}
                </span>
              </div>
            </div>

            <nav className="mt-8 grid gap-3 sm:grid-cols-3">
              <TabLink
                href={`/dashboard/cruises/${typedCruise.id}`}
                label="Overview"
                active
              />

              <TabLink
                href={`/dashboard/cruises/${typedCruise.id}/excursions`}
                label="Excursions"
              />

              <TabLink
                href={`/dashboard/cruises/${typedCruise.id}/documents`}
                label="Documents & Receipts"
              />
            </nav>

            <section className="mt-8">
              <h2 className="text-2xl font-bold">Cruise overview</h2>

              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <DetailCard
                  label="Booking number"
                  value={typedCruise.booking_number || "Not entered"}
                />

                <DetailCard
                  label="Length"
                  value={
                    typedCruise.duration_nights
                      ? `${typedCruise.duration_nights} nights`
                      : "Not entered"
                  }
                />

                <DetailCard
                  label="Total cost"
                  value={formatCurrency(typedCruise.total_cost)}
                />

                <DetailCard
                  label="Payment status"
                  value={
                    typedCruise.paid_off
                      ? "Paid off"
                      : "Balance remaining"
                  }
                />
              </div>
            </section>

            <section className="mt-8 border-t border-slate-200 pt-8">
              <h2 className="text-2xl font-bold">
                Packages and reservations
              </h2>

              <div className="mt-5 flex flex-wrap gap-4">
                <StatusBox
                  label="Drink package"
                  enabled={typedCruise.drink_package}
                />

                <StatusBox
                  label="Wi-Fi"
                  enabled={typedCruise.wifi_package}
                />

                <StatusBox
                  label="Cruise paid off"
                  enabled={typedCruise.paid_off}
                />
              </div>
            </section>

            <section className="mt-8 border-t border-slate-200 pt-8">
              <h2 className="text-2xl font-bold">Notes</h2>

              <div className="mt-4 min-h-32 rounded-2xl bg-slate-100 p-5">
                <p className="whitespace-pre-wrap leading-7 text-slate-700">
                  {typedCruise.notes || "No notes have been added."}
                </p>
              </div>
            </section>

            <section className="mt-8 grid gap-5 border-t border-slate-200 pt-8 md:grid-cols-2">
              <ActionCard
                title="Excursions"
                description="Add booked excursions, tour providers, confirmation numbers, costs and port information."
                href={`/dashboard/cruises/${typedCruise.id}/excursions`}
                buttonText="Manage excursions"
              />

              <ActionCard
                title="Documents and receipts"
                description="Upload booking confirmations, invoices, receipts and other cruise documents."
                href={`/dashboard/cruises/${typedCruise.id}/documents`}
                buttonText="Manage documents"
              />
            </section>
          </div>
        </section>
      </div>
    </main>
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

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 break-words text-lg font-bold">{value}</p>
    </div>
  );
}

function StatusBox({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <div
      className={
        enabled
          ? "rounded-xl bg-green-100 px-5 py-3 font-bold text-green-800"
          : "rounded-xl bg-slate-200 px-5 py-3 font-bold text-slate-700"
      }
    >
      {label}: {enabled ? "Yes" : "No"}
    </div>
  );
}

function ActionCard({
  title,
  description,
  href,
  buttonText,
}: {
  title: string;
  description: string;
  href: string;
  buttonText: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <h3 className="text-xl font-bold">{title}</h3>

      <p className="mt-2 leading-6 text-slate-600">{description}</p>

      <Link
        href={href}
        className="mt-5 inline-block rounded-xl bg-blue-700 px-5 py-3 font-bold text-white transition hover:bg-blue-800"
      >
        {buttonText}
      </Link>
    </article>
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

function formatCurrency(value: number | string | null) {
  if (value === null || value === "") {
    return "Not entered";
  }

  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(value);

  if (Number.isNaN(numericValue)) {
    return "Not entered";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numericValue);
}