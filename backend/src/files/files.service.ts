import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FilesService implements OnModuleInit {
  private minioClient: Minio.Client;
  private bucket: string;
  private readonly logger = new Logger(FilesService.name);

  constructor(private configService: ConfigService) {
    this.minioClient = new Minio.Client({
      endPoint: configService.get('MINIO_ENDPOINT', 'localhost'),
      port: +configService.get('MINIO_PORT', '9000'),
      useSSL: configService.get('MINIO_USE_SSL') === 'true',
      accessKey: configService.get('MINIO_ACCESS_KEY', ''),
      secretKey: configService.get('MINIO_SECRET_KEY', ''),
    });
    this.bucket = configService.get('MINIO_BUCKET', 'invoices');
  }

  async onModuleInit() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket);
        this.logger.log(`Bucket '${this.bucket}' oluşturuldu`);
      }
    } catch (err) {
      this.logger.error('MinIO bucket başlatma hatası:', err);
    }
  }

  async uploadInvoice(
    file: Express.Multer.File,
    userId: string,
    transactionId: string,
  ): Promise<{ url: string; fileName: string }> {
    const ext = file.originalname.split('.').pop();
    const fileName = `${userId}/${transactionId}/${uuidv4()}.${ext}`;

    await this.minioClient.putObject(
      this.bucket,
      fileName,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype },
    );

    // Presigned URL (7 gün geçerli) - dosya erişimi için
    const url = await this.minioClient.presignedGetObject(
      this.bucket,
      fileName,
      7 * 24 * 60 * 60,
    );

    return { url: fileName, fileName: file.originalname };
  }

  async getPresignedUrl(objectPath: string): Promise<string> {
    return this.minioClient.presignedGetObject(
      this.bucket,
      objectPath,
      60 * 60, // 1 saat geçerli
    );
  }

  async deleteFile(objectPath: string): Promise<void> {
    await this.minioClient.removeObject(this.bucket, objectPath);
  }
}
