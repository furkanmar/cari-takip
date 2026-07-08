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
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateCompanyDto) {
    return this.companiesService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req, @Query('includeArchived') includeArchived?: string) {
    return this.companiesService.findAll(req.user.id, includeArchived === 'true');
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.companiesService.findOne(req.user.id, id);
  }

  @Put(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(req.user.id, id, dto);
  }

  @Put(':id/archive')
  archive(@Request() req, @Param('id') id: string) {
    return this.companiesService.archive(req.user.id, id);
  }

  @Put(':id/unarchive')
  unarchive(@Request() req, @Param('id') id: string) {
    return this.companiesService.unarchive(req.user.id, id);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.companiesService.remove(req.user.id, id);
  }
}
