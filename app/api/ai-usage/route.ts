import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";

const STANDARD_MONTHLY_LIMIT = 10;
const HEAVY_MONTHLY_LIMIT = 50;

type AiPlanName = "standard" | "heavy";

type UserAiPlan = {
  plan_name: AiPlanName;
  monthly_ai_limit: number;
};

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "You must be signed in.",
        },
        {
          status: 401,
        }
      );
    }

    const plan = await getUserPlan(
      supabase,
      user.id
    );

    const monthStart =
      getCurrentMonthStart();

    const nextMonthStart =
      getNextMonthStart();

    const {
      count,
      error: usageError,
    } = await supabase
      .from("ai_usage")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("user_id", user.id)
      .eq("status", "successful")
      .gte("created_at", monthStart)
      .lt(
        "created_at",
        nextMonthStart
      );

    if (usageError) {
      console.error(
        "AI usage could not be loaded:",
        usageError
      );

      return NextResponse.json(
        {
          error:
            "Your AI allowance could not be loaded.",
        },
        {
          status: 500,
        }
      );
    }

    const used = Math.min(
      count ?? 0,
      plan.monthly_ai_limit
    );

    const remaining = Math.max(
      plan.monthly_ai_limit - used,
      0
    );

    return NextResponse.json({
      success: true,

      usage: {
        plan: plan.plan_name,
        used,
        limit:
          plan.monthly_ai_limit,
        remaining,
        resets_at:
          nextMonthStart,
      },
    });
  } catch (error) {
    console.error(
      "AI usage request failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The AI allowance could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}

async function getUserPlan(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  userId: string
): Promise<UserAiPlan> {
  const defaultPlan: UserAiPlan = {
    plan_name: "standard",
    monthly_ai_limit:
      STANDARD_MONTHLY_LIMIT,
  };

  const {
    data: existingPlan,
    error: readError,
  } = await supabase
    .from("user_ai_plans")
    .select(
      "plan_name, monthly_ai_limit"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    console.error(
      "AI plan lookup failed. Using Standard plan:",
      readError
    );

    return defaultPlan;
  }

  if (existingPlan) {
    return normalizePlan(
      existingPlan
    );
  }

  const {
    data: createdPlan,
    error: createError,
  } = await supabase
    .from("user_ai_plans")
    .insert({
      user_id: userId,
      plan_name: "standard",
      monthly_ai_limit:
        STANDARD_MONTHLY_LIMIT,
    })
    .select(
      "plan_name, monthly_ai_limit"
    )
    .single();

  if (
    createError ||
    !createdPlan
  ) {
    console.error(
      "Standard AI plan could not be created. Using default:",
      createError
    );

    return defaultPlan;
  }

  return normalizePlan(
    createdPlan
  );
}

function normalizePlan(
  plan: {
    plan_name: string;
    monthly_ai_limit:
      number | null;
  }
): UserAiPlan {
  const planName: AiPlanName =
    plan.plan_name === "heavy"
      ? "heavy"
      : "standard";

  const fallbackLimit =
    planName === "heavy"
      ? HEAVY_MONTHLY_LIMIT
      : STANDARD_MONTHLY_LIMIT;

  const databaseLimit = Number(
    plan.monthly_ai_limit
  );

  return {
    plan_name: planName,

    monthly_ai_limit:
      Number.isInteger(
        databaseLimit
      ) &&
      databaseLimit >= 0
        ? databaseLimit
        : fallbackLimit,
  };
}

function getCurrentMonthStart() {
  const now = new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1,
      0,
      0,
      0,
      0
    )
  ).toISOString();
}

function getNextMonthStart() {
  const now = new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      1,
      0,
      0,
      0,
      0
    )
  ).toISOString();
}