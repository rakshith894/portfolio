export const destinations = [
  'about',
  'projects',
  'skills',
  'resume',
  'contact',
] as const;
export type Destination = (typeof destinations)[number];
