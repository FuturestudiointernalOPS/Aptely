// Load polyfills first, before any module that uses DOM APIs
import "./polyfill";

import app from "./app";
import { env } from "./config/env";
import { startEmailQueueProcessor } from "./services/email.service";
import { initializeStorageBuckets } from "./services/storage.service";
import { supabaseAdmin } from "./config/supabase";

const PORT = parseInt(env.PORT, 10);

async function runInterviewExpiryJob(): Promise<void> {
  const { error } = await supabaseAdmin
    .from("interviews")
    .update({ status: "COMPLETED" })
    .eq("status", "SCHEDULED")
    .not("scheduled_at", "is", null)
    .lt("scheduled_at", new Date().toISOString());

  if (error) {
    process.stderr.write(`[interview-expiry] ${error.message}\n`);
  }
}

function startInterviewExpiryJob(): void {
  void runInterviewExpiryJob();
  setInterval(() => void runInterviewExpiryJob(), 60 * 60 * 1000);
}

async function runOfferExpiryJob(): Promise<void> {
  const { error } = await supabaseAdmin
    .from("offers")
    .update({ status: "EXPIRED" })
    .eq("status", "SENT")
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString());

  if (error) {
    process.stderr.write(`[offer-expiry] ${error.message}\n`);
  }
}

function startOfferExpiryJob(): void {
  // Run immediately on startup, then every hour
  void runOfferExpiryJob();
  setInterval(() => void runOfferExpiryJob(), 60 * 60 * 1000);
}

app.listen(PORT, () => {
  process.stdout.write(` Aptely API running on port ${PORT} [${env.NODE_ENV}]\n`);

  // Start background email queue processor (runs every 5 minutes)
  void startEmailQueueProcessor();

  // Initialize storage buckets on startup
  void initializeStorageBuckets();

  // Auto-expire SENT offers past their expires_at (runs hourly)
  startOfferExpiryJob();

  // Auto-complete SCHEDULED interviews past their scheduled_at (runs hourly)
  startInterviewExpiryJob();
});
