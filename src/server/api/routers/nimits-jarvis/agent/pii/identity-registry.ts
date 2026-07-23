/**
 * Identity Registry — Loads identity.yaml and provides exact string matching
 * for known personal identifiers (names, emails, phones, locations, etc.).
 *
 * This is Layer 1 of the PII pipeline: deterministic, <1ms latency.
 * Falls back gracefully if identity.yaml is missing or malformed.
 *
 * Usage:
 *   const registry = IdentityRegistry.getInstance();
 *   const matches = registry.getExactMatches();
 *   // matches: [{ literal: "Nimit Shah", category: "NAME" }, ...]
 */

import fs from "fs";
import path from "path";
import * as yaml from "js-yaml";

export interface IdentityConfig {
  direct_identifiers?: {
    names?: string[];
    emails?: string[];
    phones?: string[];
    locations?: Record<string, unknown>;
  };
  government_ids?: {
    aadhaar_numbers?: (string | number)[];
    pan_cards?: string[];
    passport_numbers?: string[];
    driving_licenses?: string[];
  };
  financial?: {
    bank_account_numbers?: (string | number)[];
    card_numbers?: (string | number)[];
  };
  assets?: {
    vehicles?: string[];
    projects?: string[];
  };
  technical_secrets?: {
    api_keys?: string[];
    internal_ips?: string[];
    auth_tokens?: string[];
  };
}

export interface ExactMatch {
  literal: string;
  category: string;
}

export class IdentityRegistry {
  private static instance: IdentityRegistry | null = null;
  private config: IdentityConfig | null = null;
  private matches: ExactMatch[] | null = null;

  private constructor() {
    this.loadConfig();
  }

  public static getInstance(): IdentityRegistry {
    if (!IdentityRegistry.instance) {
      IdentityRegistry.instance = new IdentityRegistry();
    }
    return IdentityRegistry.instance;
  }

  /** Reset singleton (for testing). */
  public static reset(): void {
    IdentityRegistry.instance = null;
  }

  private loadConfig(): void {
    try {
      const configPath = path.resolve(process.cwd(), "identity.yaml");
      if (fs.existsSync(configPath)) {
        const fileContents = fs.readFileSync(configPath, "utf8");
        this.config = yaml.load(fileContents) as IdentityConfig;
      }
      // Missing file is not an error — just means no identity matching
    } catch (err) {
      console.warn("[IdentityRegistry] Error reading identity.yaml:", err);
    }
  }

  /** Recursively extract string values from nested objects or arrays */
  private extractStrings(val: unknown): string[] {
    if (val === null || val === undefined) return [];
    if (typeof val === "string") return [val];
    if (typeof val === "number") return [String(val)];
    if (Array.isArray(val)) {
      return val.flatMap((item) => this.extractStrings(item));
    }
    if (typeof val === "object") {
      return Object.values(val as Record<string, unknown>).flatMap((item) =>
        this.extractStrings(item),
      );
    }
    return [];
  }

  /**
   * Returns all known PII literals sorted by length descending.
   * Longer strings match first to prevent substring corruption
   * (e.g., "Nimit Shah" before "Nimit").
   */
  public getExactMatches(): ExactMatch[] {
    if (this.matches) return this.matches;

    if (!this.config) {
      this.matches = [];
      return this.matches;
    }

    const matches: ExactMatch[] = [];
    const {
      direct_identifiers,
      government_ids,
      financial,
      assets,
      technical_secrets,
    } = this.config;

    direct_identifiers?.names?.forEach((n) =>
      matches.push({ literal: String(n), category: "NAME" }),
    );
    direct_identifiers?.emails?.forEach((e) =>
      matches.push({ literal: String(e), category: "EMAIL" }),
    );
    direct_identifiers?.phones?.forEach((p) =>
      matches.push({ literal: String(p), category: "PHONE" }),
    );

    if (direct_identifiers?.locations) {
      this.extractStrings(direct_identifiers.locations).forEach((loc) =>
        matches.push({ literal: loc, category: "LOCATION" }),
      );
    }

    if (government_ids) {
      Object.values(government_ids).forEach((val) => {
        this.extractStrings(val).forEach((id) =>
          matches.push({ literal: id, category: "GOV_ID" }),
        );
      });
    }

    if (financial) {
      financial.bank_account_numbers?.forEach((b) =>
        matches.push({ literal: String(b), category: "ACCOUNT" }),
      );
      financial.card_numbers?.forEach((c) =>
        matches.push({ literal: String(c), category: "CARD" }),
      );
    }

    if (assets) {
      assets.vehicles?.forEach((v) =>
        matches.push({ literal: String(v), category: "VEHICLE" }),
      );
      assets.projects?.forEach((proj) =>
        matches.push({ literal: String(proj), category: "PROJECT" }),
      );
    }

    if (technical_secrets) {
      technical_secrets.api_keys?.forEach((k) =>
        matches.push({ literal: String(k), category: "API_KEY" }),
      );
      technical_secrets.auth_tokens?.forEach((t) =>
        matches.push({ literal: String(t), category: "API_KEY" }),
      );
      technical_secrets.internal_ips?.forEach((ip) =>
        matches.push({ literal: String(ip), category: "IP_ADDRESS" }),
      );
    }

    // Sort by string length descending so longer phrases match first
    this.matches = matches
      .filter(
        (m) =>
          m.literal &&
          typeof m.literal === "string" &&
          m.literal.trim().length > 0,
      )
      .sort((a, b) => b.literal.length - a.literal.length);

    return this.matches;
  }
}
