import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '@common/decorators/public.decorator';

import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

/**
 * Health endpoints, served under `/v1/health`.
 *
 * Thin by design: every method delegates straight to {@link HealthService}.
 * Marked `@Public()` so the Phase 2 auth guard will not gate orchestrator
 * probes.
 */
@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  liveness(): HealthResponseDto {
    return this.healthService.checkLiveness();
  }

  @Public()
  @Get('ready')
  @ApiOkResponse({ type: HealthResponseDto })
  readiness(): Promise<HealthResponseDto> {
    return this.healthService.checkReadiness();
  }
}
