#!/usr/bin/env node
/**
 * Creates (or updates) the two unsigned upload presets Tincan needs, using the
 * server credentials from .env.local / .env. Idempotent; prints no secrets.
 *
 *   tincan_image → folder tincan/images, incoming c_limit,w_1080,h_1080,q_auto:low
 *   tincan_audio → folder tincan/audio  (voice notes, uploaded to the video endpoint)
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { v2 as cloudinary } from "cloudinary";

const root = resolve(import.meta.dirname, "..");

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    const quoted = /^(['"]).*\1$/.test(value);
    value = quoted ? value.slice(1, -1) : value.replace(/\s+#.*$/, "").trim();
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}

const env = { ...parseEnvFile(resolve(root, ".env")), ...parseEnvFile(resolve(root, ".env.local")), ...process.env };
const cloud_name = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const api_key = env.CLOUDINARY_API_KEY;
const api_secret = env.CLOUDINARY_API_SECRET;
if (!cloud_name || !api_key || !api_secret) {
  console.error("cloudinary-presets: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set.");
  process.exit(1);
}
cloudinary.config({ cloud_name, api_key, api_secret, secure: true });

const presets = [
  {
    name: env.NEXT_PUBLIC_CLOUDINARY_PRESET_IMAGE || "tincan_image",
    settings: {
      unsigned: true,
      folder: "tincan/images",
      // Incoming transformation (object form; a string would be treated as a named transformation).
      transformation: { crop: "limit", width: 1080, height: 1080, quality: "auto:low" },
      use_filename: false,
      unique_filename: true,
      overwrite: false,
    },
  },
  {
    name: env.NEXT_PUBLIC_CLOUDINARY_PRESET_AUDIO || "tincan_audio",
    settings: { unsigned: true, folder: "tincan/audio", use_filename: false, unique_filename: true, overwrite: false },
  },
];

const message = (err) => err?.error?.message ?? err?.message ?? "unknown error";

for (const { name, settings } of presets) {
  let exists = false;
  try {
    await cloudinary.api.upload_preset(name);
    exists = true;
  } catch (err) {
    if (err?.error?.http_code !== 404) {
      console.error(`cloudinary-presets: could not read ${name}: ${message(err)}`);
      process.exitCode = 1;
      continue;
    }
  }
  try {
    if (exists) {
      await cloudinary.api.update_upload_preset(name, settings);
      console.log(`cloudinary-presets: updated ${name}`);
    } else {
      await cloudinary.api.create_upload_preset({ name, ...settings });
      console.log(`cloudinary-presets: created ${name}`);
    }
  } catch (err) {
    console.error(`cloudinary-presets: ${name} failed: ${message(err)}`);
    process.exitCode = 1;
  }
}
