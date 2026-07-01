import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

import { PaginatedResponseDto } from '@common/dto/paginated-response.dto';

/**
 * Documents a paginated `{ data: Model[], meta }` response for Swagger.
 *
 * Composes the generic `PaginatedResponseDto` schema with a concrete `data`
 * item type via `allOf` + `$ref`, which is the canonical way to express
 * generics in OpenAPI with `@nestjs/swagger`.
 */
export const ApiPaginatedResponse = <TModel extends Type<unknown>>(
  model: TModel,
): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ApiExtraModels(PaginatedResponseDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
            },
          },
        ],
      },
    }),
  );
