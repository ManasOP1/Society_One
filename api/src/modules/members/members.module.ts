import { Module } from '@nestjs/common';
import { ReportingModule } from '../reporting/reporting.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [ReportingModule],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
