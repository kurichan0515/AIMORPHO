export interface IStorageService {
  getMealUploadUrl(key: string): Promise<string>;
  getAvatarUploadUrl(key: string): Promise<string>;
  getLegalUploadUrl(key: string): Promise<string>;
  getObjectBase64(key: string): Promise<string>;
  getObjectText(key: string): Promise<string>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  publicUrl(key: string): string;
}
