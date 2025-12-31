export class PubSubMessageDto {
  message?: {
    data?: string; // Base64 encoded JSON string
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
}

export class GmailEventDto {
  emailAddress: string;
  historyId: string;
}

