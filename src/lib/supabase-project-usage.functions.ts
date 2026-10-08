import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAuthorizedUserId } from "@/lib/single-user";

type JsonObject = Record<string, unknown>;

type ApiResult<T> = {
  data: T | null;
  error: string | null;
};

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function errorMessage(status: number) {
  if (status === 401 || status === 403) {
    return "Supabase rejected the token or its read permissions. Check the token's project scopes.";
  }
  if (status === 404) return "This Supabase metric is not available for the current project.";
  if (status === 429) return "Supabase rate-limited this request. Try again shortly.";
  return `Supabase could not provide this metric (HTTP ${status}).`;
}

async function requestManagementApi<T>(
  token: string,
  projectRef: string,
  path: string,
  parse: (value: unknown) => T | null,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return { data: null, error: "Could not connect to the Supabase Management API." };
  }

  if (!response.ok) return { data: null, error: errorMessage(response.status) };

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { data: null, error: "Supabase returned an unreadable response for this metric." };
  }

  const data = parse(payload);
  if (data === null) {
    return { data: null, error: "Supabase returned an unexpected response for this metric." };
  }
  return { data, error: null };
}

function parseDiskUtilization(value: unknown) {
  if (!isJsonObject(value) || !isJsonObject(value["metrics"])) return null;
  const sizeBytes = numberValue(value["metrics"]["fs_size_bytes"]);
  const availableBytes = numberValue(value["metrics"]["fs_avail_bytes"]);
  const usedBytes = numberValue(value["metrics"]["fs_used_bytes"]);
  if (sizeBytes === null || availableBytes === null || usedBytes === null) return null;
  return {
    sizeBytes,
    availableBytes,
    usedBytes,
    timestamp: typeof value["timestamp"] === "string" ? value["timestamp"] : null,
  };
}

function parseDiskConfig(value: unknown) {
  if (!isJsonObject(value) || !isJsonObject(value["attributes"])) return null;
  return numberValue(value["attributes"]["size_gb"]);
}

function parseStorageBuckets(value: unknown) {
  if (!Array.isArray(value)) return null;
  return value.flatMap((bucket) => {
    if (!isJsonObject(bucket) || typeof bucket["name"] !== "string") return [];
    return [
      {
        name: bucket["name"],
        isPublic: bucket["public"] === true,
      },
    ];
  });
}

export const getSupabaseProjectUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!isAuthorizedUserId(context.userId)) {
      throw new Error(
        "Unauthorized: this Supabase overview is only available to the authorized user.",
      );
    }

    const token = process.env["SUPABASE_ACCESS_TOKEN"];
    const supabaseUrl = process.env["SUPABASE_URL"];
    if (!token) {
      return {
        configured: false,
        disk: {
          utilization: null,
          utilizationError: null,
          allocatedGb: null,
          configError: null,
        },
        buckets: { items: null, error: null },
        egressAvailable: false,
        setupError: "Add SUPABASE_ACCESS_TOKEN to the server environment and redeploy.",
      };
    }
    if (!supabaseUrl) {
      throw new Error("Missing Supabase environment variable: SUPABASE_URL.");
    }

    let projectRef: string;
    try {
      projectRef = new URL(supabaseUrl).hostname.split(".")[0] ?? "";
    } catch {
      throw new Error("SUPABASE_URL is not a valid URL.");
    }
    if (!/^[a-z0-9]{20}$/.test(projectRef)) {
      throw new Error("Could not determine a valid Supabase project reference from SUPABASE_URL.");
    }

    const [diskUtilization, diskConfig, buckets] = await Promise.all([
      requestManagementApi(token, projectRef, "/config/disk/util", parseDiskUtilization),
      requestManagementApi(token, projectRef, "/config/disk", parseDiskConfig),
      requestManagementApi(token, projectRef, "/storage/buckets", parseStorageBuckets),
    ]);

    return {
      configured: true,
      disk: {
        utilization: diskUtilization.data,
        utilizationError: diskUtilization.error,
        allocatedGb: diskConfig.data,
        configError: diskConfig.error,
      },
      buckets: {
        items: buckets.data,
        error: buckets.error,
      },
      egressAvailable: false,
      egressMessage:
        "The Management API does not expose billed egress quota remaining for this project. Check the organization Usage page in Supabase.",
    };
  });
