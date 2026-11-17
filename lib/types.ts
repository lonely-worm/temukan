export type ItemKind = 'lost' | 'found';
export type ItemStatus = 'open' | 'claimed' | 'resolved';

export type Item = {
  id: string;
  kind: ItemKind;
  title: string;
  category: string;
  location: string;
  date: string;
  status: ItemStatus;
  description: string;
  reporter: string;
  initials: string;
  color: string;
};

export type Claim = {
  id: string;
  itemId: string;
  itemTitle: string;
  claimant: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  otpVerifiedAt?: string;
};

export type Notification = {
  id: string;
  text: string;
  time: string;
  unread: boolean;
};
