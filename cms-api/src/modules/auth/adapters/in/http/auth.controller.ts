import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  AccessTokenGuard,
  ClientIp,
  CsrfHeaderGuard,
  CurrentActor,
} from '../../../../../shared/adapters/http/authentication.js';
import { HTTP_CONFIG, type HttpConfig } from '../../../../../shared/adapters/http/tokens.js';
import { parseInput } from '../../../../../shared/adapters/http/validation.js';
import type { Actor } from '../../../../../shared/kernel/actor.js';
import type { SessionResult } from '../../../application/ports/in/auth.ports.js';
import { RateLimit, RateLimitGuard } from '../rate-limit.guard.js';
import { AUTH_USE_CASES, type AuthUseCases } from './auth.use-cases.js';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './session-cookie.js';

const MAX_INPUT_LENGTH = 1024;
const shortString = z.string().max(MAX_INPUT_LENGTH);

const loginRequest = z.object({ email: shortString, password: shortString });
const forgotRequest = z.object({ email: shortString });
const resetRequest = z.object({ token: shortString, new_password: shortString });
const changeRequest = z.object({ current_password: shortString, new_password: shortString });

@Controller('api/admin/auth')
export class AuthController {
  constructor(
    @Inject(AUTH_USE_CASES) private readonly useCases: AuthUseCases,
    @Inject(HTTP_CONFIG) private readonly config: HttpConfig,
  ) {}

  @Post('login')
  @HttpCode(200)
  @RateLimit('login')
  @UseGuards(RateLimitGuard)
  async login(
    @Body() body: unknown,
    @ClientIp() ip: string | null,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { email, password } = parseInput(loginRequest, body);
    const session = await this.useCases.login.execute({ email, password, ip });
    return this.startSession(session, response);
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(CsrfHeaderGuard)
  async refresh(
    @Req() request: Request,
    @ClientIp() ip: string | null,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = readSessionCookie(request);
    const session = await this.useCases.refresh.execute({ refreshToken, ip });
    return this.startSession(session, response);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(CsrfHeaderGuard)
  async logout(
    @Req() request: Request,
    @ClientIp() ip: string | null,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.useCases.logout.execute({ refreshToken: readSessionCookie(request), ip });
    clearSessionCookie(response, this.config.secureCookies);
  }

  @Post('password/forgot')
  @HttpCode(204)
  @RateLimit('passwordReset')
  @UseGuards(RateLimitGuard)
  async forgot(@Body() body: unknown, @ClientIp() ip: string | null): Promise<void> {
    const { email } = parseInput(forgotRequest, body);
    await this.useCases.requestPasswordReset.execute({ email, ip });
  }

  @Post('password/reset')
  @HttpCode(204)
  @RateLimit('passwordReset')
  @UseGuards(RateLimitGuard)
  async reset(@Body() body: unknown, @ClientIp() ip: string | null): Promise<void> {
    const input = parseInput(resetRequest, body);
    await this.useCases.completePasswordReset.execute({
      token: input.token,
      newPassword: input.new_password,
      ip,
    });
  }

  @Post('invitations/accept')
  @HttpCode(204)
  @RateLimit('passwordReset')
  @UseGuards(RateLimitGuard)
  async acceptInvitation(@Body() body: unknown, @ClientIp() ip: string | null): Promise<void> {
    const input = parseInput(resetRequest, body);
    await this.useCases.acceptInvitation.execute({
      token: input.token,
      newPassword: input.new_password,
      ip,
    });
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  async me(@CurrentActor() actor: Actor) {
    return { data: await this.useCases.currentUser.execute(actor) };
  }

  @Post('password/change')
  @HttpCode(204)
  @RateLimit('login')
  @UseGuards(RateLimitGuard, AccessTokenGuard)
  async change(
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    const input = parseInput(changeRequest, body);
    await this.useCases.changePassword.execute({
      actor,
      currentPassword: input.current_password,
      newPassword: input.new_password,
      ip,
    });
  }

  private startSession(session: SessionResult, response: Response) {
    setSessionCookie(response, session.refreshToken, this.config.secureCookies);
    return {
      data: {
        access_token: session.accessToken,
        expires_in: session.expiresInSeconds,
        user: session.user,
      },
    };
  }
}
