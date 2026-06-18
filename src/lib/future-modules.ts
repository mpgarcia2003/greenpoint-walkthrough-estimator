import type { RoomEntry, RoomType } from "@/lib/types";

export interface VoiceInputAdapter {
  parseCommand(transcript: string): Promise<{
    roomType: RoomType;
    minutes: number;
  } | null>;
}

export interface PhotoCaptureAdapter {
  attachPhoto(entryId: RoomEntry["id"], file: File): Promise<string>;
}

export interface QrRoomScanAdapter {
  resolveRoomCode(code: string): Promise<{
    roomType: RoomType;
    roomName?: string;
  } | null>;
}

export interface AiRecommendationAdapter {
  recommendMinutes(context: {
    roomType: RoomType;
    squareFootage?: number;
    facilityType?: string;
    historicalMinutes?: number[];
  }): Promise<number>;
}

export interface ProposalGeneratorAdapter {
  generateProposal(estimateId: string): Promise<Blob>;
}

export interface AccountWorkspaceAdapter {
  companyId: string;
  userId: string;
  canEstimateGovernmentContracts: boolean;
  canEstimateSchools: boolean;
  canEstimateHospitals: boolean;
  canEstimateAirports: boolean;
}

export const futureReadyModules = {
  voiceInput: "VoiceInputAdapter",
  photoCapture: "PhotoCaptureAdapter",
  qrRoomScanning: "QrRoomScanAdapter",
  aiRecommendations: "AiRecommendationAdapter",
  proposalGenerator: "ProposalGeneratorAdapter",
  multiUserCompanyDashboard: "AccountWorkspaceAdapter",
} as const;
