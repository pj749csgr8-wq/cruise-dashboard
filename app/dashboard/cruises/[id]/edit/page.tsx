import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../../lib/supabase/server";
import { deleteCruise, updateCruise } from "./actions";

type Cruise = {
  id: string;
  cruise_line: string;
  sailing_from: string | null;
  ship_name: string;
  departure_date: string;
  booking_number: string | null;
  total_cost: number | string | null;
  duration_nights: number | null;
  notes: string | null;
  drink_package: boolean;
  wifi_package: boolean;
  paid_off: boolean;
};

export default async function EditCruisePage({
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
        duration_nights,
        notes,
        drink_package,
        wifi_package,
        paid_off
      `
    )
    .eq("id", id)
    .single();

  if (error || !cruise) {
    notFound();
  }

  const typedCruise = cruise as Cruise;
  const updateThisCruise = updateCruise.bind(null, id);
  const deleteThisCruise = deleteCruise.bind(null, id);

  return (
    <main className="relative min-h-screen bg-[url('/cruise-background.jpg')] bg-cover bg-center bg-fixed px-6 py-10 text-slate-900 before:absolute before:inset-0 before:bg-slate-950/70">
      <div className="relative z-10 mx-auto max-w-4xl">
        <Link
          href={`/dashboard/cruises/${id}`}
          className="mb-6 inline-flex rounded-xl border border-white/30 bg-white/10 px-4 py-2 font-semibold text-white backdrop-blur transition hover:bg-white/20"
        >
          ← Back to cruise
        </Link>

        <section className="rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-md sm:p-10">
          <div className="mb-8">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
              Cruise Companion
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Edit {typedCruise.ship_name}
            </h1>

            <p className="mt-2 text-slate-600">
              Update booking, payment and package information.
            </p>
          </div>

          <form
            action={updateThisCruise}
            className="space-y-8"
          >
            <section>
              <h2 className="mb-5 text-lg font-bold">
                Cruise information
              </h2>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  label="Cruise Line"
                  name="cruise_line"
                  defaultValue={typedCruise.cruise_line}
                  required
                />

                <FormField
                  label="Sailing From"
                  name="sailing_from"
                  defaultValue={
                    typedCruise.sailing_from || ""
                  }
                />

                <FormField
                  label="Ship"
                  name="ship_name"
                  defaultValue={typedCruise.ship_name}
                  required
                />

                <FormField
                  label="Date"
                  name="departure_date"
                  type="date"
                  defaultValue={typedCruise.departure_date}
                  required
                />

                <FormField
                  label="Booking Number"
                  name="booking_number"
                  defaultValue={
                    typedCruise.booking_number || ""
                  }
                />

                <FormField
                  label="Cost"
                  name="total_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={
                    typedCruise.total_cost === null
                      ? ""
                      : String(typedCruise.total_cost)
                  }
                />

                <FormField
                  label="Length in Nights"
                  name="duration_nights"
                  type="number"
                  min="1"
                  defaultValue={
                    typedCruise.duration_nights === null
                      ? ""
                      : String(typedCruise.duration_nights)
                  }
                />
              </div>
            </section>

            <section className="border-t border-slate-200 pt-8">
              <h2 className="mb-5 text-lg font-bold">
                Packages and payment
              </h2>

              <div className="grid gap-6 sm:grid-cols-2">
                <YesNoField
                  label="Drink Package Bought?"
                  name="drink_package"
                  currentValue={typedCruise.drink_package}
                />

                <YesNoField
                  label="Wi-Fi Bought?"
                  name="wifi_package"
                  currentValue={typedCruise.wifi_package}
                />

                <YesNoField
                  label="Cruise Paid Off?"
                  name="paid_off"
                  currentValue={typedCruise.paid_off}
                />
              </div>
            </section>

            <section className="border-t border-slate-200 pt-8">
              <label
                htmlFor="notes"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Notes
              </label>

              <textarea
                id="notes"
                name="notes"
                rows={6}
                defaultValue={typedCruise.notes || ""}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </section>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-8 sm:flex-row sm:justify-end">
              <Link
                href={`/dashboard/cruises/${id}`}
                className="rounded-xl border border-slate-300 px-5 py-3 text-center font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="rounded-xl bg-blue-700 px-6 py-3 font-bold text-white transition hover:bg-blue-800"
              >
                Save changes
              </button>
            </div>
          </form>

          <section className="mt-10 border-t border-red-200 pt-8">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
              <h2 className="text-xl font-bold text-red-900">
                Delete cruise
              </h2>

              <p className="mt-2 text-sm leading-6 text-red-800">
                Deleting this cruise will also remove its excursion
                records and document database records.
              </p>

              <form action={deleteThisCruise} className="mt-5">
                <button
                  type="submit"
                  className="rounded-xl bg-red-700 px-5 py-3 font-bold text-white transition hover:bg-red-800"
                >
                  Permanently delete cruise
                </button>
              </form>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function FormField({
  label,
  name,
  type = "text",
  defaultValue,
  required = false,
  min,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue: string;
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
        defaultValue={defaultValue}
        required={required}
        min={min}
        step={step}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

function YesNoField({
  label,
  name,
  currentValue,
}: {
  label: string;
  name: string;
  currentValue: boolean;
}) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <legend className="px-2 text-sm font-bold text-slate-800">
        {label}
      </legend>

      <div className="mt-2 flex gap-6">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name={name}
            value="yes"
            defaultChecked={currentValue}
            className="h-4 w-4"
          />
          <span>Yes</span>
        </label>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name={name}
            value="no"
            defaultChecked={!currentValue}
            className="h-4 w-4"
          />
          <span>No</span>
        </label>
      </div>
    </fieldset>
  );
}