export type ClassifierConfig = {
  swapMethodAllowlist: string[];
};

export type ClassifiedResult = {
  type: import('./classifier').ClassifiedType;
  from?: string;
  to?: string;
  reason: string;
};
