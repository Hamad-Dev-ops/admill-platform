export interface IPaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface ISuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: IPaginationMeta;
}

export class ApiResponse {
  static success<T>(data: T, message?: string, meta?: IPaginationMeta): ISuccessResponse<T> {
    return {
      success: true,
      data,
      ...(message !== undefined && { message }),
      ...(meta !== undefined && { meta }),
    };
  }
}
