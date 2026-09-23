import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private filesService: FilesService) {}

  // Fatura dosyasına geçici erişim URL'i döner.
  // Dosyalar "<userId>/<transactionId>/<uuid>.<ext>" yolunda saklanır;
  // kullanıcı sadece kendi klasöründeki dosyalara erişebilir.
  @Get('presigned')
  getPresignedUrl(
    @Query('path') path: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!path || path.includes('..') || !path.startsWith(`${req.user.id}/`)) {
      throw new ForbiddenException('Bu dosyaya erişim yetkiniz yok');
    }
    return this.filesService.getPresignedUrl(path).then((url) => ({ url }));
  }
}
