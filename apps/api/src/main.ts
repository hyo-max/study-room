import 'reflect-metadata';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Module,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, static as serveStatic } from 'express';
import type { IncomingHttpHeaders } from 'node:http';
import { resolve } from 'node:path';
import { Actor, integer, Service } from './service';
import { Store } from './store';
function actor(headers: IncomingHttpHeaders): Actor {
  if (headers['x-role'] === 'teacher') return { role: 'teacher' };
  if (headers['x-role'] === 'student')
    return { role: 'student', studentId: integer(Number(headers['x-student-id']), '학생 ID') };
  throw new UnauthorizedException('역할을 선택해 주세요.');
}
const id = (v: string) => integer(Number(v), 'ID');
@Controller('api')
class ApiController {
  constructor(@Inject(Service) private readonly service: Service) {}
  @Get('health') health() {
    return { status: 'ok' };
  }
  @Get('rooms') rooms(@Headers() h: IncomingHttpHeaders) {
    actor(h);
    return this.service.rooms();
  }
  @Post('rooms') create(@Body() b: unknown, @Headers() h: IncomingHttpHeaders) {
    return this.service.saveRoom(null, b ?? {}, actor(h));
  }
  @Get('rooms/:id') detail(@Param('id') v: string, @Headers() h: IncomingHttpHeaders) {
    return this.service.detail(id(v), actor(h));
  }
  @Patch('rooms/:id') update(
    @Param('id') v: string,
    @Body() b: unknown,
    @Headers() h: IncomingHttpHeaders,
  ) {
    return this.service.saveRoom(id(v), b ?? {}, actor(h));
  }
  @Delete('rooms/:id') remove(@Param('id') v: string, @Headers() h: IncomingHttpHeaders) {
    return this.service.deleteRoom(id(v), actor(h));
  }
  @Get('students') students(@Headers() h: IncomingHttpHeaders) {
    actor(h);
    return this.service.students();
  }
  @Post('students') newStudent(@Body() b: unknown, @Headers() h: IncomingHttpHeaders) {
    return this.service.saveStudent(null, b ?? {}, actor(h));
  }
  @Patch('students/:id') updateStudent(
    @Param('id') v: string,
    @Body() b: unknown,
    @Headers() h: IncomingHttpHeaders,
  ) {
    return this.service.saveStudent(id(v), b ?? {}, actor(h));
  }
  @Delete('students/:id') removeStudent(@Param('id') v: string, @Headers() h: IncomingHttpHeaders) {
    return this.service.deleteStudent(id(v), actor(h));
  }
  @Get('visits/mine') mine(@Headers() h: IncomingHttpHeaders) {
    return this.service.mine(actor(h));
  }
  @Post('rooms/:id/visits') apply(
    @Param('id') v: string,
    @Body() b: unknown,
    @Headers() h: IncomingHttpHeaders,
  ) {
    return this.service.apply(id(v), b ?? {}, actor(h));
  }
  @Patch('visits/:id') change(
    @Param('id') v: string,
    @Body() b: unknown,
    @Headers() h: IncomingHttpHeaders,
  ) {
    return this.service.changeVisit(id(v), b ?? {}, actor(h));
  }
  @Delete('visits/:id') cancel(@Param('id') v: string, @Headers() h: IncomingHttpHeaders) {
    return this.service.changeVisit(id(v), {}, actor(h), true);
  }
}
@Module({
  controllers: [ApiController],
  providers: [
    { provide: Store, useFactory: () => new Store() },
    { provide: Service, useFactory: (store: Store) => new Service(store), inject: [Store] },
  ],
})
class AppModule {}
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '32kb' }));
  app.use(serveStatic(resolve(__dirname, '../../web/dist')));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3000), '127.0.0.1');
}
bootstrap();
