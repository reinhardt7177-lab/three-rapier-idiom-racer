import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = join(ROOT, "public", "models", "vehicles");
const MANIFEST_PATH = join(OUTPUT_DIR, "manifest.json");
const API_ROOT = "https://api.meshy.ai/openapi/v2";

const VEHICLES = [
  {
    id: "snowbug",
    displayName: "현대 아반떼 N",
    prompt: "Realistic game-ready 3D exterior of a modern Hyundai Avante N performance sedan (also known as Elantra N), factory proportions, four doors, aggressive front fascia, rear spoiler, detailed separate-looking tires and alloy rims, clean PBR materials, centered on level ground, front facing positive Z, complete closed body, no interior, no logos, no brand badges, no text, no environment"
  },
  {
    id: "trailfox",
    displayName: "BMW M3",
    prompt: "Realistic game-ready 3D exterior of a modern BMW M3 performance sedan, athletic wide fenders, four doors, long hood, subtle trunk spoiler, detailed separate-looking tires and alloy rims, clean PBR materials, centered on level ground, front facing positive Z, complete closed body, no interior, no logos, no brand badges, no text, no environment"
  },
  {
    id: "snowcat",
    displayName: "벤츠 SLK 55 AMG",
    prompt: "Realistic game-ready 3D exterior of a Mercedes SLK 55 AMG compact two-seat hardtop roadster, roof closed, short rear deck, muscular sports proportions, detailed separate-looking tires and alloy rims, clean PBR materials, centered on level ground, front facing positive Z, complete closed body, no interior, no logos, no brand badges, no text, no environment"
  },
  {
    id: "ridgegt",
    displayName: "어울림 스피라 EX",
    prompt: "Realistic game-ready 3D exterior of an Oullim Spirra EX Korean mid-engine supercar, low wedge profile, wide rear haunches, two-door coupe, rear wing, detailed separate-looking tires and alloy rims, clean PBR materials, centered on level ground, front facing positive Z, complete closed body, no interior, no logos, no brand badges, no text, no environment"
  },
  {
    id: "aurora",
    displayName: "포르쉐 911 터보 S",
    prompt: "Realistic game-ready 3D exterior of a modern Porsche 911 Turbo S sports coupe, iconic rear-engine silhouette, wide rear fenders, active rear spoiler raised slightly, detailed separate-looking tires and alloy rims, clean PBR materials, centered on level ground, front facing positive Z, complete closed body, no interior, no logos, no brand badges, no text, no environment"
  }
];

async function loadLocalEnv() {
  try {
    const source = await readFile(join(ROOT, ".env.local"), "utf8");
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['\"]|['\"]$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function api(path, init = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.MESHY_API_KEY}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Meshy API ${response.status}: ${body.message || body.error || "request failed"}`);
  return body;
}

const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function pollTask(taskId, label) {
  const deadline = Date.now() + 25 * 60 * 1000;
  while (Date.now() < deadline) {
    const task = await api(`/text-to-3d/${taskId}`, { method: "GET" });
    const progress = Number.isFinite(task.progress) ? ` ${task.progress}%` : "";
    process.stdout.write(`\r${label}${progress} · ${task.status || "PENDING"}   `);
    if (task.status === "SUCCEEDED") {
      process.stdout.write("\n");
      return task;
    }
    if (["FAILED", "CANCELED", "EXPIRED"].includes(task.status)) {
      throw new Error(`${label} failed: ${task.task_error?.message || task.status}`);
    }
    await wait(7000);
  }
  throw new Error(`${label} timed out after 25 minutes`);
}

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GLB download failed: ${response.status}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { vehicles: {} };
  }
}

async function generateVehicle(spec) {
  console.log(`\n[${spec.displayName}] preview 생성`);
  const preview = await api("/text-to-3d", {
    method: "POST",
    body: JSON.stringify({
      mode: "preview",
      prompt: spec.prompt,
      should_remesh: true,
      target_polycount: 30000,
      target_formats: ["glb"]
    })
  });
  const previewTask = await pollTask(preview.result, `${spec.displayName} preview`);

  console.log(`[${spec.displayName}] PBR refine 생성`);
  const refine = await api("/text-to-3d", {
    method: "POST",
    body: JSON.stringify({
      mode: "refine",
      preview_task_id: previewTask.id || preview.result,
      enable_pbr: true,
      auto_size: true,
      target_formats: ["glb"]
    })
  });
  const refinedTask = await pollTask(refine.result, `${spec.displayName} refine`);
  const glbUrl = refinedTask.model_urls?.glb;
  if (!glbUrl) throw new Error(`${spec.displayName}: completed task has no GLB URL`);

  const fileName = `${spec.id}.glb`;
  await download(glbUrl, join(OUTPUT_DIR, fileName));
  const manifest = await readManifest();
  manifest.vehicles ||= {};
  manifest.vehicles[spec.id] = {
    name: spec.displayName,
    url: `/models/vehicles/${fileName}`,
    source: "Meshy Text to 3D",
    generatedAt: new Date().toISOString()
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[${spec.displayName}] 저장 완료: public/models/vehicles/${fileName}`);
}

await loadLocalEnv();
if (!process.env.MESHY_API_KEY) {
  throw new Error("MESHY_API_KEY가 없습니다. 새 키를 .env.local에 넣어 주세요. 채팅에 노출된 키는 폐기해야 합니다.");
}

const vehicleArg = process.argv.find((argument) => argument.startsWith("--vehicle="))?.split("=")[1];
const selected = process.argv.includes("--all")
  ? VEHICLES
  : vehicleArg
    ? VEHICLES.filter((vehicle) => vehicle.id === vehicleArg)
    : [];

if (!selected.length) {
  console.log("사용법: npm run meshy:vehicles -- --all");
  console.log(`한 대만 생성: npm run meshy:vehicles -- --vehicle=${VEHICLES[0].id}`);
  console.log(`차량 ID: ${VEHICLES.map((vehicle) => vehicle.id).join(", ")}`);
  process.exitCode = 1;
} else {
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const spec of selected) await generateVehicle(spec);
  console.log("\n모든 선택 차량의 생성과 manifest 연결이 끝났습니다.");
}
