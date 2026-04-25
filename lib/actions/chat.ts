// Client-side action — thin wrapper around the chat store's sendMessage.
// Keeps the call site clean and makes it easy to swap transports later.

import { useChatStore } from '@/lib/store/chat-store'

export async function sendChatMessage(text: string): Promise<void> {
  return useChatStore.getState().sendMessage(text)
}
