type Message = { text: string; isContactLink: boolean };

export function parseLLMMessages(text: string): Message[] {
  const parts = text
    .split(/<MediaUrl>(https?:\/\/[^<]+)<\/MediaUrl>/g)
    .map((part) => part.trim());
  const messages: Message[] = [];

  for (const part of parts) {
    const isLink = new RegExp(/^https?:\/\/[^<]+.vcf$/g).test(part);
    messages.push({
      text: part,
      isContactLink: isLink,
    });
  }

  return messages;
}
