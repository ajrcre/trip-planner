// Barrel re-export — keeps all existing `@/lib/gemini` imports working.
export {
  type ExtractedTripDetails,
  extractTripDetails,
  suggestActivities,
  type DestinationInfo,
  generateDestinationInfo,
  type TranslatedItem,
  translateShoppingItems,
} from "./gemini-extraction"

export {
  type GeminiChatMessage,
  type GeminiFunctionCallResult,
  type GeminiTextResult,
  type GeminiChatResult,
  chatWithFunctions,
  buildChatContext,
} from "./gemini-chat"
