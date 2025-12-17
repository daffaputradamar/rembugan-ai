#!/usr/bin/env node

/**
 * Setup script to configure GCS bucket with 7-day retention policy
 * 
 * Usage: npx ts-node scripts/setup-gcs-retention.ts
 * 
 * Requires:
 * - GOOGLE_CREDENTIALS_JSON environment variable with service account key
 * - GCS_BUCKET_NAME environment variable with bucket name
 */

import { Storage } from "@google-cloud/storage"
import dotenv from "dotenv"

dotenv.config()

async function setupGCSRetention() {
  const bucketName = process.env.GCS_BUCKET_NAME
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON

  if (!bucketName) {
    console.error("❌ GCS_BUCKET_NAME environment variable not set")
    process.exit(1)
  }

  if (!credentialsJson) {
    console.error("❌ GOOGLE_CREDENTIALS_JSON environment variable not set")
    process.exit(1)
  }

  try {
    const credentials = JSON.parse(credentialsJson)
    const storage = new Storage({ credentials })
    const bucket = storage.bucket(bucketName)

    console.log(`📦 Setting up GCS bucket: ${bucketName}`)

    // Set lifecycle policy for 7-day retention
    await bucket.setMetadata({
      lifecycle: {
        rule: [
          {
            action: { type: "Delete" },
            condition: {
              age: 7, // 7 days
              matchesPrefix: ["audio-transcripts/"], // Only apply to audio transcripts folder
            },
          },
        ],
      },
    })

    console.log("✅ Lifecycle policy set: Audio files will be automatically deleted after 7 days")

    // Verify the policy was set
    const [metadata] = await bucket.getMetadata()
    if (metadata.lifecycle) {
      console.log("\n📋 Current lifecycle policy:")
      console.log(JSON.stringify(metadata.lifecycle, null, 2))
    }
  } catch (error) {
    console.error("❌ Failed to set up GCS retention:", error)
    process.exit(1)
  }
}

setupGCSRetention()
