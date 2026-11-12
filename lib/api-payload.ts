import { decode, encode } from "@msgpack/msgpack";

export const MESSAGEPACK_MEDIA_TYPE = "application/msgpack";
const JSON_MEDIA_TYPE = "application/json";

type AcceptedMediaRange = {
  mediaType: string;
  quality: number;
};

function parseAcceptHeader(accept: string): AcceptedMediaRange[] {
  return accept.split(",").map((entry) => {
    const [mediaType = "", ...parameters] = entry.split(";");
    const qualityParameter = parameters.find((parameter) =>
      /^\s*q\s*=/i.test(parameter),
    );
    const qualityValue = qualityParameter?.split("=", 2)[1]?.trim();
    const quality =
      qualityValue === undefined
        ? 1
        : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(qualityValue)
          ? Number(qualityValue)
          : 0;

    return {
      mediaType: mediaType.trim().toLowerCase(),
      quality,
    };
  });
}

function getQuality(
  acceptedMediaRanges: AcceptedMediaRange[],
  mediaType: string,
): number {
  const exactMatch = acceptedMediaRanges.find(
    (range) => range.mediaType === mediaType,
  );
  if (exactMatch) return exactMatch.quality;

  const [type] = mediaType.split("/");
  const typeWildcard = acceptedMediaRanges.find(
    (range) => range.mediaType === `${type}/*`,
  );
  if (typeWildcard) return typeWildcard.quality;

  return (
    acceptedMediaRanges.find((range) => range.mediaType === "*/*")?.quality ??
    0
  );
}

export function acceptsMessagePack(accept: string | null): boolean {
  if (!accept) return false;

  const acceptedMediaRanges = parseAcceptHeader(accept);
  const messagePackRange = acceptedMediaRanges.find(
    (range) => range.mediaType === MESSAGEPACK_MEDIA_TYPE,
  );

  if (!messagePackRange || messagePackRange.quality <= 0) return false;

  return (
    messagePackRange.quality >=
    getQuality(acceptedMediaRanges, JSON_MEDIA_TYPE)
  );
}

function addVaryHeader(headers: Headers, value: string): void {
  const existingHeader = headers.get("Vary");
  const existingValues =
    existingHeader
      ?.split(",")
      .map((header) => header.trim())
      .filter(Boolean) ?? [];
  const normalizedValues = existingValues.map((header) => header.toLowerCase());

  if (
    normalizedValues.includes("*") ||
    normalizedValues.includes(value.toLowerCase())
  ) {
    return;
  }

  headers.set("Vary", [...existingValues, value].join(", "));
}

export function createMessagePackResponse(
  payload: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", MESSAGEPACK_MEDIA_TYPE);
  addVaryHeader(headers, "Accept");

  return new Response(encode(payload), {
    ...init,
    headers,
  });
}

export async function decodeApiResponse(response: Response): Promise<unknown> {
  const contentType = response.headers
    .get("Content-Type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();

  if (contentType === MESSAGEPACK_MEDIA_TYPE) {
    return decode(new Uint8Array(await response.arrayBuffer()));
  }

  if (contentType === JSON_MEDIA_TYPE || contentType?.endsWith("+json")) {
    return response.json();
  }

  throw new Error("Unsupported API response content type.");
}

export function isApiErrorPayload(
  payload: unknown,
): payload is { error: string } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    !Array.isArray(payload) &&
    "error" in payload &&
    typeof payload.error === "string"
  );
}
