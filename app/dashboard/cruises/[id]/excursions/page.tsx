import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../../lib/supabase/server";
import { addExcursion, deleteExcursion } from "./actions";

type Cruise = {
  id: string;
  cruise_line: string;
  ship_name: string;
  departure_date: string;
};

type Excursion = {
  id: string;
  excursion_name: string;
  port_name: string | null;
  excursion_date: string | null;
  provider: string | null;
  confirmation_number: string | null;
  cost: number | string | null;
  status: string;
  notes: string | null;
};

export default async function ExcursionsPage({
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

  const { data: excursionData, error: excursionError } =
    await supabase
      .from("excursions")
      .select(
        `
          id,
          excursion_name,
          port_name,
          excursion_date,
          provider,
          confirmation_number,
          cost,
          status,
          notes
        `
      )
      .eq("cruise_id", id)
      .order("excursion_date", {
        ascending: true,
        nullsFirst: false,
      });

  const typedCruise = cruise as Cruise;
  const excursions = (excursionData ?? []) as Excursion[];

  const addExcursionForCruise = addExcursion.bind(null, id);

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
                {typedCruise.ship_name} Excursions
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
                active
              />

              <TabLink
                href={`/dashboard/cruises/${id}/documents`}
                label="Documents & Receipts"
              />
            </nav>

            {excursionError && (
              <div className="mt-8 rounded-2xl border border-red-300 bg-red-50 p-5 text-red-800">
                <p className="font-bold">
                  Excursions could not be loaded
                </p>

                <p className="mt-1 text-sm">
                  {excursionError.message}
                </p>
              </div>
            )}

            <section className="mt-8">
              <h2 className="text-2xl font-bold">
                Booked excursions
              </h2>

              {excursions.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <h3 className="text-xl font-bold">
                    No excursions added
                  </h3>

                  <p className="mt-2 text-slate-600">
                    Add your first excursion using the form below.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  {excursions.map((excursion) => (
                    <ExcursionCard
                      key={excursion.id}
                      cruiseId={id}
                      excursion={excursion}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10 border-t border-slate-200 pt-8">
              <h2 className="text-2xl font-bold">
                Add an excursion
              </h2>

              <p className="mt-2 text-slate-600">
                Record tours booked through the cruise line or an
                independent company.
              </p>

              <form
                action={addExcursionForCruise}
                className="mt-6 space-y-7"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    label="Excursion name"
                    name="excursion_name"
                    placeholder="Snorkeling and beach tour"
                    required
                  />

                  <FormField
                    label="Port"
                    name="port_name"
                    placeholder="Cozumel, Mexico"
                  />

                  <FormField
                    label="Excursion date"
                    name="excursion_date"
                    type="date"
                  />

                  <FormField
                    label="Provider"
                    name="provider"
                    placeholder="Royal Caribbean"
                  />

                  <FormField
                    label="Confirmation number"
                    name="confirmation_number"
                    placeholder="EXC123456"
                  />

                  <FormField
                    label="Cost"
                    name="cost"
                    type="number"
                    placeholder="149.00"
                    min="0"
                    step="0.01"
                  />

                  <div>
                    <label
                      htmlFor="status"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Status
                    </label>

                    <select
                      id="status"
                      name="status"
                      defaultValue="Booked"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    >
                      <option>Planning</option>
                      <option>Booked</option>
                      <option>Paid</option>
                      <option>Completed</option>
                      <option>Cancelled</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="notes"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Notes
                  </label>

                  <textarea
                    id="notes"
                    name="notes"
                    rows={5}
                    placeholder="Meeting location, transportation details, cancellation policy or other notes."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <button
                  type="submit"
                  className="rounded-xl bg-blue-700 px-6 py-3 font-bold text-white transition hover:bg-blue-800"
                >
                  Save excursion
                </button>
              </form>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function ExcursionCard({
  cruiseId,
  excursion,
}: {
  cruiseId: string;
  excursion: Excursion;
}) {
  const deleteThisExcursion = deleteExcursion.bind(
    null,
    cruiseId,
    excursion.id
  );

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">
            {excursion.excursion_name}
          </h3>

          <p className="mt-1 text-slate-600">
            {excursion.port_name || "Port not entered"}
          </p>
        </div>

        <StatusBadge status={excursion.status} />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Detail
          label="Date"
          value={
            excursion.excursion_date
              ? formatDate(excursion.excursion_date)
              : "Not entered"
          }
        />

        <Detail
          label="Cost"
          value={formatCurrency(excursion.cost)}
        />

        <Detail
          label="Provider"
          value={excursion.provider || "Not entered"}
        />

        <Detail
          label="Confirmation"
          value={
            excursion.confirmation_number || "Not entered"
          }
        />
      </div>

      {excursion.notes && (
        <div className="mt-5 rounded-xl bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Notes
          </p>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {excursion.notes}
          </p>
        </div>
      )}

      <form action={deleteThisExcursion} className="mt-5">
        <button
          type="submit"
          className="rounded-xl border border-red-300 px-4 py-2 font-bold text-red-700 transition hover:bg-red-50"
        >
          Delete excursion
        </button>
      </form>
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

function FormField({
  label,
  name,
  type = "text",
  placeholder,
  required = false,
  min,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  step?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-semibold text-slate-700"
      >
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        min={min}
        step={step}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
      />
    </div>
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
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words font-semibold">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  let classes =
    "rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800";

  if (normalized === "paid" || normalized === "completed") {
    classes =
      "rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800";
  }

  if (normalized === "cancelled") {
    classes =
      "rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800";
  }

  return <span className={classes}>{status}</span>;
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
    typeof value === "number"
      ? value
      : Number.parseFloat(value);

  if (Number.isNaN(numericValue)) {
    return "Not entered";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numericValue);
}