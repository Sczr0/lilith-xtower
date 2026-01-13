export type SponsorUser = {
  user_id: string;
  name: string;
  avatar: string;
};

export type SponsorItem = {
  user: SponsorUser;
  all_sum_amount?: string;
  last_pay_time?: number;
  create_time?: number;
  current_plan?: { name?: string } | null;
};

export type SponsorsApiResponse = {
  ec: number;
  em?: string;
  data?: {
    total_count?: number;
    total_page?: number;
    list?: SponsorItem[];
  };
};

