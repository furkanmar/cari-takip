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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  @UseInterceptors(FileInterceptor('invoice'))
  async create(
    @Request() req,
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
      await this.transactionsService.update(req.user.id, transaction.id, {});
      // invoiceUrl ve fileName'i direkt güncelle
      return this.transactionsService.attachInvoice(transaction.id, url, fileName);
    }

    return transaction;
  }

  @Get()
  findAll(@Request() req, @Query('companyId') companyId: string) {
    return this.transactionsService.findAll(req.user.id, companyId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.transactionsService.findOne(req.user.id, id);
  }

  @Put(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactionsService.update(req.user.id, id, dto);
  }

  @Post(':id/invoice')
  @UseInterceptors(FileInterceptor('invoice'))
  async uploadInvoice(
    @Request() req,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const { url, fileName } = await this.filesService.uploadInvoice(
      file,
      req.user.id,
      id,
    );
    return this.transactionsService.attachInvoice(id, url, fileName);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.transactionsService.remove(req.user.id, id);
  }
}
