import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private filesService: FilesService) {}

  // Fatura dosyasına geçici erişim URL'i döner
  @Get('presigned')
  getPresignedUrl(@Query('path') path: string) {
    return this.filesService.getPresignedUrl(path).then((url) => ({ url }));
  }
}
