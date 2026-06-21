// Meshy text-to-3D generator (no MCP — direct REST API).
// Key resolution: MESHY_API_KEY env var, else the gitignored ./.meshy.key file.
//
// Usage:
//   node scripts/meshy-gen.mjs balance
//   node scripts/meshy-gen.mjs gen "<prompt>" <name> [refine]
//   node scripts/meshy-gen.mjs refine <preview_task_id> <name>
//
// GLBs are saved to public/models/<name>.glb (served by Vite at /models/<name>.glb).
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

async function resolveKey() {
  if (process.env.MESHY_API_KEY) return process.env.MESHY_API_KEY.trim();
  try {
    return (await readFile(new URL("../.meshy.key", import.meta.url), "utf8")).trim();
  } catch {
    console.error("No MESHY_API_KEY env and no .meshy.key file found.");
    process.exit(1);
  }
}

const BASE = "https://api.meshy.ai/openapi";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function balance(headers) {
  const r = await fetch(`${BASE}/v1/balance`, { headers });
  console.log("balance:", r.status, await r.text());
}

async function poll(id, headers) {
  for (let i = 0; i < 180; i += 1) {
    const r = await fetch(`${BASE}/v2/text-to-3d/${id}`, { headers });
    const j = await r.json();
    if (j.status === "SUCCEEDED") return j;
    if (j.status === "FAILED" || j.status === "CANCELED") {
      throw new Error(`task ${j.status}: ${JSON.stringify(j.task_error || j)}`);
    }
    console.log(`  ${id} ${j.status} ${j.progress ?? 0}%`);
    await sleep(5000);
  }
  throw new Error(`timeout polling ${id}`);
}

async function download(task, name, taskId) {
  const glb = task.model_urls?.glb;
  if (!glb) throw new Error(`no glb url: ${JSON.stringify(task.model_urls || task)}`);
  console.log("downloading glb...");
  const gr = await fetch(glb);
  const buf = Buffer.from(await gr.arrayBuffer());
  const outDir = path.resolve("public/models");
  await mkdir(outDir, { recursive: true });
  const out = path.join(outDir, `${name}.glb`);
  await writeFile(out, buf);
  console.log(`saved ${out} (${(buf.length / 1024).toFixed(0)} KB, task ${taskId})`);
}

async function submitPreview(prompt, headers) {
  const r = await fetch(`${BASE}/v2/text-to-3d`, {
    method: "POST",
    headers,
    body: JSON.stringify({ mode: "preview", prompt, art_style: "realistic", should_remesh: true })
  });
  const j = await r.json();
  const id = j.result || j.id;
  if (!id) throw new Error(`no preview id (status ${r.status}): ${JSON.stringify(j)}`);
  return id;
}

async function submitRefine(previewId, headers) {
  const r = await fetch(`${BASE}/v2/text-to-3d`, {
    method: "POST",
    headers,
    body: JSON.stringify({ mode: "refine", preview_task_id: previewId, enable_pbr: true })
  });
  const j = await r.json();
  const id = j.result || j.id;
  if (!id) throw new Error(`no refine id (status ${r.status}): ${JSON.stringify(j)}`);
  return id;
}

async function gen(prompt, name, refine, headers) {
  if (!prompt || !name) {
    console.error('usage: gen "<prompt>" <name> [refine]');
    process.exit(1);
  }
  console.log("preview submit:", name);
  const previewId = await submitPreview(prompt, headers);
  console.log("preview id:", previewId);
  let task = await poll(previewId, headers);
  let finalId = previewId;
  if (refine) {
    console.log("refine submit (PBR textures)...");
    const refineId = await submitRefine(previewId, headers);
    console.log("refine id:", refineId);
    task = await poll(refineId, headers);
    finalId = refineId;
  }
  await download(task, name, finalId);
}

async function refineOnly(previewId, name, headers) {
  if (!previewId || !name) {
    console.error("usage: refine <preview_task_id> <name>");
    process.exit(1);
  }
  console.log("refine submit (PBR textures) for", previewId);
  const refineId = await submitRefine(previewId, headers);
  console.log("refine id:", refineId);
  const task = await poll(refineId, headers);
  await download(task, name, refineId);
}

const key = await resolveKey();
const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "balance") await balance(headers);
else if (cmd === "gen") await gen(rest[0], rest[1], rest[2] === "refine", headers);
else if (cmd === "refine") await refineOnly(rest[0], rest[1], headers);
else {
  console.error('usage: balance | gen "<prompt>" <name> [refine] | refine <preview_task_id> <name>');
  process.exit(1);
}
