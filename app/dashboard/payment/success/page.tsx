import Link from "next/link";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { createClient } from "../../../../lib/supabase/server";

type SuccessPageProps = {
  searchParams: Promise<{
    session_id?: string;
  }>;
};

export default async function PaymentSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { session_id: sessionId } =
    await searchParams;

  if (!sessionId) {
    redirect("/dashboard/payment");
  }

  const stripeSecretKey =
    process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    return (
      <SuccessLayout>
        <StatusCard
          icon="⚠️"
          heading="Payment confirmation unavailable"
          message="Stripe is not configured on the server."
          tone="warning"
        />
      </SuccessLayout>
    );
  }

  try {
    const stripe = new Stripe(
      stripeSecretKey
    );

    const session =
      await stripe.checkout.sessions.retrieve(
        sessionId
      );

    const sessionUserId =
      session.metadata?.user_id ??
      session.client_reference_id;

    if (
      !sessionUserId ||
      sessionUserId !== user.id
    ) {
      return (
        <SuccessLayout>
          <StatusCard
            icon="🔒"
            heading="Payment could not be verified"
            message="This checkout session does not belong to the signed-in account."
            tone="error"
          />
        </SuccessLayout>
      );
    }

    const planName =
      session.metadata?.plan_name ===
      "heavy"
        ? "Heavy"
        : "Standard";

    const monthlyLimit =
      session.metadata
        ?.monthly_ai_limit ?? "10";

    const paymentComplete =
      session.payment_status === "paid" ||
      session.status === "complete";

    if (!paymentComplete) {
      return (
        <SuccessLayout>
          <StatusCard
            icon="⏳"
            heading="Payment is still processing"
            message="Stripe has not confirmed the payment yet. Your membership will update automatically after confirmation."
            tone="warning"
          />

          <div className="mt-6 text-center">
            <Link
              href="/dashboard/payment"
              className="inline-flex rounded-xl border border-blue-700 bg-white px-6 py-3 font-bold text-blue-700 transition hover:bg-blue-50"
            >
              Return to membership plans
            </Link>
          </div>
        </SuccessLayout>
      );
    }

    return (
      <SuccessLayout>
        <section className="rounded-3xl border border-green-200 bg-green-50 p-8 text-center shadow-sm sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
            ✓
          </div>

          <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-green-700">
            Payment successful
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
            Welcome to the {planName} plan
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Stripe confirmed your
            subscription. Your account
            includes {monthlyLimit} AI
            travel-document analyses
            each month.
          </p>

          <div className="mx-auto mt-8 grid max-w-2xl gap-4 text-left sm:grid-cols-2">
            <DetailCard
              label="Membership"
              value={`${planName} annual plan`}
            />

            <DetailCard
              label="AI allowance"
              value={`${monthlyLimit} analyses monthly`}
            />

            <DetailCard
              label="Payment status"
              value="Paid"
            />

            <DetailCard
              label="Billing"
              value="Renews annually"
            />
          </div>

          <div className="mt-8 rounded-2xl border border-green-200 bg-white p-5 text-left">
            <p className="font-bold text-slate-950">
              Your account update may
              take a few seconds
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              The Stripe webhook will
              update your plan in the
              database. Refresh the
              membership or Travel page
              if the new allowance does
              not appear immediately.
            </p>
          </div>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="rounded-xl bg-blue-700 px-6 py-3 font-bold text-white transition hover:bg-blue-800"
            >
              Return to dashboard
            </Link>

            <Link
              href="/dashboard/payment"
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-100"
            >
              View membership
            </Link>
          </div>
        </section>
      </SuccessLayout>
    );
  } catch (error) {
    console.error(
      "Stripe success-page verification failed:",
      error
    );

    return (
      <SuccessLayout>
        <StatusCard
          icon="⚠️"
          heading="Payment confirmation unavailable"
          message="We could not verify the Stripe checkout session. Check your Stripe account before attempting another payment."
          tone="error"
        />
      </SuccessLayout>
    );
  }
}

function SuccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen bg-[url('/cruise-background.jpg')] bg-cover bg-center bg-fixed px-5 py-10 text-slate-900 before:absolute before:inset-0 before:bg-slate-950/75 sm:px-8">
      <div className="relative z-10 mx-auto max-w-4xl">
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

          <div className="p-6 sm:p-10">
            {children}
          </div>
        </section>
      </div>
    </main>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 font-bold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function StatusCard({
  icon,
  heading,
  message,
  tone,
}: {
  icon: string;
  heading: string;
  message: string;
  tone: "warning" | "error";
}) {
  const classes =
    tone === "error"
      ? "border-red-300 bg-red-50 text-red-900"
      : "border-amber-300 bg-amber-50 text-amber-900";

  return (
    <section
      className={`rounded-3xl border p-8 text-center ${classes}`}
    >
      <div className="text-5xl">
        {icon}
      </div>

      <h1 className="mt-5 text-3xl font-black">
        {heading}
      </h1>

      <p className="mx-auto mt-3 max-w-2xl leading-7">
        {message}
      </p>
    </section>
  );
}