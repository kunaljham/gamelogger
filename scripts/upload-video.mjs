import { put } from "@vercel/blob";
import { readFileSync } from "fs";

const filePath = process.argv[2] || "out/demo.mp4";
const blobName = filePath.split("/").pop();

const ext = blobName.split(".").pop().toLowerCase();
const contentTypes = {
  mp4: "video/mp4",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
const contentType = contentTypes[ext] || "application/octet-stream";

const file = readFileSync(filePath);
const blob = await put(blobName, file, {
  access: "public",
  contentType,
  allowOverwrite: true,
});

console.log("Uploaded! Public URL:");
console.log(blob.url);
