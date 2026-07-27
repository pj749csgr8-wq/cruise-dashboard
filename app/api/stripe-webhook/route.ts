import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

type PlanName = "standard" | "heavy";

type PlanDetails = {
  planName: PlanName;
  monthlyAiLimit: number;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripeSecretKey =
    process.env.STRIPE_SECRET_KEY;

  const webhookSecret =
    process.env.STRIPE_WEBHOOK_SECRET;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !stripeSecretKey ||
    !webhookSecret ||
    !supabaseUrl ||
    !supabaseSecretKey
  ) {
    console.error(
      "Stripe webhook environment variables are missing."
    );

    return NextResponse.json(
      {
        error:
          "Webhook configuration is incomplete.",
      },
      {
        status: 500,
      }
    );
  }

  const stripe = new Stripe(
    stripeSecretKey
  );

  const signature =
    request.headers.get(
      "stripe-signature"
    );

  if (!signature) {
    return NextResponse.json(
      {
        error:
          "Stripe signature header is missing.",
      },
      {
        status: 400,
      }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody =
      await request.text();

    event =
      stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );
  } catch (error) {
    console.error(
      "Stripe webhook signature verification failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Webhook signature verification failed.",
      },
      {
        status: 400,
      }
    );
  }

  const supabaseAdmin =
    createClient(
      supabaseUrl,
      supabaseSecretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session =
          event.data
            .object as Stripe.Checkout.Session;

        await handleCompletedCheckout(
          session,
          supabaseAdmin
        );

        break;
      }

      case "customer.subscription.updated": {
        const subscription =
          event.data
            .object as Stripe.Subscription;

        await handleSubscriptionUpdate(
          subscription,
          supabaseAdmin
        );

        break;
      }

      case "customer.subscription.deleted": {
        const subscription =
          event.data
            .object as Stripe.Subscription;

        await returnUserToStandardPlan(
          subscription,
          supabaseAdmin
        );

        break;
      }

      default: {
        console.log(
          `Stripe event ignored: ${event.type}`
        );
      }
    }

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error(
      `Stripe webhook processing failed for ${event.type}:`,
      error
    );

    return NextResponse.json(
      {
        error:
          "Webhook processing failed.",
      },
      {
        status: 500,
      }
    );
  }
}

async function handleCompletedCheckout(
  session: Stripe.Checkout.Session,
  supabaseAdmin: any
) {
  if (
    session.mode !== "subscription"
  ) {
    return;
  }

  if (
    session.payment_status !== "paid" &&
    session.status !== "complete"
  ) {
    console.log(
      `Checkout session ${session.id} is not complete.`
    );

    return;
  }

  const userId =
    session.metadata?.user_id ??
    session.client_reference_id;

  if (!userId) {
    throw new Error(
      `Checkout session ${session.id} has no user ID.`
    );
  }

  const plan =
    readPlanDetails(
      session.metadata
    );

  await saveUserPlan(
    supabaseAdmin,
    userId,
    plan
  );

  console.log(
    `Updated user ${userId} to ${plan.planName}.`
  );
}

async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  supabaseAdmin: any
) {
  const userId =
    subscription.metadata?.user_id;

  if (!userId) {
    console.log(
      `Subscription ${subscription.id} has no user ID metadata.`
    );

    return;
  }

  const activeStatuses = [
    "active",
    "trialing",
  ];

  if (
    !activeStatuses.includes(
      subscription.status
    )
  ) {
    console.log(
      `Subscription ${subscription.id} has status ${subscription.status}; plan was not upgraded.`
    );

    return;
  }

  const plan =
    readPlanDetails(
      subscription.metadata
    );

  await saveUserPlan(
    supabaseAdmin,
    userId,
    plan
  );

  console.log(
    `Synchronized subscription ${subscription.id} for user ${userId}.`
  );
}

async function returnUserToStandardPlan(
  subscription: Stripe.Subscription,
  supabaseAdmin: any
) {
  const userId =
    subscription.metadata?.user_id;

  if (!userId) {
    console.log(
      `Canceled subscription ${subscription.id} has no user ID metadata.`
    );

    return;
  }

  await saveUserPlan(
    supabaseAdmin,
    userId,
    {
      planName: "standard",
      monthlyAiLimit: 10,
    }
  );

  console.log(
    `Returned user ${userId} to the Standard plan.`
  );
}

function readPlanDetails(
  metadata:
    | Stripe.Metadata
    | null
    | undefined
): PlanDetails {
  const planName: PlanName =
    metadata?.plan_name === "heavy"
      ? "heavy"
      : "standard";

  const expectedLimit =
    planName === "heavy"
      ? 50
      : 10;

  const suppliedLimit =
    Number(
      metadata?.monthly_ai_limit
    );

  const monthlyAiLimit =
    suppliedLimit === expectedLimit
      ? suppliedLimit
      : expectedLimit;

  return {
    planName,
    monthlyAiLimit,
  };
}

async function saveUserPlan(
  supabaseAdmin: any,
  userId: string,
  plan: PlanDetails
) {
  const {
    error,
  } = await supabaseAdmin
    .from("user_ai_plans")
    .upsert(
      {
        user_id: userId,
        plan_name: plan.planName,
        monthly_ai_limit:
          plan.monthlyAiLimit,
      },
      {
        onConflict: "user_id",
      }
    );

  if (error) {
    throw new Error(
      `Supabase plan update failed: ${error.message}`
    );
  }
}