import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { TEAM_BEARER, CUSTOMER_BEARER } from '@common/swagger/swagger.constants';
import {
  ApiResponseDto,
  ApiErrorDto,
  PaginationMetaDto,
  ValidationErrorDetailDto,
} from '@common/dto/api-response.dto';

/**
 * Builds the OpenAPI document.
 *
 * Extracted from the bootstrap so `npm run docs:openapi` emits exactly the
 * same document the running server serves — a generated client can never
 * drift from the live API.
 */
export function createSwaggerDocument(app: INestApplication, config: ConfigService): OpenAPIObject {
  const documentConfig = new DocumentBuilder()
    .setTitle(config.get<string>('swagger.title', 'Sambehen API'))
    .setDescription(
      [
        config.get<string>('swagger.description', 'Data Entry Management System API'),
        '',
        '## Response envelope',
        'Every endpoint returns the same shape: `success`, `statusCode`, `message`,',
        '`data` (success only), `error` (failure only), `meta` + `summary` (lists),',
        '`timestamp`, `path`, `correlationId`. Export endpoints are the sole',
        'exception and stream a binary file.',
        '',
        '## Errors',
        '`error.code` is a stable machine-readable value, safe to switch on and never',
        'reworded; `message` is human-facing and may change. Validation failures',
        'return 422 with one `error.details` entry per failed constraint, addressed',
        'by dotted path (e.g. `winners.0.customerId`).',
        '',
        '## Access control',
        'Two independent realms with separate signing secrets: **team** (master,',
        'manager, runner) and **customer**. A token from one realm fails signature',
        'verification in the other. Beyond role checks, rows are filtered to the',
        "actor's own chain, and requesting a record outside that scope returns",
        "**404, not 403**, so the API never confirms that another chain's record",
        'exists.',
      ].join('\n'),
    )
    .setVersion(config.get<string>('swagger.version', '1.0'))
    // Two schemes, so the Authorize dialog makes it explicit that team and
    // customer tokens are not interchangeable.
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      TEAM_BEARER,
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      CUSTOMER_BEARER,
    )
    .addTag('Health', 'Liveness and readiness probes')
    .addTag('Auth', 'Team and customer login gateways')
    .build();

  // The envelope DTOs are referenced through allOf/$ref by the response
  // decorators, so they would only appear once a controller uses one.
  // Registering them explicitly means the contract is documented from the
  // start and the frontend team can generate types before the feature
  // endpoints land.
  return SwaggerModule.createDocument(app, documentConfig, {
    extraModels: [ApiResponseDto, ApiErrorDto, PaginationMetaDto, ValidationErrorDetailDto],
  });
}

/** Mounts Swagger UI and the raw JSON document. */
export function setupSwagger(
  app: INestApplication,
  config: ConfigService,
  apiPrefix: string,
): void {
  const document = createSwaggerDocument(app, config);

  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha', operationsSorter: 'alpha' },
    jsonDocumentUrl: `${apiPrefix}/docs-json`,
  });
}
