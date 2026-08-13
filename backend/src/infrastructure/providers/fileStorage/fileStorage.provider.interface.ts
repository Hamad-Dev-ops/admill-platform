export interface IFileStorageProvider {
  upload(buffer: Buffer, folder: string): Promise<string>;
  deleteByUrl(url: string): Promise<void>;
}
