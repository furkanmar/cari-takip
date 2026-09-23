import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BalanceService } from './balance.service';
import { FilesService } from '../files/files.service';
import { CreateBalanceEntryDto } from './dto/create-balance-entry.dto';
import { UpdateBalanceEntryDto } from './dto/update-balance-entry.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('balance')
@UseGuards(JwtAuthGuard)
export class BalanceController {
  constructor(
    private balanceService: BalanceService,
    private filesService: FilesService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('invoice', { storage: memoryStorage() }))
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateBalanceEntryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const entry = await this.balanceService.create(req.user.id, dto);

    if (file) {
      const { url, fileName } = await this.filesService.uploadInvoice(
        file,
        req.user.id,
        entry.id,
      );
      return this.balanceService.attachInvoice(
        req.user.id,
        entry.id,
        url,
        fileName,
      );
    }

    return entry;
  }

  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    return this.balanceService.findAll(req.user.id);
  }

  @Get('summary')
  getSummary(@Request() req: AuthenticatedRequest) {
    return this.balanceService.getSummary(req.user.id);
  }

  @Get(':id')
  findOne(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.balanceService.findOne(req.user.id, id);
  }

  @Put(':id')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateBalanceEntryDto,
  ) {
    return this.balanceService.update(req.user.id, id, dto);
  }

  @Post(':id/invoice')
  @UseInterceptors(FileInterceptor('invoice', { storage: memoryStorage() }))
  async uploadInvoice(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Önce sahiplik: başkasının kaydına dosya yüklenmesin (MinIO'da yetim dosya da kalmasın).
    await this.balanceService.findOne(req.user.id, id);
    const { url, fileName } = await this.filesService.uploadInvoice(
      file,
      req.user.id,
      id,
    );
    return this.balanceService.attachInvoice(req.user.id, id, url, fileName);
  }

  @Delete(':id')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.balanceService.remove(req.user.id, id);
  }
}
