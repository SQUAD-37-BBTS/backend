import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  senha: string;
}

export class RefreshDto {
  @IsString()
  refresh_token: string;
}

export class AlterarSenhaDto {
  @IsString()
  senha_atual: string;

  @IsString()
  @MinLength(8)
  nova_senha: string;
}
