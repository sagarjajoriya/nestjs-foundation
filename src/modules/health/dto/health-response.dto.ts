import { ApiProperty } from '@nestjs/swagger';

/** Health status of an individual dependency. */
export type DependencyStatus = 'up' | 'down';

/** Overall health outcome. */
export type HealthStatus = 'ok' | 'error';

/**
 * Response contract for the health endpoints. Documented for Swagger and used
 * as the service return type so the controller stays a thin pass-through.
 */
export class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'error'], example: 'ok' })
  status!: HealthStatus;

  @ApiProperty({ example: '2026-07-01T12:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: 128.4, description: 'Process uptime in seconds.' })
  uptime!: number;

  @ApiProperty({
    example: { database: 'up' },
    description: 'Per-dependency status. Present on readiness checks.',
    required: false,
  })
  details?: Record<string, DependencyStatus>;
}
