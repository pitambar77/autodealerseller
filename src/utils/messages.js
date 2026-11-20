// Enquiry conversations: messages[] = { id, from: 'buyer' | 'seller', text, at }, readAt = { buyer, seller }.

/** Messages in a conversation, oldest first (enquiries made before chat have only the first message). */
export function threadOf(e) {
  if (e?.messages?.length) return e.messages;
  return e ? [{ id: `${e.id}-0`, from: 'buyer', text: e.message, at: e.createdAt }] : [];
}

/** How many messages from the other side `side` hasn't read yet. */
export function unreadFor(e, side) {
  const since = e?.readAt?.[side];
  return threadOf(e).filter((m) => m.from !== side && (!since || new Date(m.at) > new Date(since))).length;
}

export const lastMessage = (e) => threadOf(e).at(-1);
export const lastAt = (e) => e?.lastMessageAt || lastMessage(e)?.at || e?.createdAt;

/** Where a seller of this kind reads a conversation. */
export const inboxPath = (role, id) => (role === 'agent' ? `/agent/listings?tab=enquiries&c=${id}` : `${role === 'dealer' ? '/dealer' : '/seller'}/enquiries?c=${id}`);
