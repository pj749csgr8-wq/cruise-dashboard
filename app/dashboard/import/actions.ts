"use server";

import * as XLSX from "xlsx";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "../../../lib/supabase/server";

type SpreadsheetRow = Record<string, string>;

type CruiseInsert = {
  user_id: string;
  cruise_line: string;
  sailing_from: string | null;
  ship_name: string;
  departure_date: string;
  booking_number: string | null;
  total_cost: number | null;
  notes: string | null;
  duration_nights: number | null;
  drink_package: boolean;
  wifi_package: boolean;
  paid_off: boolean;
  booking_status: string;
};

export async function importCruises(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const uploadedFile = formData.get("spreadsheet");

  if (!(uploadedFile instanceof File) || uploadedFile.size === 0) {
    throw new Error("Select an Excel spreadsheet to import.");
  }

  const validExtensions = [".xlsx", ".xls"];
  const lowerFileName = uploadedFile.name.toLowerCase();

  if (!validExtensions.some((extension) => lowerFileName.endsWith(extension))) {
    throw new Error("The uploaded file must be an Excel .xlsx or .xls file.");
  }

  const arrayBuffer = await uploadedFile.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: true,
  });

  const requestedSheetName = workbook.SheetNames.find(
    (sheetName) =>
      normalizeText(sheetName) === normalizeText("Form Responses 1")
  );

  const sheetName = requestedSheetName ?? workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("The spreadsheet does not contain any worksheets.");
  }

  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error("The spreadsheet worksheet could not be read.");
  }

  /*
   * raw: false returns the displayed spreadsheet values. This helps preserve
   * booking numbers that Excel may otherwise expose in scientific notation.
   */
  const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(worksheet, {
    defval: "",
    raw: false,
  });

  const cleanedCruises: CruiseInsert[] = [];

  for (const originalRow of rows) {
    const row = normalizeRowKeys(originalRow);

    const cruiseLine = cleanCruiseLine(
      findColumn(row, ["cruise line", "cruiseline", "line"])
    );

    const sailingFrom = cleanPort(
      findColumn(row, [
        "sailing from",
        "sailingfrom",
        "departure port",
        "port",
      ])
    );

    const shipName = titleCase(
      findColumn(row, ["ship", "ship name", "shipname"])
    );

    const departureDate = parseSpreadsheetDate(
      findColumn(row, ["date", "departure date", "sailing date"])
    );

    const bookingNumber = cleanBookingNumber(
      findColumn(row, [
        "booking #",
        "booking number",
        "booking no",
        "booking",
      ])
    );

    const totalCost = parseMoney(
      findColumn(row, ["cost", "total cost", "price"])
    );

    const notes = cleanWhitespace(
      findColumn(row, ["notes", "notes?", "note"])
    );

    const durationNights = parseWholeNumber(
      findColumn(row, [
        "length",
        "length?",
        "nights",
        "duration",
        "duration nights",
      ])
    );

    if (!cruiseLine && !shipName && !departureDate) {
      continue;
    }

    if (!cruiseLine || !shipName || !departureDate) {
      continue;
    }

    const noteText = notes.toLowerCase();

    const cancelled =
      noteText.includes("cancelled") ||
      noteText.includes("canceled");

    const balanceRemaining =
      noteText.includes("still owe") ||
      noteText.includes("still owed") ||
      noteText.includes("owe ") ||
      noteText.includes("owed ") ||
      noteText.includes("balance");

    const paidOff =
      !cancelled &&
      !balanceRemaining &&
      (
        noteText.includes("paid off") ||
        noteText.includes("paid in full") ||
        noteText.includes("fully paid")
      );

    cleanedCruises.push({
      user_id: user.id,
      cruise_line: cruiseLine,
      sailing_from: sailingFrom || null,
      ship_name: shipName,
      departure_date: departureDate,
      booking_number: bookingNumber || null,
      total_cost: totalCost,
      notes: notes || null,
      duration_nights: durationNights,
      drink_package: false,
      wifi_package: false,
      paid_off: paidOff,
      booking_status: cancelled ? "Cancelled" : "Booked",
    });
  }

  if (cleanedCruises.length === 0) {
    throw new Error(
      "No usable cruise rows were found. Confirm that the spreadsheet contains Cruise Line, Ship and Date columns."
    );
  }

  const { data: existingCruises, error: existingError } = await supabase
    .from("cruises")
    .select(
      "cruise_line, ship_name, departure_date, booking_number"
    );

  if (existingError) {
    throw new Error(
      `Unable to check existing cruises: ${existingError.message}`
    );
  }

  const existingKeys = new Set(
    (existingCruises ?? []).map((cruise) =>
      createDuplicateKey({
        cruise_line: cruise.cruise_line,
        ship_name: cruise.ship_name,
        departure_date: cruise.departure_date,
        booking_number: cruise.booking_number,
      })
    )
  );

  const spreadsheetKeys = new Set<string>();
  const cruisesToInsert: CruiseInsert[] = [];
  let skippedDuplicates = 0;

  for (const cruise of cleanedCruises) {
    const duplicateKey = createDuplicateKey(cruise);

    if (
      existingKeys.has(duplicateKey) ||
      spreadsheetKeys.has(duplicateKey)
    ) {
      skippedDuplicates += 1;
      continue;
    }

    spreadsheetKeys.add(duplicateKey);
    cruisesToInsert.push(cruise);
  }

  if (cruisesToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("cruises")
      .insert(cruisesToInsert);

    if (insertError) {
      throw new Error(
        `Unable to import cruises: ${insertError.message}`
      );
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/import");

  redirect(
    `/dashboard/import?imported=${cruisesToInsert.length}&skipped=${skippedDuplicates}`
  );
}

function normalizeRowKeys(row: SpreadsheetRow) {
  const normalized: SpreadsheetRow = {};

  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeText(key)] = String(value ?? "").trim();
  }

  return normalized;
}

function findColumn(
  row: SpreadsheetRow,
  possibleNames: string[]
) {
  for (const name of possibleNames) {
    const value = row[normalizeText(name)];

    if (value !== undefined && value !== "") {
      return value;
    }
  }

  return "";
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[\n\r]+/g, " ")
    .replace(/[?"']/g, "")
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanWhitespace(value: string) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanBookingNumber(value: string) {
  const cleaned = cleanWhitespace(value);

  if (!cleaned) {
    return "";
  }

  /*
   * Remove trailing .0 from booking numbers Excel interpreted as numbers.
   * Booking numbers otherwise remain text.
   */
  return cleaned.replace(/\.0+$/, "");
}

function cleanCruiseLine(value: string) {
  const cleaned = titleCase(value);

  const knownLines: Record<string, string> = {
    "Ncl": "Norwegian Cruise Line",
    "Norwegian": "Norwegian Cruise Line",
    "Norwegian Cruise Lines": "Norwegian Cruise Line",
    "Royal Caribbean International": "Royal Caribbean",
    "Rcl": "Royal Caribbean",
    "Carnival Cruise Lines": "Carnival Cruise Line",
    "Msc": "MSC Cruises",
    "Msc Cruises": "MSC Cruises",
  };

  return knownLines[cleaned] ?? cleaned;
}

function cleanPort(value: string) {
  const cleaned = titleCase(value);

  const corrections: Record<string, string> = {
    "Galvenston": "Galveston",
    "Galvenston, Texas": "Galveston, Texas",
    "Ft Lauderdale": "Fort Lauderdale",
    "Ft. Lauderdale": "Fort Lauderdale",
    "Port Canaveral Fl": "Port Canaveral, Florida",
    "Miami Fl": "Miami, Florida",
  };

  return corrections[cleaned] ?? cleaned;
}

function titleCase(value: string) {
  const cleaned = cleanWhitespace(value).toLowerCase();

  if (!cleaned) {
    return "";
  }

  const specialWords: Record<string, string> = {
    msc: "MSC",
    ncl: "NCL",
    usa: "USA",
    us: "US",
  };

  return cleaned
    .split(" ")
    .map((word) => specialWords[word] ?? capitalize(word))
    .join(" ");
}

function capitalize(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseMoney(value: string) {
  const cleaned = cleanWhitespace(value)
    .replace(/[$,]/g, "")
    .replace(/[^\d.-]/g, "");

  if (!cleaned) {
    return null;
  }

  const numberValue = Number(cleaned);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseWholeNumber(value: string) {
  const match = cleanWhitespace(value).match(/\d+/);

  if (!match) {
    return null;
  }

  const numberValue = Number(match[0]);

  return Number.isInteger(numberValue) && numberValue > 0
    ? numberValue
    : null;
}

function parseSpreadsheetDate(value: string) {
  const cleaned = cleanWhitespace(value);

  if (!cleaned) {
    return "";
  }

  const numericValue = Number(cleaned);

  /*
   * Excel date serials are normally numbers greater than roughly 20,000.
   */
  if (Number.isFinite(numericValue) && numericValue > 20000) {
    const parsed = XLSX.SSF.parse_date_code(numericValue);

    if (parsed) {
      return formatDatabaseDate(
        new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
      );
    }
  }

  const slashDate = cleaned.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/
  );

  if (slashDate) {
    const month = Number(slashDate[1]);
    const day = Number(slashDate[2]);
    let year = Number(slashDate[3]);

    if (year < 100) {
      year += year >= 70 ? 1900 : 2000;
    }

    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    if (!Number.isNaN(parsedDate.getTime())) {
      return formatDatabaseDate(parsedDate);
    }
  }

  const parsedDate = new Date(cleaned);

  if (!Number.isNaN(parsedDate.getTime())) {
    return formatDatabaseDate(parsedDate);
  }

  return "";
}

function formatDatabaseDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createDuplicateKey(cruise: {
  cruise_line: string;
  ship_name: string;
  departure_date: string;
  booking_number: string | null;
}) {
  const bookingNumber = normalizeText(
    cruise.booking_number ?? ""
  );

  /*
   * Prefer the booking number when available, while retaining cruise details
   * so booking-number reuse by different cruise lines does not collide.
   */
  return [
    normalizeText(cruise.cruise_line),
    normalizeText(cruise.ship_name),
    cruise.departure_date,
    bookingNumber,
  ].join("|");
}