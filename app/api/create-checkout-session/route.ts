import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "../../../lib/supabase/server";

type PlanKey = "standard" | "heavy";

type PlanDetails = {
  name: string;
  description: string;
  annualPriceInCents: number;
  monthlyAiLimit: number;
};

const PLANS: Record<PlanKey, PlanDetails> = {
  standard: {
    name: "Standard Membership",
    description:
      "Annual cruise-planning membership with 10 AI travel-document analyses per month.",
    annualPriceInCents: 3000,
    monthlyAiLimit: 10,
  },

  heavy: {
    name: "Heavy Membership",
    description:
      "Annual cruise-planning membership with 50 AI travel-document analyses per month.",
    annualPriceInCents: 6000,
    monthlyAiLimit: 50,
  },
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripeSecretKey =
    process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    return NextResponse.json(
      {
        error:
          "Stripe has not been configured on the server.",
      },
      {
        status: 500,
      }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      {
        error:
          "You must be signed in before purchasing a membership.",
      },
      {
        status: 401,
      }
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        error:
          "The checkout request could not be read.",
      },
      {
        status: 400,
      }
    );
  }

  const submittedPlan =
    formData.get("plan");

  if (
    submittedPlan !== "standard" &&
    submittedPlan !== "heavy"
  ) {
    return NextResponse.json(
      {
        error:
          "The selected membership plan is invalid.",
      },
      {
        status: 400,
      }
    );
  }

  const planKey: PlanKey =
    submittedPlan;

  const plan =
    PLANS[planKey];

  const requestOrigin =
    request.headers.get("origin");

  const configuredSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL;

  const siteUrl =
    configuredSiteUrl ??
    requestOrigin ??
    "http://localhost:3000";

  const stripe = new Stripe(
    stripeSecretKey
  );

  try {
    const session =
      await stripe.checkout.sessions.create(
        {
          mode: "subscription",

          customer_email:
            user.email ?? undefined,

          client_reference_id:
            user.id,

          success_url:
            `${siteUrl}/dashboard/payment/success` +
            "?session_id={CHECKOUT_SESSION_ID}",

          cancel_url:
            `${siteUrl}/dashboard/payment?canceled=true`,

          line_items: [
            {
              quantity: 1,

              price_data: {
                currency: "usd",

                unit_amount:
                  plan.annualPriceInCents,

                recurring: {
                  interval: "year",
                  interval_count: 1,
                },

                product_data: {
                  name: plan.name,

                  description:
                    plan.description,

                  /*
                   * Stripe tax code:
                   * SaaS — personal use.
                   */
                  tax_code:
                    "txcd_10103000",

                  metadata: {
                    plan_name:
                      planKey,

                    monthly_ai_limit:
                      String(
                        plan.monthlyAiLimit
                      ),
                  },
                },
              },
            },
          ],

          metadata: {
            user_id: user.id,

            plan_name:
              planKey,

            monthly_ai_limit:
              String(
                plan.monthlyAiLimit
              ),
          },

          subscription_data: {
            metadata: {
              user_id: user.id,

              plan_name:
                planKey,

              monthly_ai_limit:
                String(
                  plan.monthlyAiLimit
                ),
            },
          },
        }
      );

    if (!session.url) {
      return NextResponse.json(
        {
          error:
            "Stripe did not return a checkout address.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.redirect(
      session.url,
      {
        status: 303,
      }
    );
  } catch (error) {
    console.error(
      "Stripe Checkout Session creation failed:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Stripe Checkout could not be created.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}