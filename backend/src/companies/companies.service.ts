import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private companiesRepository: Repository<Company>,
  ) {}

  async create(userId: string, dto: CreateCompanyDto): Promise<Company> {
    const company = this.companiesRepository.create({ ...dto, userId });
    return this.companiesRepository.save(company);
  }

  async findAll(userId: string): Promise<Company[]> {
    return this.companiesRepository.find({
      where: { userId },
      order: { name: 'ASC' },
    });
  }

  async findOne(userId: string, id: string): Promise<Company> {
    const company = await this.companiesRepository.findOne({
      where: { id, userId },
    });
    if (!company) throw new NotFoundException('Şirket bulunamadı');
    return company;
  }

  async update(userId: string, id: string, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findOne(userId, id);
    Object.assign(company, dto);
    return this.companiesRepository.save(company);
  }

  async remove(userId: string, id: string): Promise<void> {
    const company = await this.findOne(userId, id);
    await this.companiesRepository.remove(company);
  }

  async updateBalances(
    companyId: string,
    userId: string,
  ): Promise<void> {
    // Tüm işlemleri toplayıp company bakiyelerini güncelle
    const result = await this.companiesRepository
      .createQueryBuilder('company')
      .leftJoin('company.transactions', 'transaction')
      .select('SUM(CASE WHEN transaction.type = :receivable THEN transaction.amount ELSE 0 END)', 'totalReceivable')
      .addSelect('SUM(CASE WHEN transaction.type = :payable THEN transaction.amount ELSE 0 END)', 'totalPayable')
      .where('company.id = :companyId AND company.userId = :userId', { companyId, userId })
      .setParameters({ receivable: 'receivable', payable: 'payable' })
      .getRawOne();

    await this.companiesRepository.update(companyId, {
      totalReceivable: parseFloat(result?.totalReceivable || '0'),
      totalPayable: parseFloat(result?.totalPayable || '0'),
    });
  }
}
