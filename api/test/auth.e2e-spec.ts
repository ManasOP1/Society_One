import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /auth/societies is public', () => {
    return request(app.getHttpServer())
      .get('/api/v1/auth/societies')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('POST /auth/login rejects invalid credentials', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrongpass' })
      .expect(401);
  });

  it('POST /auth/forgot-password always returns success shape', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.com' })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
        expect(res.body.success).toBe(true);
      });
  });

  it('GET /invoices requires authentication', () => {
    return request(app.getHttpServer()).get('/api/v1/invoices').expect(401);
  });
});
