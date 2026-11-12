/**
 * JSON vs MessagePack Benchmark
 *
 * Compares encode/decode speed and payload size for realistic
 * JobSearchResponse payloads at various scales.
 *
 * Run: npx tsx scripts/bench-json-vs-msgpack.ts
 */

import { encode, decode } from "@msgpack/msgpack";

// ── Generate realistic job data ──────────────────────────────────────

function makeJob(i: number) {
  return {
    provider: ["ashbyhq", "greenhouse", "lever", "workable"][i % 4],
    company_slug: `company-${i}`,
    job_id: `job-${i}-${Math.random().toString(36).slice(2, 10)}`,
    title: `Senior Software Engineer ${i} — Full Stack (React / Node.js)`,
    company_name: `TechCorp ${i} Inc.`,
    location_name: i % 3 === 0 ? "Remote (United States)" : `San Francisco, CA ${i}`,
    details_url: `https://boards.greenhouse.io/company${i}/jobs/${10000 + i}`,
    apply_url: `https://boards.greenhouse.io/company${i}/jobs/${10000 + i}/apply`,
    first_published: `2024-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`,
    employment_type: ["full-time", "part-time", "contract", "internship"][i % 4],
    workplace_type: ["remote", "hybrid", "onsite"][i % 3],
    description: `We are looking for a talented engineer to join our team. `.repeat(20) +
      `Requirements: ${i} years of experience. ` +
      `Skills: TypeScript, React, Node.js, PostgreSQL, AWS. `.repeat(5),
    is_bookmarked: 0,
    is_available: 1,
  };
}

function makeResponse(jobCount: number) {
  return {
    jobs: Array.from({ length: jobCount }, (_, i) => makeJob(i)),
    total: 173120,
    page: 1,
    pageSize: jobCount,
    totalPages: Math.ceil(173120 / jobCount),
  };
}

// ── Benchmark helpers ────────────────────────────────────────────────

function benchEncode(label: string, payload: unknown, iterations: number) {
  // JSON encode
  const jsonTimes: number[] = [];
  let jsonBytes = 0;
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = JSON.stringify(payload);
    jsonTimes.push(performance.now() - start);
    if (i === 0) jsonBytes = new TextEncoder().encode(result).byteLength;
  }

  // MessagePack encode
  const msgpackTimes: number[] = [];
  let msgpackBytes = 0;
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = encode(payload);
    msgpackTimes.push(performance.now() - start);
    if (i === 0) msgpackBytes = result.byteLength;
  }

  return { label, jsonTimes, msgpackTimes, jsonBytes, msgpackBytes };
}

function benchDecode(label: string, payload: unknown, iterations: number) {
  const jsonStr = JSON.stringify(payload);
  const msgpackBuf = encode(payload);

  // JSON decode
  const jsonTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    JSON.parse(jsonStr);
    jsonTimes.push(performance.now() - start);
  }

  // MessagePack decode
  const msgpackTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    decode(msgpackBuf);
    msgpackTimes.push(performance.now() - start);
  }

  return { label, jsonTimes, msgpackTimes };
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function p95(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ── Run benchmarks ───────────────────────────────────────────────────

const ITERATIONS = 500;

const scenarios = [
  { label: "1 job (single detail)", count: 1 },
  { label: "5 jobs (small page)", count: 5 },
  { label: "20 jobs (standard page)", count: 20 },
  { label: "50 jobs (large page)", count: 50 },
  { label: "100 jobs (prefetch burst)", count: 100 },
];

console.log("═══════════════════════════════════════════════════════════════");
console.log("  JSON vs MessagePack Benchmark");
console.log(`  ${ITERATIONS} iterations per scenario`);
console.log("═══════════════════════════════════════════════════════════════\n");

// ── Payload size comparison ──────────────────────────────────────────

console.log("── PAYLOAD SIZE ────────────────────────────────────────────\n");
console.log(
  "Scenario".padEnd(30) +
  "JSON".padStart(12) +
  "MsgPack".padStart(12) +
  "Savings".padStart(10) +
  "Ratio".padStart(8)
);
console.log("─".repeat(72));

for (const { label, count } of scenarios) {
  const payload = makeResponse(count);
  const jsonSize = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  const msgpackSize = encode(payload).byteLength;
  const savings = ((1 - msgpackSize / jsonSize) * 100).toFixed(1);
  const ratio = (jsonSize / msgpackSize).toFixed(2);
  console.log(
    label.padEnd(30) +
    formatBytes(jsonSize).padStart(12) +
    formatBytes(msgpackSize).padStart(12) +
    `${savings}%`.padStart(10) +
    `${ratio}x`.padStart(8)
  );
}

// ── Encode benchmark ─────────────────────────────────────────────────

console.log("\n── ENCODE SPEED (median ms) ────────────────────────────────\n");
console.log(
  "Scenario".padEnd(30) +
  "JSON".padStart(10) +
  "MsgPack".padStart(10) +
  "Winner".padStart(12) +
  "Factor".padStart(10)
);
console.log("─".repeat(72));

for (const { label, count } of scenarios) {
  const payload = makeResponse(count);

  // Warmup
  for (let i = 0; i < 50; i++) {
    JSON.stringify(payload);
    encode(payload);
  }

  const result = benchEncode(label, payload, ITERATIONS);
  const jsonMed = median(result.jsonTimes);
  const msgMed = median(result.msgpackTimes);
  const winner = jsonMed < msgMed ? "JSON" : "MsgPack";
  const factor = jsonMed < msgMed
    ? (msgMed / jsonMed).toFixed(2)
    : (jsonMed / msgMed).toFixed(2);

  console.log(
    label.padEnd(30) +
    jsonMed.toFixed(3).padStart(10) +
    msgMed.toFixed(3).padStart(10) +
    winner.padStart(12) +
    `${factor}x`.padStart(10)
  );
}

// ── Decode benchmark ─────────────────────────────────────────────────

console.log("\n── DECODE SPEED (median ms) ────────────────────────────────\n");
console.log(
  "Scenario".padEnd(30) +
  "JSON".padStart(10) +
  "MsgPack".padStart(10) +
  "Winner".padStart(12) +
  "Factor".padStart(10)
);
console.log("─".repeat(72));

for (const { label, count } of scenarios) {
  const payload = makeResponse(count);

  // Warmup
  const warmupJson = JSON.stringify(payload);
  const warmupMsgpack = encode(payload);
  for (let i = 0; i < 50; i++) {
    JSON.parse(warmupJson);
    decode(warmupMsgpack);
  }

  const result = benchDecode(label, payload, ITERATIONS);
  const jsonMed = median(result.jsonTimes);
  const msgMed = median(result.msgpackTimes);
  const winner = jsonMed < msgMed ? "JSON" : "MsgPack";
  const factor = jsonMed < msgMed
    ? (msgMed / jsonMed).toFixed(2)
    : (jsonMed / msgMed).toFixed(2);

  console.log(
    label.padEnd(30) +
    jsonMed.toFixed(3).padStart(10) +
    msgMed.toFixed(3).padStart(10) +
    winner.padStart(12) +
    `${factor}x`.padStart(10)
  );
}

// ── Round-trip (encode + decode) ─────────────────────────────────────

console.log("\n── ROUND-TRIP SPEED (median ms) ────────────────────────────\n");
console.log(
  "Scenario".padEnd(30) +
  "JSON".padStart(10) +
  "MsgPack".padStart(10) +
  "Winner".padStart(12) +
  "Factor".padStart(10)
);
console.log("─".repeat(72));

for (const { label, count } of scenarios) {
  const payload = makeResponse(count);

  // Warmup
  for (let i = 0; i < 50; i++) {
    JSON.parse(JSON.stringify(payload));
    decode(encode(payload));
  }

  const jsonRoundTrips: number[] = [];
  const msgRoundTrips: number[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    let start = performance.now();
    JSON.parse(JSON.stringify(payload));
    jsonRoundTrips.push(performance.now() - start);

    start = performance.now();
    decode(encode(payload));
    msgRoundTrips.push(performance.now() - start);
  }

  const jsonMed = median(jsonRoundTrips);
  const msgMed = median(msgRoundTrips);
  const winner = jsonMed < msgMed ? "JSON" : "MsgPack";
  const factor = jsonMed < msgMed
    ? (msgMed / jsonMed).toFixed(2)
    : (jsonMed / msgMed).toFixed(2);

  console.log(
    label.padEnd(30) +
    jsonMed.toFixed(3).padStart(10) +
    msgMed.toFixed(3).padStart(10) +
    winner.padStart(12) +
    `${factor}x`.padStart(10)
  );
}

// ── P95 latency comparison for 20-job page ───────────────────────────

console.log("\n── P95 LATENCY: 20-JOB PAGE (ms) ──────────────────────────\n");
const stdPayload = makeResponse(20);

// Extended run for P95
const extIter = 1000;

// Warmup
for (let i = 0; i < 100; i++) {
  JSON.parse(JSON.stringify(stdPayload));
  decode(encode(stdPayload));
}

const encResult = benchEncode("encode", stdPayload, extIter);
const decResult = benchDecode("decode", stdPayload, extIter);

console.log(`  Encode — JSON p95: ${p95(encResult.jsonTimes).toFixed(3)} ms, MsgPack p95: ${p95(encResult.msgpackTimes).toFixed(3)} ms`);
console.log(`  Decode — JSON p95: ${p95(decResult.jsonTimes).toFixed(3)} ms, MsgPack p95: ${p95(decResult.msgpackTimes).toFixed(3)} ms`);

console.log("\n═══════════════════════════════════════════════════════════════\n");
