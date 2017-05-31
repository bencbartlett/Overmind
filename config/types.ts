export interface EnvOptions {
  ENV?: string;
  ROOT?: string;
  TEST?: boolean;
}

export interface Credentials {
  branch?: string;
  email: string;
  password: string;
  token?: string;
  serverUrl: string;
  serverPassword?: string;
  gzip?: boolean;
}
