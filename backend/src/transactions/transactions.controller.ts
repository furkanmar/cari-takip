import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TransactionsService } from './transactions.service';
import { FilesService } from '../files/files.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(
    private transactionsService: TransactionsService,
    private filesService: FilesService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('invoice', { storage: memoryStorage() }))
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateTransactionDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const transaction = await this.transactionsService.create(req.user.id, dto);

    if (file) {
      const { url, fileName } = await this.filesService.uploadInvoice(
        file,
        req.user.id,
        transaction.id,
      );
      return this.transactionsService.attachInvoice(
        req.user.id,
        transaction.id,
        url,
        fileName,
      );
    }

    return transaction;
  }

  @Get()
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query('companyId') companyId: string,
  ) {
    return this.transactionsService.findAll(req.user.id, companyId);
  }

  @Get(':id')
  findOne(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.transactionsService.findOne(req.user.id, id);
  }

  @Put(':id')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(req.user.id, id, dto);
  }

  @Post(':id/invoice')
  @UseInterceptors(FileInterceptor('invoice', { storage: memoryStorage() }))
  async uploadInvoice(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Dosyasız istek önceden MinIO'da TypeError → 500 veriyordu.
    if (!file) {
      throw new BadRequestException(
        'Fatura dosyası gerekli (form alanı: invoice)',
      );
    }
    // Önce sahiplik: başkasının kaydına dosya yüklenmesin (MinIO'da yetim dosya da kalmasın).
    await this.transactionsService.findOne(req.user.id, id);
    const { url, fileName } = await this.filesService.uploadInvoice(
      file,
      req.user.id,
      id,
    );
    return this.transactionsService.attachInvoice(
      req.user.id,
      id,
      url,
      fileName,
    );
  }

  @Delete(':id')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.transactionsService.remove(req.user.id, id);
  }
}
