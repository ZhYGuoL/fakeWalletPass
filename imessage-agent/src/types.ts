export type ExtractResult = {
  extracted: {
    sourceUrl: string;
    eventTitle: string | null;
    eventImageUrl: string | null;
    startDateTime: string | null;
    endDateTime: string | null;
    timezone: string | null;
    locationName: string | null;
    address: string | null;
    hostName: string | null;
    palette: {
      neutral?: Array<{ color: string; percentage: number }>;
      vibrant?: Array<{ color: string; percentage: number }>;
    } | null;
  };
  missingFields: string[];
  hiddenFields: string[];
  ticketTypes: string[];
};
