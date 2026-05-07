declare module 'ioredis' {
  const Redis: any;
  export default Redis;
}

declare module '@aws-sdk/client-secrets-manager' {
  export class SecretsManagerClient {
    constructor(options: any);
    send(command: any): Promise<any>;
  }

  export class GetSecretValueCommand {
    constructor(input: any);
  }
}
