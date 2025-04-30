import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {DocumentBuilder, SwaggerModule} from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  const config = new DocumentBuilder()
      .setTitle('tz_middle')
      .setDescription('API для регистрации, авторизации и работы с чатом')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  //TODO порт для прослушивания бэка
  await app.listen(3000);
}
bootstrap();
