export type DefiWindowStatus =
  | 'ready'
  | 'partial'
  | 'unavailable'
  | 'not-configured'
  | 'invalid';

export type ResolvedDefiWindow = {
  status: DefiWindowStatus;
  availableFrom: string | null;
  requestedFrom: string | null;
  requestedTo: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

export type ResolveDefiWindowOptions = {
  availableFrom?: string | null;
  requestedFrom?: string | null;
  requestedTo?: string | null;
  fallbackFrom?: string | null;
  fallbackTo?: string | null;
};
