import { parse } from "csv-parse/sync";

/**
 * Parse a CSV or plain-text file for bulk login.
 * Accepts:
 *   phone,password   (CSV)
 *   phone            (single column or bare lines)
 *
 * Returns array of { phone, password? }
 */
export function parseBulkFile(content, filename = "") {
  const ext = filename.split(".").pop().toLowerCase();
  const rows = [];

  if (ext === "csv") {
    let records;
    try {
      records = parse(content, { skip_empty_lines: true, trim: true });
    } catch {
      // Fallback: treat as plain text
      records = content
        .split("\n")
        .map((l) => l.split(",").map((v) => v.trim()))
        .filter((r) => r[0]);
    }

    for (const record of records) {
      const phone = record[0]?.trim();
      const password = record[1]?.trim() || null;
      if (phone) rows.push({ phone, password });
    }
  } else {
    // Plain text: one entry per line
    const lines = content.split("\n");
    for (const line of lines) {
      const parts = line.trim().split(/[,\t]+/);
      const phone = parts[0]?.trim();
      const password = parts[1]?.trim() || null;
      if (phone) rows.push({ phone, password });
    }
  }

  return rows;
}
