import { Storage, type File } from "@google-cloud/storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const client = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function parseObjectPath(rawPath: string): { bucketName: string; objectName: string } {
  const normalized = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Invalid object storage path");
  }
  return {
    bucketName: parts[0],
    objectName: parts.slice(1).join("/"),
  };
}

function getPublicRoot(): string {
  const root = process.env.PUBLIC_OBJECT_SEARCH_PATHS
    ?.split(",")
    .map(value => value.trim())
    .find(Boolean);
  if (!root) {
    throw new Error("PUBLIC_OBJECT_SEARCH_PATHS is not configured");
  }
  return root.replace(/\/+$/, "");
}

function sanitizeSegment(value: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
    throw new Error("Invalid listing photo path");
  }
  return value;
}

function getFile(propertyId: number, fileName: string): File {
  const relativePath = `listing-photos/${propertyId}/${sanitizeSegment(fileName)}`;
  const { bucketName, objectName } = parseObjectPath(`${getPublicRoot()}/${relativePath}`);
  return client.bucket(bucketName).file(objectName);
}

export async function uploadListingPhoto(
  propertyId: number,
  fileName: string,
  data: Buffer,
): Promise<string> {
  const file = getFile(propertyId, fileName);
  await file.save(data, {
    resumable: false,
    contentType: "image/webp",
    metadata: {
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return `/api/listing-photos/${propertyId}/${fileName}`;
}

export async function getListingPhoto(
  propertyId: number,
  fileName: string,
): Promise<File | null> {
  const file = getFile(propertyId, fileName);
  const [exists] = await file.exists();
  return exists ? file : null;
}

export async function deleteListingPhoto(
  propertyId: number,
  fileName: string,
): Promise<void> {
  const file = getFile(propertyId, fileName);
  await file.delete({ ignoreNotFound: true });
}