import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { addCruise } from "../actions";

export default async function AddCruisePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="relative min-h-screen bg-[url('/cruise-background.jpg')] bg-cover bg-center bg-fixed px-6 py-10 text-slate-900 before:absolute before:inset-0 before:bg-slate-950/70">
      <div className="relative z-10 mx-auto max-w-4xl">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex rounded-xl border border-white/30 bg-white/10 px-4 py-2 font-semibold text-white backdrop-blur transition hover:bg-white/20"
        >
          ← Back to dashboard
        </Link>

        <section className="rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-md sm:p-10">
          <div className="mb-8">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
              Cruise Companion
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Add a cruise
            </h1>

            <p className="mt-2 text-slate-600">
              Enter your cruise booking information.
            </p>
          </div>

          <form action={addCruise} className="space-y-8">
            <section>
              <h2 className="mb-5 text-lg font-bold">
                Cruise information
              </h2>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  label="Cruise Line"
                  name="cruise_line"
                  placeholder="Royal Caribbean"
                  required
                />

                <FormField
                  label="Sailing From"
                  name="sailing_from"
                  placeholder="Miami, Florida"
                />

                <FormField
                  label="Ship"
                  name="ship_name"
                  placeholder="Icon of the Seas"
                  required
                />

                <FormField
                  label="Date"
                  name="departure_date"
                  type="date"
                  required
                />

                <FormField
                  label="Booking Number"
                  name="booking_number"
                  placeholder="ABC123456"
                />

                <FormField
                  label="Cost"
                  name="total_cost"
                  type="number"
                  placeholder="2147.00"
                  min="0"
                  step="0.01"
                />

                <FormField
                  label="Length in Nights"
                  name="duration_nights"
                  type="number"
                  placeholder="7"
                  min="1"
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
                />

                <YesNoField
                  label="Wi-Fi Bought?"
                  name="wifi_package"
                />

                <YesNoField
                  label="Cruise Paid Off?"
                  name="paid_off"
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
                placeholder="Cabin details, payment information, travel-agent notes, special requests or anything else."
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </section>

            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <h2 className="font-bold text-blue-900">
                Documents and receipts
              </h2>

              <p className="mt-2 text-sm leading-6 text-blue-800">
                After saving the cruise, you will be able to upload
                booking confirmations, invoices, receipts and other
                documents.
              </p>
            </section>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-8 sm:flex-row sm:justify-end">
              <Link
                href="/dashboard"
                className="rounded-xl border border-slate-300 px-5 py-3 text-center font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="rounded-xl bg-blue-700 px-6 py-3 font-bold text-white transition hover:bg-blue-800"
              >
                Save cruise
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
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

function YesNoField({
  label,
  name,
}: {
  label: string;
  name: string;
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
            className="h-4 w-4"
          />

          <span className="font-medium">Yes</span>
        </label>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name={name}
            value="no"
            defaultChecked
            className="h-4 w-4"
          />

          <span className="font-medium">No</span>
        </label>
      </div>
    </fieldset>
  );
}