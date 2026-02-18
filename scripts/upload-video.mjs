import { put } from "@vercel/blob";
import { readFileSync } from "fs";

const filePath = process.argv[2] || "out/demo.mp4";
const blobName = filePath.split("/").pop();

const file = readFileSync(filePath);
const blob = await put(blobName, file, {
  access: "public",
  contentType: "video/mp4",
  allowOverwrite: true,
});

console.log("Uploaded! Public URL:");
console.log(blob.url);
