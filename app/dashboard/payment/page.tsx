import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

type PlanName = "standard" | "heavy";

type UserPlan = {
  plan_name: PlanName;
  monthly_ai_limit: number;
};

const plans = [
  {
    id: "standard",
    name: "Standard",
    price: 30,
    description:
      "A simple annual plan for travelers who occasionally use AI document analysis.",
    monthlyAiLimit: 10,
    features: [
      "10 AI document analyses each month",
      "Cruise and trip organization",
      "Document and receipt storage",
      "Flight and hotel tracking",
      "Excursion management",
      "Annual billing",
    ],
  },
  {
    id: "heavy",
    name: "Heavy",
    price: 60,
    description:
      "For frequent travelers who upload and analyze more travel documents.",
    monthlyAiLimit: 50,
    features: [
      "50 AI document analyses each month",
      "Cruise and trip organization",
      "Document and receipt storage",
      "Flight and hotel tracking",
      "Excursion management",
      "Priority access to future AI features",
      "Annual billing",
    ],
  },
] as const;

export default async function PaymentPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const {
    data: planData,
    error: planError,
  } = await supabase
    .from("user_ai_plans")
    .select("plan_name, monthly_ai_limit")
    .eq("user_id", user.id)
    .maybeSingle();

  const currentPlan: UserPlan = {
    plan_name:
      planData?.plan_name === "heavy"
        ? "heavy"
        : "standard",

    monthly_ai_limit:
      typeof planData?.monthly_ai_limit === "number"
        ? planData.monthly_ai_limit
        : 10,
  };

  return (
    <main className="relative min-h-screen bg-[url('/cruise-background.jpg')] bg-cover bg-center bg-fixed px-5 py-10 text-slate-900 before:absolute before:inset-0 before:bg-slate-950/75 sm:px-8">
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex rounded-xl border border-white/30 bg-white/10 px-4 py-2 font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            ← Back to dashboard
          </Link>
        </div>

        <section className="overflow-hidden rounded-3xl border border-white/20 bg-white/95 shadow-2xl backdrop-blur-md">
          <div className="h-3 bg-blue-700" />

          <div className="px-6 py-10 sm:px-10">
            <header className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
                Membership plans
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Choose your travel plan
              </h1>

              <p className="mt-5 text-lg leading-8 text-slate-600">
                Keep your cruises, hotels, flights, excursions,
                documents and receipts organized in one place.
              </p>
            </header>

            {planError && (
              <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
                <p className="font-bold">
                  Current plan unavailable
                </p>

                <p className="mt-1 text-sm leading-6">
                  Your current plan could not be confirmed, but
                  you may still review the available plans.
                </p>
              </div>
            )}

            <section className="mt-10 rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                    Current plan
                  </p>

                  <h2 className="mt-1 text-2xl font-bold text-slate-950">
                    {formatPlanName(currentPlan.plan_name)}
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    {currentPlan.monthly_ai_limit} AI analyses
                    available each month
                  </p>
                </div>

                <span className="rounded-full bg-white px-5 py-2 text-sm font-bold text-blue-800 shadow-sm">
                  Active
                </span>
              </div>
            </section>

            <div className="mt-10 grid gap-7 lg:grid-cols-2">
              {plans.map((plan) => {
                const isCurrentPlan =
                  currentPlan.plan_name === plan.id;

                const isHeavy = plan.id === "heavy";

                return (
                  <article
                    key={plan.id}
                    className={
                      isHeavy
                        ? "relative overflow-hidden rounded-3xl border-2 border-blue-700 bg-white p-7 shadow-xl"
                        : "relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-lg"
                    }
                  >
                    {isHeavy && (
                      <div className="absolute right-0 top-0 rounded-bl-2xl bg-blue-700 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white">
                        Best for frequent travelers
                      </div>
                    )}

                    <div className={isHeavy ? "pt-8" : ""}>
                      <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">
                        {plan.name}
                      </p>

                      <div className="mt-4 flex items-end gap-2">
                        <span className="text-5xl font-black tracking-tight text-slate-950">
                          ${plan.price}
                        </span>

                        <span className="pb-2 font-semibold text-slate-500">
                          per year
                        </span>
                      </div>

                      <p className="mt-5 min-h-[72px] leading-7 text-slate-600">
                        {plan.description}
                      </p>

                      <div className="mt-6 rounded-2xl bg-slate-100 p-5">
                        <p className="text-sm font-semibold text-slate-500">
                          Monthly AI allowance
                        </p>

                        <p className="mt-1 text-3xl font-black text-slate-950">
                          {plan.monthlyAiLimit}
                        </p>

                        <p className="text-sm text-slate-600">
                          document analyses per month
                        </p>
                      </div>

                      <ul className="mt-7 space-y-4">
                        {plan.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-start gap-3 text-slate-700"
                          >
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-black text-green-700">
                              ✓
                            </span>

                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {isCurrentPlan ? (
                        <button
                          type="button"
                          disabled
                          className="mt-8 w-full cursor-not-allowed rounded-xl bg-slate-200 px-6 py-4 text-lg font-bold text-slate-500"
                        >
                          Current plan
                        </button>
                      ) : (
                        <form
                          action="/api/create-checkout-session"
                          method="POST"
                          className="mt-8"
                        >
                          <input
                            type="hidden"
                            name="plan"
                            value={plan.id}
                          />

                          <button
                            type="submit"
                            className={
                              isHeavy
                                ? "w-full rounded-xl bg-blue-700 px-6 py-4 text-lg font-bold text-white transition hover:bg-blue-800"
                                : "w-full rounded-xl border-2 border-blue-700 bg-white px-6 py-4 text-lg font-bold text-blue-700 transition hover:bg-blue-50"
                            }
                          >
                            Choose {plan.name}
                          </button>
                        </form>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-xl font-bold text-slate-950">
                Secure payment
              </h2>

              <p className="mt-2 leading-7 text-slate-600">
                Payments will be processed securely through Stripe.
                Your app will not directly store complete card
                information.
              </p>
            </section>

            <p className="mt-8 text-center text-sm leading-6 text-slate-500">
              The checkout buttons will become active after the
              Stripe Checkout endpoint is connected. You may review
              the page design before enabling live payments.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function formatPlanName(plan: PlanName) {
  return plan === "heavy"
    ? "Heavy"
    : "Standard";
}