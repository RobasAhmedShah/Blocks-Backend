export class PubSubMessageDto {
  // Standard Pub/Sub format (for testing/manual calls)
  message?: {
    data?: string; // Base64 encoded JSON string
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
  
  // Gmail Watch direct format (what Gmail actually sends)
  emailAddress?: string;
  historyId?: string | number;
}

export class GmailEventDto {
  emailAddress: string;
  historyId: string;
}

