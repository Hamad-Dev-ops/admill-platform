import { v2 as cloudinary } from "cloudinary";
import { env } from "../../../config/env";
import { IFileStorageProvider } from "./fileStorage.provider.interface";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Precise cleanup by exact public_id — deliberately not a folder-prefix wipe, since
// production documents will eventually live under these same folders and a prefix
// delete would risk taking real uploads with it.
function extractPublicIdFromUrl(secureUrl: string): string {
  const match = /\/upload\/(?:v\d+\/)?(.+)\.\w+$/.exec(secureUrl);

  if (!match) {
    throw new Error(`Could not extract a Cloudinary public_id from URL: ${secureUrl}`);
  }

  return match[1];
}

export class CloudinaryFileStorageProvider implements IFileStorageProvider {
  upload(buffer: Buffer, folder: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "auto" }, (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload returned no result"));
          return;
        }
        resolve(result.secure_url);
      });

      stream.end(buffer);
    });
  }

  async deleteByUrl(url: string): Promise<void> {
    await cloudinary.uploader.destroy(extractPublicIdFromUrl(url));
  }
}

export const fileStorageProvider: IFileStorageProvider = new CloudinaryFileStorageProvider();
