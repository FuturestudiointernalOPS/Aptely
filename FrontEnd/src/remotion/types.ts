type OfferVideoLabels = {
  kicker: string;
  compensation: string;
  startDate: string;
  ctaPrefix: string;
  ctaSuffix: string;
};

export type OfferVideoProps = {
  candidateName: string;
  jobTitle: string;
  company: string;
  salary?: string;
  startDate?: string;
  labels?: OfferVideoLabels;
};
