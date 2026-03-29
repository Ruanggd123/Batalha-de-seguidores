import { Player } from "../types";

// Stub service to prevent 403 errors from Gemini SDK attempting to initialize
// This service is now completely local and does not import @google/generative-ai
export const getGeminiCommentary = async (
  _followedPlayer: Player | null,
  _aliveCount: number,
  _totalPlayers: number,
  _battleEvents: string[]
): Promise<string> => {
  return ""; // Returns empty to allow local commentary to take over
};

export const getGeminiSummary = async (
  _winner: Player,
  _totalPlayers: number,
  _events: string[]
): Promise<string> => {
  return ""; // Returns empty to allow local summary to take over
};