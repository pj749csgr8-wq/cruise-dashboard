import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { importCruises } from "./actions";

export default async function ImportCruisesPage({
  searchParams,
}: {
  searchParams: Promise<{
    imported?: string;
    skipped?: string;
  }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const results = await searchParams;
  const imported = Number(results.imported ?? "");
  const skipped = Number(results.skipped ?? "");
  const hasResults =
    Number.isFinite(imported) && Number.isFinite(skipped);

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
          <div className="border-b border-slate-200 pb-7">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
              Cruise Companion
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Import Cruises
            </h1>

            <p className="mt-2 leading-6 text-slate-600">
              Upload your existing Excel spreadsheet to add several
              cruises at once.
            </p>
          </div>

          {hasResults && (
            <section className="mt-7 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900">
              <h2 className="font-bold">
                Spreadsheet import completed
              </h2>

              <p className="mt-2">
                Imported:{" "}
                <strong>{imported}</strong>
              </p>

              <p className="mt-1">
                Duplicate rows skipped:{" "}
                <strong>{skipped}</strong>
              </p>

              <Link
                href="/dashboard"
                className="mt-5 inline-block rounded-xl bg-green-700 px-5 py-3 font-bold text-white transition hover:bg-green-800"
              >
                View imported cruises
              </Link>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-xl font-bold">
              Select your spreadsheet
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              The importer uses the worksheet named{" "}
              <strong>Form Responses 1</strong>. If that sheet is not
              found, it uses the first worksheet.
            </p>

            <form
              action={importCruises}
              className="mt-6 space-y-6"
            >
              <div>
                <label
                  htmlFor="spreadsheet"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Excel spreadsheet
                </label>

                <input
                  id="spreadsheet"
                  name="spreadsheet"
                  type="file"
                  required
                  accept=".xlsx,.xls"
                  className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-blue-100 file:px-4 file:py-2 file:font-bold file:text-blue-800"
                />
              </div>

              <button
                type="submit"
                className="rounded-xl bg-blue-700 px-6 py-3 font-bold text-white transition hover:bg-blue-800"
              >
                Import cruises
              </button>
            </form>
          </section>

          <section className="mt-9 border-t border-slate-200 pt-8">
            <h2 className="text-xl font-bold">
              Import behavior
            </h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <InfoCard
                title="Duplicate protection"
                text="Cruises already in your account are skipped rather than added twice."
              />

              <InfoCard
                title="Payment status"
                text="Notes containing paid off are marked paid. Notes mentioning money owed remain unpaid."
              />

              <InfoCard
                title="Cancelled cruises"
                text="Rows whose notes say cancelled or canceled are imported with Cancelled status."
              />

              <InfoCard
                title="Packages"
                text="Drink package and Wi-Fi default to No because those fields are not in the spreadsheet."
              />
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function InfoCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h3 className="font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {text}
      </p>
    </article>
  );
}